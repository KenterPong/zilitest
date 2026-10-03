import { NextResponse } from 'next/server'

import { assertCanMutate, requireUser } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { listWordbooksForUser } from '@/lib/vocab-queries'
import { isLanguage, type DbWordbook, type WordbookWithCount } from '@/types/vocab'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireUser()
  if (auth.error) return auth.error

  try {
    const wordbooks = await listWordbooksForUser(auth.user.id)
    return NextResponse.json({ wordbooks })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '讀取失敗'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireUser()
  if (auth.error) return auth.error

  const blocked = assertCanMutate(auth.user)
  if (blocked) return blocked

  let body: { name?: string; language?: unknown }
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
  if (!isLanguage(body.language)) {
    return NextResponse.json({ error: '請選擇單字本語言' }, { status: 400 })
  }

  // 同一交易內建立單字本與該語言設定（首次建立該語言時）
  const { data, error } = await supabaseAdmin.rpc('create_wordbook', {
    p_user_id: auth.user.id,
    p_name: name,
    p_language: body.language,
  })

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? '建立失敗' }, { status: 500 })
  }

  const book = data as DbWordbook
  const wordbook: WordbookWithCount = {
    id: book.id,
    user_id: book.user_id,
    name: book.name,
    language: book.language,
    created_at: book.created_at,
    word_count: 0,
  }
  return NextResponse.json({ wordbook }, { status: 201 })
}
