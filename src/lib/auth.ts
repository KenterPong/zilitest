import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { buildSuspension, timedSuspension } from '@/lib/account-state'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  EARLY_BIRD_END_DATE,
  TRIAL_DAYS,
  USER_ID_COOKIE,
  type DbUser,
} from '@/types/user'

export function trialEndFromNow(): Date {
  return new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
}

/** 早鳥到期：2027-12-31 23:59:59 Asia/Taipei → ISO UTC */
export function earlyBirdTrialEndAt(): Date {
  // 台北 UTC+8：2027-12-31 23:59:59 = 2027-12-31 15:59:59Z
  return new Date(`${EARLY_BIRD_END_DATE}T15:59:59.000Z`)
}

export function formatTrialEndDate(endAt: string | null): string {
  if (!endAt) return '—'
  return new Date(endAt).toLocaleDateString('zh-TW', {
    timeZone: 'Asia/Taipei',
  })
}

/** cancelled 再登入／非早鳥一般試用欄位（不含 is_early_bird 時預設 false） */
export function buildTrialFields(options?: { earlyBird?: boolean }) {
  const now = new Date()
  const earlyBird = options?.earlyBird === true
  return {
    status: 'trial' as const,
    is_early_bird: earlyBird,
    trial_start_at: now.toISOString(),
    trial_end_at: earlyBird
      ? earlyBirdTrialEndAt().toISOString()
      : trialEndFromNow().toISOString(),
    word_count: 0,
    auto_renew: true,
    first_paid_at: null,
    next_billing_at: null,
    payment_failed_at: null,
    grace_period_end_at: null,
    suspended_at: null,
    data_purge_scheduled_at: null,
    last_reminder_sent_at: null,
    cancelled_at: null,
    current_streak: 0,
    longest_streak: 0,
    last_streak_date: null,
    streak_frozen_at: null,
  }
}

export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(USER_ID_COOKIE)?.value ?? null
}

export async function getSessionUser(): Promise<DbUser | null> {
  const userId = await getSessionUserId()
  if (!userId) return null

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) return null
  return applyTimedTransition(data as DbUser)
}

/**
 * 時間到期的狀態轉換（試用到期、寬限期滿、取消訂閱到期 → suspended），
 * 於讀取 session 時 lazy 執行，不需 cron。
 * 以「狀態仍是讀到的值」為條件更新，併發請求只有一個會寫入。
 */
async function applyTimedTransition(user: DbUser): Promise<DbUser> {
  const now = new Date()
  if (timedSuspension(user, now) === null) return user

  const update = buildSuspension(
    {
      current_streak: user.current_streak,
      longest_streak: user.longest_streak,
      last_streak_date: user.last_streak_date,
    },
    now
  )
  const { data } = await supabaseAdmin
    .from('users')
    .update(update)
    .eq('id', user.id)
    .eq('status', user.status)
    .select('*')
    .maybeSingle()
  if (data) return data as DbUser

  // 其他請求已先轉換：重新讀取最新狀態
  const { data: latest } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()
  return (latest as DbUser | null) ?? user
}

export function clearUserSessionCookie(response: NextResponse) {
  response.cookies.set(USER_ID_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
}

export function setUserSessionCookie(response: NextResponse, userId: string) {
  response.cookies.set(USER_ID_COOKIE, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
}

export function daysRemaining(endAt: string | null): number | null {
  if (!endAt) return null
  const diff = new Date(endAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)))
}
