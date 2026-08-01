import { NextResponse } from 'next/server'

import { clearUserSessionCookie } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  clearUserSessionCookie(response)
  return response
}
