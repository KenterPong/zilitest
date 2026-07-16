import { NextResponse } from 'next/server'

import { assertCanMutate, canAddWords, requireUser } from '@/lib/api-auth'
import { recalculateWordCount } from '@/lib/word-count'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

/** 批次新增單字（Excel／CSV 匯入用） */
export async function POST(request: Request) {
  const auth = await requireUser()
  if (auth.error) return auth.error

  const blocked = assertCanMutate(auth.user)
  if (blocked) return blocked

  let body: {
    wordbook_id?: string
    words?: { term: string; answer: string; description?: string | null }[]
    truncate_to_limit?: boolean
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '無效的 JSON' }, { status: 400 })
  }

  const wordbookId = body.wordbook_id
  if (!wordbookId) {
    return NextResponse.json({ error: '缺少 wordbook_id' }, { status: 400 })
  }

  const { data: book } = await supabaseAdmin
    .from('wordbooks')
    .select('id')
    .eq('id', wordbookId)
    .eq('user_id', auth.user.id)
    .maybeSingle()

  if (!book) {
    return NextResponse.json({ error: '找不到單字本' }, { status: 404 })
  }

  const raw = Array.isArray(body.words) ? body.words : []
  const cleaned = raw
    .map((w) => ({
      term: String(w.term ?? '').trim(),
      answer: String(w.answer ?? '').trim(),
      description: w.description?.toString().trim() || null,
    }))
    .filter((w) => w.term && w.answer)

  if (cleaned.length === 0) {
    return NextResponse.json({ error: '沒有可匯入的單字' }, { status: 400 })
  }

  let toInsert = cleaned
  if (auth.user.status === 'trial') {
    const remaining = Math.max(0, 500 - auth.user.word_count)
    if (cleaned.length > remaining) {
      if (!body.truncate_to_limit || remaining === 0) {
        const err = canAddWords(auth.user, cleaned.length)
        if (err) return err
      }
      toInsert = cleaned.slice(0, remaining)
    }
  }

  if (toInsert.length === 0) {
    return NextResponse.json(
      { error: '已達試用上限，無法再匯入', remaining: 0 },
      { status: 403 }
    )
  }

  const rows = toInsert.map((w) => ({
    wordbook_id: wordbookId,
    term: w.term,
    answer: w.answer,
    description: w.description,
  }))

  const { data: inserted, error } = await supabaseAdmin
    .from('words')
    .insert(rows)
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let wordCount: number
  try {
    wordCount = await recalculateWordCount(auth.user.id)
  } catch (e) {
    const msg = e instanceof Error ? e.message : '更新字數失敗'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json(
    {
      inserted: inserted?.length ?? toInsert.length,
      skipped: cleaned.length - toInsert.length,
      word_count: wordCount,
    },
    { status: 201 }
  )
}
