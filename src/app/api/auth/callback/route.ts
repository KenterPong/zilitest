import { NextRequest, NextResponse } from 'next/server'

import { setUserSessionCookie } from '@/lib/auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

interface LineProfile {
  userId: string
  displayName: string
  pictureUrl?: string
}

interface RegisteredUser {
  id: string
}

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json()

    if (!code) {
      return NextResponse.json({ error: '缺少授權碼' }, { status: 400 })
    }

    const lineCallback = process.env.LINE_CALLBACK_URL
    const lineClientId = process.env.LINE_CLIENT_ID
    const lineClientSecret = process.env.LINE_CLIENT_SECRET

    if (!lineCallback || !lineClientId || !lineClientSecret) {
      return NextResponse.json({ error: 'LINE OAuth 環境變數未設定' }, { status: 500 })
    }

    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: lineCallback,
        client_id: lineClientId,
        client_secret: lineClientSecret,
      }),
    })

    if (!tokenRes.ok) {
      let details: unknown = null
      try {
        details = await tokenRes.json()
      } catch {
        details = null
      }
      return NextResponse.json(
        { error: 'LINE 驗證失敗', details, status: tokenRes.status },
        { status: 401 }
      )
    }

    const tokenData = await tokenRes.json()

    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    if (!profileRes.ok) {
      return NextResponse.json({ error: '取得 LINE 個人資料失敗' }, { status: 401 })
    }

    const profile = (await profileRes.json()) as LineProfile
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase.rpc('register_line_user', {
      p_line_user_id: profile.userId,
      p_display_name: profile.displayName,
      p_avatar_url: profile.pictureUrl ?? null,
    })

    if (error || !data) {
      console.error('register_line_user error:', error)
      return NextResponse.json(
        {
          error: '帳號處理失敗',
          details: error
            ? {
                message: error.message,
                code: error.code,
                hint: error.hint,
              }
            : null,
        },
        { status: 500 }
      )
    }

    const user = data as RegisteredUser
    if (!user.id) {
      return NextResponse.json({ error: '帳號處理失敗：缺少使用者 id' }, { status: 500 })
    }

    const response = NextResponse.json({ ok: true })
    setUserSessionCookie(response, user.id)
    return response
  } catch (error) {
    console.error('Auth callback error:', error)
    const message = error instanceof Error ? error.message : '未知錯誤'
    return NextResponse.json({ error: '伺服器錯誤', details: message }, { status: 500 })
  }
}
