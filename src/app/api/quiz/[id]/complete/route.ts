import { NextResponse } from 'next/server'

import {
  buildAnswerDiff,
  fillDiffTarget,
  formatTermWithReading,
  isFillAnswerCorrect,
} from '@/lib/answer-match'
import { assertCanMutate, requireUser } from '@/lib/api-auth'
import { toProgressState } from '@/lib/daily-service'
import { fetchByIds } from '@/lib/db-paging'
import { refreshPeakMastered, unlockAchievements } from '@/lib/growth-service'
import { applyAnswer, type ProgressState } from '@/lib/progress'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { taipeiToday } from '@/lib/taipei-date'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> }

interface AnswerPayload {
  word_id: string
  /** 是非題：使用者是否認為配對正確 */
  user_says_true?: boolean
  /** 是非題：畫面上顯示的翻譯 */
  display_answer?: string
  /** 選擇題：選到的選項文字 */
  selected_answer?: string
  /** 輸入題：使用者輸入 */
  user_input?: string
}

export async function POST(request: Request, context: Ctx) {
  const auth = await requireUser()
  if (auth.error) return auth.error

  const blocked = assertCanMutate(auth.user)
  if (blocked) return blocked

  const { id: sessionId } = await context.params

  const { data: session } = await supabaseAdmin
    .from('quiz_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', auth.user.id)
    .maybeSingle()

  if (!session) {
    return NextResponse.json({ error: '找不到測驗場次' }, { status: 404 })
  }
  if (session.mode !== 'free_practice') {
    return NextResponse.json({ error: '每日任務請逐題作答' }, { status: 400 })
  }
  if (session.completed_at) {
    return NextResponse.json({ error: '此測驗已結束' }, { status: 400 })
  }

  let body: { answers?: AnswerPayload[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '無效的 JSON' }, { status: 400 })
  }

  const answers = Array.isArray(body.answers) ? body.answers : []
  if (answers.length === 0) {
    return NextResponse.json({ error: '沒有作答紀錄' }, { status: 400 })
  }

  const wordIds = Array.from(new Set(answers.map((a) => a.word_id)))
  let words: {
    id: string
    term: string
    reading: string | null
    answer: string
    wordbook_id: string
  }[]
  let progressRows: (ProgressState & { word_id: string })[]
  try {
    ;[words, progressRows] = await Promise.all([
      fetchByIds(wordIds, (ids) =>
        supabaseAdmin
          .from('words')
          .select('id, term, reading, answer, wordbook_id, wordbooks!inner(user_id)')
          .eq('wordbooks.user_id', auth.user.id)
          .in('id', ids)
      ),
      fetchByIds(wordIds, (ids) =>
        supabaseAdmin
          .from('word_progress')
          .select('*')
          .eq('user_id', auth.user.id)
          .in('word_id', ids)
      ),
    ])
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '讀取失敗' }, { status: 500 })
  }

  // 只查使用者自己單字本內的字，不在 map 內即視為無效
  const wordMap = new Map(words.map((w) => [w.id, w] as const))
  const progressMap = new Map(progressRows.map((p) => [p.word_id, toProgressState(p)] as const))

  const results: {
    word_id: string
    term: string
    prompt: string
    correct_answer: string
    is_correct: boolean
    user_input?: string
    display_answer?: string
    selected_answer?: string
    user_says_true?: boolean
    diff: ReturnType<typeof buildAnswerDiff>
  }[] = []

  const answerRows: { word_id: string; is_correct: boolean; progress: unknown }[] = []
  const answeredInSession = new Set<string>()
  const today = taipeiToday()
  const nowIso = new Date().toISOString()
  let becameMastered = false
  let correctCount = 0

  for (const ans of answers) {
    const word = wordMap.get(ans.word_id)
    if (!word) {
      return NextResponse.json({ error: '含有無效單字' }, { status: 400 })
    }

    let isCorrect = false
    if (session.question_type === '是非題') {
      const display = (ans.display_answer ?? '').trim()
      const pairIsTrue = display === word.answer
      isCorrect = Boolean(ans.user_says_true) === pairIsTrue
    } else if (session.question_type === '選擇題') {
      isCorrect = (ans.selected_answer ?? '').trim() === word.answer
    } else {
      // 填空：顯示中文，輸入外文 → 比對 term
      isCorrect = isFillAnswerCorrect(ans.user_input ?? '', word.term, word.reading)
    }

    if (isCorrect) correctCount++

    // 自由練習：答錯降級；到期答對才升級；stage 0 的字不引入（同場次同字只算第一次）
    if (!answeredInSession.has(word.id)) {
      answeredInSession.add(word.id)
      const outcome = applyAnswer(progressMap.get(word.id) ?? null, {
        isCorrect,
        isNewIntroduction: false,
        today,
        now: nowIso,
      })
      if (outcome.changed) progressMap.set(word.id, outcome.next)
      if (outcome.becameMastered) becameMastered = true
      answerRows.push({
        word_id: word.id,
        is_correct: isCorrect,
        progress: outcome.changed ? outcome.next : null,
      })
    }

    results.push({
      word_id: word.id,
      term: word.term,
      prompt: word.answer,
      correct_answer:
        session.question_type === '輸入題'
          ? formatTermWithReading(word.term, word.reading)
          : word.answer,
      is_correct: isCorrect,
      user_input: ans.user_input,
      display_answer: ans.display_answer,
      selected_answer: ans.selected_answer,
      user_says_true: ans.user_says_true,
      diff:
        session.question_type === '輸入題' && !isCorrect
          ? buildAnswerDiff(
              ans.user_input ?? '',
              fillDiffTarget(ans.user_input ?? '', word.term, word.reading)
            )
          : null,
    })
  }

  // 作答紀錄、word_stats、熟練度於同一交易寫入
  const { error: recErr } = await supabaseAdmin.rpc('record_answers', {
    p_user_id: auth.user.id,
    p_session_id: sessionId,
    p_answers: answerRows,
  })
  if (recErr) {
    return NextResponse.json({ error: recErr.message }, { status: 500 })
  }

  let newAchievements: string[] = []
  if (becameMastered) {
    try {
      await refreshPeakMastered(auth.user.id)
      newAchievements = await unlockAchievements(auth.user.id, auth.user.current_streak)
    } catch {
      // 成就檢查失敗不影響測驗結果
    }
  }

  const now = nowIso
  const score = answers.length > 0 ? correctCount / answers.length : 0
  await supabaseAdmin
    .from('quiz_sessions')
    .update({
      completed_at: now,
      score,
    })
    .eq('id', sessionId)

  return NextResponse.json({
    session_id: sessionId,
    question_type: session.question_type,
    total: answers.length,
    correct: correctCount,
    wrong: answers.length - correctCount,
    score,
    results,
    new_achievements: newAchievements,
  })
}
