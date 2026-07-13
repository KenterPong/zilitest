import { NextResponse } from 'next/server'

import { clearUserSessionCookie, getSessionUser } from '@/lib/auth'

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
