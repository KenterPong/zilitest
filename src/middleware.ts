import { NextRequest, NextResponse } from 'next/server'

import { USER_ID_COOKIE } from '@/types/user'

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? ''
  const hostname = host.split(':')[0].toLowerCase()
  const pathname = req.nextUrl.pathname.replace(/\/+$/, '') || '/'

  const lineCallbackBase = process.env.NEXT_PUBLIC_LINE_CALLBACK_URL?.trim()
  if (lineCallbackBase && pathname.startsWith('/auth/callback')) {
    try {
      const expected = new URL(lineCallbackBase)
      if (hostname !== expected.hostname.toLowerCase()) {
        const dest = new URL(req.nextUrl.pathname + req.nextUrl.search, expected.origin)
        return NextResponse.redirect(dest)
      }
    } catch {
      // ignore invalid env
    }
  }

  if (pathname.startsWith('/app')) {
    const userId = req.cookies.get(USER_ID_COOKIE)?.value
    if (!userId) {
      return NextResponse.redirect(new URL('/api/auth/line-bootstrap', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'],
}
