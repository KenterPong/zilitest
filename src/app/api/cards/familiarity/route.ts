import { NextResponse } from 'next/server'

import { assertCanMutate, requireUser } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const auth = await requireUser()
  if (auth.error) return auth.error

  const blocked = assertCanMutate(auth.user)
  if (blocked) return blocked

  let body: { word_id?: string; familiarity?: 'unknown' | 'known' }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '無效的 JSON' }, { status: 400 })
  }

  if (!body.word_id || !['unknown', 'known'].includes(body.familiarity ?? '')) {
    return NextResponse.json({ error: '參數無效' }, { status: 400 })
  }

  const { data: word } = await supabaseAdmin
    .from('words')
    .select('id, wordbook_id')
    .eq('id', body.word_id)
    .maybeSingle()

  if (!word) {
    return NextResponse.json({ error: '找不到單字' }, { status: 404 })
  }

  const { data: book } = await supabaseAdmin
    .from('wordbooks')
    .select('id')
    .eq('id', word.wordbook_id)
    .eq('user_id', auth.user.id)
    .maybeSingle()

  if (!book) {
    return NextResponse.json({ error: '找不到單字' }, { status: 404 })
  }

  const { error } = await supabaseAdmin.from('card_familiarity').upsert(
    {
      word_id: body.word_id,
      user_id: auth.user.id,
      familiarity: body.familiarity,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'word_id' }
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
