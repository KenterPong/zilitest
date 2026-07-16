import { NextResponse } from 'next/server'

import { isExactAnswerMatch, buildAnswerDiff } from '@/lib/answer-match'
import { assertCanMutate, requireUser } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

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

  const wordIds = answers.map((a) => a.word_id)
  const { data: words } = await supabaseAdmin
    .from('words')
    .select('id, term, answer, wordbook_id')
    .in('id', wordIds)

  const wordMap = new Map((words ?? []).map((w) => [w.id, w] as const))

  // 確認單字屬於使用者的單字本
  const bookIds = Array.from(new Set((words ?? []).map((w) => w.wordbook_id)))
  const { data: books } = await supabaseAdmin
    .from('wordbooks')
    .select('id')
    .eq('user_id', auth.user.id)
    .in('id', bookIds)

  const ownedBooks = new Set((books ?? []).map((b) => b.id))

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

  const answerRows: { session_id: string; word_id: string; is_correct: boolean }[] = []
  let correctCount = 0

  for (const ans of answers) {
    const word = wordMap.get(ans.word_id)
    if (!word || !ownedBooks.has(word.wordbook_id)) {
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
      isCorrect = isExactAnswerMatch(ans.user_input ?? '', word.term)
    }

    if (isCorrect) correctCount++
    answerRows.push({ session_id: sessionId, word_id: word.id, is_correct: isCorrect })

    results.push({
      word_id: word.id,
      term: word.term,
      prompt: word.answer,
      correct_answer:
        session.question_type === '輸入題' ? word.term : word.answer,
      is_correct: isCorrect,
      user_input: ans.user_input,
      display_answer: ans.display_answer,
      selected_answer: ans.selected_answer,
      user_says_true: ans.user_says_true,
      diff:
        session.question_type === '輸入題' && !isCorrect
          ? buildAnswerDiff(ans.user_input ?? '', word.term)
          : null,
    })
  }

  const { error: insertErr } = await supabaseAdmin.from('quiz_answers').insert(answerRows)
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  // 更新 word_stats
  const now = new Date().toISOString()
  for (const row of answerRows) {
    const { data: existing } = await supabaseAdmin
      .from('word_stats')
      .select('word_id, attempt_count, correct_count')
      .eq('word_id', row.word_id)
      .maybeSingle()

    if (existing) {
      await supabaseAdmin
        .from('word_stats')
        .update({
          attempt_count: existing.attempt_count + 1,
          correct_count: existing.correct_count + (row.is_correct ? 1 : 0),
          last_tested_at: now,
        })
        .eq('word_id', row.word_id)
    } else {
      await supabaseAdmin.from('word_stats').insert({
        word_id: row.word_id,
        user_id: auth.user.id,
        attempt_count: 1,
        correct_count: row.is_correct ? 1 : 0,
        last_tested_at: now,
      })
    }
  }

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
  })
}
