import { NextResponse } from 'next/server'

import { assertCanMutate, requireUser } from '@/lib/api-auth'
import {
  filterEligibleByLanguage,
  insufficientLanguagesText,
  MIN_WORDS_PER_LANGUAGE,
  pickSameLanguage,
} from '@/lib/quiz-language'
import { fetchWordPool } from '@/lib/word-pool'
import { quizWeight, shuffle, weightedSampleWithoutReplacement } from '@/lib/weighted-sample'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isQuestionType, QUESTION_TYPE_LABELS, type QuestionType, type QuizQuestion } from '@/types/quiz'

export const runtime = 'nodejs'

export type { QuestionType, QuizQuestion }

export async function POST(request: Request) {
  const auth = await requireUser()
  if (auth.error) return auth.error

  const blocked = assertCanMutate(auth.user)
  if (blocked) return blocked

  let body: {
    wordbook_ids?: string[]
    tag_ids?: string[]
    question_type?: QuestionType
    word_count?: number
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '無效的 JSON' }, { status: 400 })
  }

  const wordbookIds = Array.isArray(body.wordbook_ids) ? body.wordbook_ids : []
  const tagIds = Array.isArray(body.tag_ids) ? body.tag_ids : []
  const questionType = body.question_type
  const requested = Math.floor(Number(body.word_count) || 0)

  if (wordbookIds.length === 0) {
    return NextResponse.json({ error: '請至少選擇一本單字本' }, { status: 400 })
  }
  if (!isQuestionType(questionType)) {
    return NextResponse.json({ error: '無效的題型' }, { status: 400 })
  }
  if (requested < 1) {
    return NextResponse.json({ error: '題數至少為 1' }, { status: 400 })
  }

  let fullPool
  try {
    fullPool = await fetchWordPool(auth.user.id, wordbookIds, tagIds)
  } catch (e) {
    const msg = e instanceof Error ? e.message : '篩選失敗'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  if (fullPool.length === 0) {
    return NextResponse.json({ error: '篩選結果沒有單字', pool_size: 0 }, { status: 400 })
  }

  // 防呆依語言計算：字數不足的語言不出題，全部不足時不允許開始（第五節 5.）
  const min = MIN_WORDS_PER_LANGUAGE[questionType]
  const { eligible: pool, insufficient } = filterEligibleByLanguage(fullPool, min)
  if (pool.length === 0) {
    return NextResponse.json(
      {
        error: `${QUESTION_TYPE_LABELS[questionType]}每個語言需至少 ${min} 個單字，請擴大篩選範圍或改選其他題型`,
        pool_size: 0,
      },
      { status: 400 }
    )
  }

  const selected = weightedSampleWithoutReplacement(
    pool,
    (w) => quizWeight(w.attempt_count, w.correct_count),
    requested
  )

  const questions: QuizQuestion[] = selected.map((word) => {
    if (questionType === 'input') {
      // 填空：顯示中文，使用者輸入外文單字
      return { word_id: word.id, prompt: word.answer }
    }

    const base: QuizQuestion = {
      word_id: word.id,
      term: word.term,
      language: word.language,
      reading: word.reading,
      pronunciation: word.pronunciation,
    }

    // 干擾項與替換字只取同語言的字（第五節 6.、7.）
    if (questionType === 'tf') {
      const askTrue = Math.random() < 0.5
      if (askTrue) {
        base.display_answer = word.answer
      } else {
        base.display_answer = pickSameLanguage(pool, word, 1)[0]!.answer
      }
    } else if (questionType === 'choice') {
      const distractors = pickSameLanguage(pool, word, 3).map((w) => w.answer)
      base.options = shuffle([word.answer, ...distractors])
    }

    return base
  })

  const { data: session, error } = await supabaseAdmin
    .from('quiz_sessions')
    .insert({
      user_id: auth.user.id,
      filter_wordbook_ids: wordbookIds,
      filter_tag_ids: tagIds,
      question_type: questionType,
      word_count_requested: requested,
    })
    .select('id')
    .single()

  if (error || !session) {
    return NextResponse.json({ error: error?.message ?? '建立場次失敗' }, { status: 500 })
  }

  return NextResponse.json({
    session_id: session.id,
    question_type: questionType,
    pool_size: pool.length,
    truncated: selected.length < requested,
    /** 字數不足而不出題的語言說明（如「日文少於 4 個字」） */
    excluded_languages: insufficientLanguagesText(insufficient, min),
    questions,
  })
}
