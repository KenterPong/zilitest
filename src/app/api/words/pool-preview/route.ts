import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/api-auth'
import { fetchWordPool } from '@/lib/word-pool'

export const runtime = 'nodejs'

/** 預覽篩選池大小（測驗／卡牌設定用） */
export async function POST(request: Request) {
  const auth = await requireUser()
  if (auth.error) return auth.error

  let body: { wordbook_ids?: string[]; tag_ids?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '無效的 JSON' }, { status: 400 })
  }

  const wordbookIds = Array.isArray(body.wordbook_ids) ? body.wordbook_ids : []
  const tagIds = Array.isArray(body.tag_ids) ? body.tag_ids : []

  if (wordbookIds.length === 0) {
    return NextResponse.json({ pool_size: 0 })
  }

  try {
    const pool = await fetchWordPool(auth.user.id, wordbookIds, tagIds)
    return NextResponse.json({ pool_size: pool.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '查詢失敗'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
