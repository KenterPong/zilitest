import { NextResponse } from 'next/server'

import { assertCanMutate, requireUser } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> }

async function getOwnedTag(userId: string, id: string) {
  const { data } = await supabaseAdmin
    .from('tags')
    .select('id, user_id, name')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireUser()
  if (auth.error) return auth.error

  const blocked = assertCanMutate(auth.user)
  if (blocked) return blocked

  const { id } = await context.params
  const existing = await getOwnedTag(auth.user.id, id)
  if (!existing) {
    return NextResponse.json({ error: '找不到標籤' }, { status: 404 })
  }

  let body: { name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '無效的 JSON' }, { status: 400 })
  }

  const name = body.name?.trim()
  if (!name) {
    return NextResponse.json({ error: '請輸入標籤名稱' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('tags')
    .update({ name })
    .eq('id', id)
    .select('id, user_id, name')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: '此標籤名稱已存在' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ tag: data })
}

export async function DELETE(_request: Request, context: Ctx) {
  const auth = await requireUser()
  if (auth.error) return auth.error

  const blocked = assertCanMutate(auth.user)
  if (blocked) return blocked

  const { id } = await context.params
  const existing = await getOwnedTag(auth.user.id, id)
  if (!existing) {
    return NextResponse.json({ error: '找不到標籤' }, { status: 404 })
  }

  const { error } = await supabaseAdmin.from('tags').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
