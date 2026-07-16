import { NextResponse } from 'next/server'

import { clearUserSessionCookie, getSessionUser } from '@/lib/auth'
import type { DbUser } from '@/types/user'

type AuthOk = { user: DbUser; error?: undefined }
type AuthErr = { user?: undefined; error: NextResponse }

/** 需登入且非 cancelled；回傳 user 或已設好 cookie 清除的 401 */
export async function requireUser(): Promise<AuthOk | AuthErr> {
  const user = await getSessionUser()
  if (!user || user.status === 'cancelled') {
    const response = NextResponse.json(
      { error: user?.status === 'cancelled' ? '帳號已刪除' : '未登入' },
      { status: 401 }
    )
    clearUserSessionCookie(response)
    return { error: response }
  }
  return { user }
}

/** 可使用功能（非 suspended）；讀取類 API 可用 requireUser */
export function assertCanMutate(user: DbUser): NextResponse | null {
  if (user.status === 'suspended') {
    return NextResponse.json(
      { error: '帳號已暫停，僅可匯出資料。請先付費恢復。' },
      { status: 403 }
    )
  }
  return null
}

export function canAddWords(user: DbUser, addCount: number): NextResponse | null {
  if (user.status !== 'trial') return null
  if (user.word_count + addCount > 500) {
    return NextResponse.json(
      {
        error: `試用期單字上限 500 個（帳號全站加總）。目前 ${user.word_count} 個，本次欲新增 ${addCount} 個。`,
        word_count: user.word_count,
        limit: 500,
        remaining: Math.max(0, 500 - user.word_count),
      },
      { status: 403 }
    )
  }
  return null
}
