import { NextResponse } from 'next/server'

import { assertCanMutate, requireUser } from '@/lib/api-auth'
import { fetchWordPool } from '@/lib/word-pool'
import { quizWeight, shuffle, weightedSampleWithoutReplacement } from '@/lib/weighted-sample'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { QuestionType, QuizQuestion } from '@/types/quiz'

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
  if (!questionType || !['是非題', '選擇題', '輸入題'].includes(questionType)) {
    return NextResponse.json({ error: '無效的題型' }, { status: 400 })
  }
  if (requested < 1) {
    return NextResponse.json({ error: '題數至少為 1' }, { status: 400 })
  }

  let pool
  try {
    pool = await fetchWordPool(auth.user.id, wordbookIds, tagIds)
  } catch (e) {
    const msg = e instanceof Error ? e.message : '篩選失敗'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  if (questionType === '選擇題' && pool.length < 4) {
    return NextResponse.json(
      { error: '選擇題單字池需至少 4 個單字，請擴大篩選範圍或改選其他題型', pool_size: pool.length },
      { status: 400 }
    )
  }
  if (questionType === '是非題' && pool.length < 2) {
    return NextResponse.json(
      { error: '是非題單字池需至少 2 個單字', pool_size: pool.length },
      { status: 400 }
    )
  }
  if (pool.length === 0) {
    return NextResponse.json({ error: '篩選結果沒有單字', pool_size: 0 }, { status: 400 })
  }

  const selected = weightedSampleWithoutReplacement(
    pool,
    (w) => quizWeight(w.attempt_count, w.correct_count),
    requested
  )

  const questions: QuizQuestion[] = selected.map((word) => {
    if (questionType === '輸入題') {
      // 填空：顯示中文，使用者輸入外文單字
      return { word_id: word.id, prompt: word.answer }
    }

    const base: QuizQuestion = { word_id: word.id, term: word.term }

    if (questionType === '是非題') {
      const askTrue = Math.random() < 0.5
      if (askTrue) {
        base.display_answer = word.answer
      } else {
        const others = pool.filter((w) => w.id !== word.id)
        const distractor = others[Math.floor(Math.random() * others.length)]
        base.display_answer = distractor.answer
      }
    } else if (questionType === '選擇題') {
      const distractors = shuffle(pool.filter((w) => w.id !== word.id))
        .slice(0, 3)
        .map((w) => w.answer)
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
    questions,
  })
}
