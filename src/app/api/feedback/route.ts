import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { FEEDBACK_MAX_LENGTH } from '@/types/user'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const auth = await requireUser()
  if (auth.error) return auth.error

  let body: { content?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '無效的 JSON' }, { status: 400 })
  }

  const content = body.content?.trim() ?? ''
  if (!content) {
    return NextResponse.json({ error: '請輸入回饋內容' }, { status: 400 })
  }
  if (content.length > FEEDBACK_MAX_LENGTH) {
    return NextResponse.json(
      { error: `回饋內容不可超過 ${FEEDBACK_MAX_LENGTH} 字` },
      { status: 400 }
    )
  }

  const { data, error } = await supabaseAdmin
    .from('feedback')
    .insert({
      user_id: auth.user.id,
      content,
    })
    .select('id, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ feedback: data }, { status: 201 })
}
