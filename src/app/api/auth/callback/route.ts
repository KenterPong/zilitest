import { NextRequest, NextResponse } from 'next/server'

import { buildTrialFields, setUserSessionCookie } from '@/lib/auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

interface LineProfile {
  userId: string
  displayName: string
  pictureUrl?: string
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
        { status: 401 },
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

    const { data: existing, error: existingError } = await supabase
      .from('users')
      .select('id, status')
      .eq('line_user_id', profile.userId)
      .maybeSingle()

    if (existingError) {
      console.error('User lookup error:', existingError)
      return NextResponse.json(
        {
          error: '讀取帳號失敗',
          details: {
            message: existingError.message,
            code: existingError.code,
            hint: existingError.hint,
          },
        },
        { status: 500 },
      )
    }

    let userId: string

    if (!existing) {
      const { data: created, error } = await supabase
        .from('users')
        .insert({
          line_user_id: profile.userId,
          display_name: profile.displayName,
          avatar_url: profile.pictureUrl ?? null,
          ...buildTrialFields(),
        })
        .select('id')
        .single()

      if (error || !created) {
        console.error('User insert error:', error)
        return NextResponse.json(
          {
            error: '建立帳號失敗',
            details: error
              ? {
                  message: error.message,
                  code: error.code,
                  hint: error.hint,
                  details: error.details,
                }
              : null,
          },
          { status: 500 },
        )
      }
      userId = created.id
    } else if (existing.status === 'cancelled') {
      const { data: revived, error } = await supabase
        .from('users')
        .update({
          display_name: profile.displayName,
          avatar_url: profile.pictureUrl ?? null,
          ...buildTrialFields(),
        })
        .eq('id', existing.id)
        .select('id')
        .single()

      if (error || !revived) {
        console.error('User revive error:', error)
        return NextResponse.json(
          {
            error: '重新啟用帳號失敗',
            details: error
              ? { message: error.message, code: error.code, hint: error.hint }
              : null,
          },
          { status: 500 },
        )
      }
      userId = revived.id
    } else {
      const { data: updated, error } = await supabase
        .from('users')
        .update({
          display_name: profile.displayName,
          avatar_url: profile.pictureUrl ?? null,
        })
        .eq('id', existing.id)
        .select('id')
        .single()

      if (error || !updated) {
        console.error('User update error:', error)
        return NextResponse.json(
          {
            error: '更新帳號失敗',
            details: error
              ? { message: error.message, code: error.code, hint: error.hint }
              : null,
          },
          { status: 500 },
        )
      }
      userId = updated.id
    }

    const response = NextResponse.json({ ok: true })
    setUserSessionCookie(response, userId)
    return response
  } catch (error) {
    console.error('Auth callback error:', error)
    const message = error instanceof Error ? error.message : '未知錯誤'
    return NextResponse.json({ error: '伺服器錯誤', details: message }, { status: 500 })
  }
}
