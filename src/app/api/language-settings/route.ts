import { NextResponse } from 'next/server'

import { assertCanMutate, requireUser } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isLanguage } from '@/types/vocab'

export const runtime = 'nodejs'

const MAX_DAILY_LIMIT = 200

function parseLimit(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0 || n > MAX_DAILY_LIMIT) return null
  return n
}

/** 更新某語言的每日任務設定；當日已產生的任務不變，自隔日生效 */
export async function PATCH(request: Request) {
  const auth = await requireUser()
  if (auth.error) return auth.error

  const blocked = assertCanMutate(auth.user)
  if (blocked) return blocked

  let body: {
    language?: unknown
    enabled?: unknown
    daily_review_limit?: unknown
    daily_new_limit?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '無效的 JSON' }, { status: 400 })
  }

  if (!isLanguage(body.language)) {
    return NextResponse.json({ error: '無效的語言' }, { status: 400 })
  }

  const update: Record<string, boolean | number> = {}
  if (body.enabled !== undefined) {
    if (typeof body.enabled !== 'boolean') {
      return NextResponse.json({ error: '無效的啟用設定' }, { status: 400 })
    }
    update.enabled = body.enabled
  }
  for (const key of ['daily_review_limit', 'daily_new_limit'] as const) {
    const n = parseLimit(body[key])
    if (n === null) {
      return NextResponse.json(
        { error: `每日數量須為 0–${MAX_DAILY_LIMIT} 的整數` },
        { status: 400 }
      )
    }
    if (n !== undefined) update[key] = n
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: '沒有要更新的設定' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('user_language_settings')
    .update(update)
    .eq('user_id', auth.user.id)
    .eq('language', body.language)
    .select('*')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: '尚未建立此語言的單字本' }, { status: 404 })
  }
  return NextResponse.json({ settings: data })
}
