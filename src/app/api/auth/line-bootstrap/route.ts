import { NextRequest, NextResponse } from 'next/server'

import {
  buildLineAuthorizeUrl,
  createLineOAuthState,
  preferManualLineLoginNavigation,
} from '@/lib/line-login-oauth'
import {
  LINE_OAUTH_STATE_COOKIE_NAME,
  lineOAuthStateCookieDomain,
} from '@/lib/line-oauth-state'

export async function GET(request: NextRequest) {
  const hostHeader = request.headers.get('host') ?? 'localhost'
  const state = createLineOAuthState()
  const domain = lineOAuthStateCookieDomain(hostHeader)

  let authorizeUrl: string
  try {
    authorizeUrl = buildLineAuthorizeUrl(state)
  } catch {
    return NextResponse.json(
      { error: 'LINE OAuth 環境變數未設定' },
      { status: 500 },
    )
  }

  const ua = request.headers.get('user-agent') ?? ''
  const dest = preferManualLineLoginNavigation(ua)
    ? new URL('/auth/login/in-app', request.url)
    : authorizeUrl

  const response = NextResponse.redirect(dest)
  response.cookies.set(LINE_OAUTH_STATE_COOKIE_NAME, state, {
    path: '/',
    maxAge: 600,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    ...(domain ? { domain } : {}),
  })

  return response
}
