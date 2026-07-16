import { NextResponse } from 'next/server'

import { assertCanMutate, requireUser } from '@/lib/api-auth'
import { fetchWordPool } from '@/lib/word-pool'
import { cardWeight, weightedSampleWithoutReplacement } from '@/lib/weighted-sample'

export const runtime = 'nodejs'

/** 取得卡牌背誦佇列（加權隨機排序） */
export async function POST(request: Request) {
  const auth = await requireUser()
  if (auth.error) return auth.error

  const blocked = assertCanMutate(auth.user)
  if (blocked) return blocked

  let body: { wordbook_ids?: string[]; tag_ids?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '無效的 JSON' }, { status: 400 })
  }

  const wordbookIds = Array.isArray(body.wordbook_ids) ? body.wordbook_ids : []
  const tagIds = Array.isArray(body.tag_ids) ? body.tag_ids : []

  if (wordbookIds.length === 0) {
    return NextResponse.json({ error: '請至少選擇一本單字本' }, { status: 400 })
  }

  let pool
  try {
    pool = await fetchWordPool(auth.user.id, wordbookIds, tagIds)
  } catch (e) {
    const msg = e instanceof Error ? e.message : '篩選失敗'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  if (pool.length === 0) {
    return NextResponse.json({ error: '篩選結果沒有單字', pool_size: 0 }, { status: 400 })
  }

  const ordered = weightedSampleWithoutReplacement(
    pool,
    (w) => cardWeight(w.familiarity),
    pool.length
  )

  return NextResponse.json({
    pool_size: pool.length,
    cards: ordered.map((w) => ({
      word_id: w.id,
      term: w.term,
      answer: w.answer,
      description: w.description,
      familiarity: w.familiarity,
    })),
  })
}
