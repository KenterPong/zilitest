import { NextResponse } from 'next/server'

import { assertCanMutate, requireUser } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { WordbookWithCount } from '@/types/vocab'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireUser()
  if (auth.error) return auth.error

  const { data: books, error } = await supabaseAdmin
    .from('wordbooks')
    .select('id, user_id, name, created_at')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const list = books ?? []
  if (list.length === 0) {
    return NextResponse.json({ wordbooks: [] satisfies WordbookWithCount[] })
  }

  const ids = list.map((b) => b.id)
  const { data: words, error: wordsError } = await supabaseAdmin
    .from('words')
    .select('wordbook_id')
    .in('wordbook_id', ids)

  if (wordsError) {
    return NextResponse.json({ error: wordsError.message }, { status: 500 })
  }

  const countMap = new Map<string, number>()
  for (const w of words ?? []) {
    countMap.set(w.wordbook_id, (countMap.get(w.wordbook_id) ?? 0) + 1)
  }

  const wordbooks: WordbookWithCount[] = list.map((b) => ({
    ...b,
    word_count: countMap.get(b.id) ?? 0,
  }))

  return NextResponse.json({ wordbooks })
}

export async function POST(request: Request) {
  const auth = await requireUser()
  if (auth.error) return auth.error

  const blocked = assertCanMutate(auth.user)
  if (blocked) return blocked

  let body: { name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '無效的 JSON' }, { status: 400 })
  }

  const name = body.name?.trim()
  if (!name) {
    return NextResponse.json({ error: '請輸入單字本名稱' }, { status: 400 })
  }
  if (name.length > 80) {
    return NextResponse.json({ error: '名稱不可超過 80 字' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('wordbooks')
    .insert({ user_id: auth.user.id, name })
    .select('id, user_id, name, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ wordbook: { ...data, word_count: 0 } }, { status: 201 })
}
