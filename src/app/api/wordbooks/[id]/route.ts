import { NextResponse } from 'next/server'

import { assertCanMutate, requireUser } from '@/lib/api-auth'
import { recalculateWordCount } from '@/lib/word-count'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> }

async function getOwnedWordbook(userId: string, id: string) {
  const { data, error } = await supabaseAdmin
    .from('wordbooks')
    .select('id, user_id, name, created_at')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function GET(_request: Request, context: Ctx) {
  const auth = await requireUser()
  if (auth.error) return auth.error

  const { id } = await context.params
  try {
    const book = await getOwnedWordbook(auth.user.id, id)
    if (!book) {
      return NextResponse.json({ error: '找不到單字本' }, { status: 404 })
    }

    const { count, error } = await supabaseAdmin
      .from('words')
      .select('id', { count: 'exact', head: true })
      .eq('wordbook_id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      wordbook: { ...book, word_count: count ?? 0 },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '查詢失敗'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireUser()
  if (auth.error) return auth.error

  const blocked = assertCanMutate(auth.user)
  if (blocked) return blocked

  const { id } = await context.params
  const book = await getOwnedWordbook(auth.user.id, id)
  if (!book) {
    return NextResponse.json({ error: '找不到單字本' }, { status: 404 })
  }

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
    .update({ name })
    .eq('id', id)
    .select('id, user_id, name, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ wordbook: data })
}

export async function DELETE(_request: Request, context: Ctx) {
  const auth = await requireUser()
  if (auth.error) return auth.error

  const blocked = assertCanMutate(auth.user)
  if (blocked) return blocked

  const { id } = await context.params
  const book = await getOwnedWordbook(auth.user.id, id)
  if (!book) {
    return NextResponse.json({ error: '找不到單字本' }, { status: 404 })
  }

  const { error } = await supabaseAdmin.from('wordbooks').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  try {
    await recalculateWordCount(auth.user.id)
  } catch (e) {
    const msg = e instanceof Error ? e.message : '更新字數失敗'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
