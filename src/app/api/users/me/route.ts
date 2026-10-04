import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/api-auth'
import { clearUserSessionCookie, getSessionUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    const response = NextResponse.json({ error: '未登入' }, { status: 401 })
    clearUserSessionCookie(response)
    return response
  }

  if (user.status === 'cancelled') {
    const response = NextResponse.json({ error: '帳號已刪除' }, { status: 401 })
    clearUserSessionCookie(response)
    return response
  }

  return NextResponse.json({ user })
}

/** 刪除帳號：任何狀態皆可，立即清空所有資料（含改善建議、Email），不退款不遞延 */
export async function DELETE() {
  const auth = await requireUser()
  if (auth.error) return auth.error

  const { error } = await supabaseAdmin.rpc('delete_account', { p_user_id: auth.user.id })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const response = NextResponse.json({ ok: true })
  clearUserSessionCookie(response)
  return response
}
