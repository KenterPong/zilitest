import { NextResponse } from 'next/server'

import { assertCanMutate, requireUser } from '@/lib/api-auth'
import { DailyTaskError, submitDailyAnswer, type DailyAnswerInput } from '@/lib/daily-service'

export const runtime = 'nodejs'

const KINDS = ['new', 'mcq', 'fill'] as const

/** 每日任務逐題作答（中途離開可於當日續作） */
export async function POST(request: Request) {
  const auth = await requireUser()
  if (auth.error) return auth.error

  const blocked = assertCanMutate(auth.user)
  if (blocked) return blocked

  let body: Partial<DailyAnswerInput>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '無效的 JSON' }, { status: 400 })
  }

  if (
    typeof body.task_id !== 'string' ||
    typeof body.word_id !== 'string' ||
    !KINDS.includes(body.kind as (typeof KINDS)[number])
  ) {
    return NextResponse.json({ error: '缺少作答資料' }, { status: 400 })
  }

  try {
    const result = await submitDailyAnswer(auth.user, {
      task_id: body.task_id,
      word_id: body.word_id,
      kind: body.kind!,
      selected_answer: typeof body.selected_answer === 'string' ? body.selected_answer : undefined,
      user_input: typeof body.user_input === 'string' ? body.user_input : undefined,
    })
    return NextResponse.json(result)
  } catch (e) {
    if (e instanceof DailyTaskError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    const msg = e instanceof Error ? e.message : '作答失敗'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
