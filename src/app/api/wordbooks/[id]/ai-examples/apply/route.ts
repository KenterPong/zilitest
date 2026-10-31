import { NextResponse } from 'next/server'

import { assertCanMutate, requireUser } from '@/lib/api-auth'
import { exampleColumns, verifyExample, wordScope } from '@/lib/example-sign'
import { MAX_EXAMPLE_WORDS } from '@/lib/extraction'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> }

/**
 * AI 補例句確認寫入（技術規格 v5 第十節 8.）：只寫入簽章有效、且目前仍沒有例句的字（不覆蓋）。
 * 寫入後把該次 ai_extractions.result_count 更新為實際寫入的字數
 */
export async function POST(request: Request, context: Ctx) {
  const auth = await requireUser()
  if (auth.error) return auth.error

  const blocked = assertCanMutate(auth.user)
  if (blocked) return blocked

  const { id: wordbookId } = await context.params

  let body: { extraction_id?: unknown; items?: { word_id?: unknown; example?: unknown; example_sig?: unknown }[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '無效的 JSON' }, { status: 400 })
  }

  const items = Array.isArray(body.items) ? body.items.slice(0, MAX_EXAMPLE_WORDS) : []
  const ids = items.map((i) => i.word_id).filter((id): id is string => typeof id === 'string')
  if (ids.length === 0) {
    return NextResponse.json({ error: '沒有要寫入的例句' }, { status: 400 })
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

  const { data: words, error } = await supabaseAdmin
    .from('words')
    .select('id, term')
    .eq('wordbook_id', wordbookId)
    .is('example', null)
    .in('id', ids)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const termById = new Map((words ?? []).map((w) => [w.id, w.term as string]))

  const now = new Date().toISOString()
  let written = 0
  for (const item of items) {
    const term = typeof item.word_id === 'string' ? termById.get(item.word_id) : undefined
    if (term === undefined) continue
    const example = verifyExample(wordScope(auth.user.id, item.word_id as string, term), item.example, item.example_sig)
    if (!example) continue
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('words')
      .update(exampleColumns(example, now))
      .eq('id', item.word_id as string)
      .is('example', null)
      .select('id')
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }
    written += updated?.length ?? 0
  }

  if (typeof body.extraction_id === 'string') {
    await supabaseAdmin
      .from('ai_extractions')
      .update({ result_count: written })
      .eq('id', body.extraction_id)
      .eq('user_id', auth.user.id)
      .eq('kind', 'generate_examples')
  }

  return NextResponse.json({ written })
}
