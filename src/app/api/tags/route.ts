import { NextResponse } from 'next/server'

import { assertCanMutate, requireUser } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireUser()
  if (auth.error) return auth.error

  const { data, error } = await supabaseAdmin
    .from('tags')
    .select('id, user_id, name')
    .eq('user_id', auth.user.id)
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ tags: data ?? [] })
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
    return NextResponse.json({ error: '請輸入標籤名稱' }, { status: 400 })
  }
  if (name.length > 40) {
    return NextResponse.json({ error: '標籤名稱不可超過 40 字' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('tags')
    .insert({ user_id: auth.user.id, name })
    .select('id, user_id, name')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: '此標籤名稱已存在' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ tag: data }, { status: 201 })
}
