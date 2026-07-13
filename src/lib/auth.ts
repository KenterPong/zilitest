import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { TRIAL_DAYS, USER_ID_COOKIE, type DbUser } from '@/types/user'

export function trialEndFromNow(): Date {
  return new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
}

export function buildTrialFields() {
  const now = new Date()
  return {
    status: 'trial' as const,
    trial_start_at: now.toISOString(),
    trial_end_at: trialEndFromNow().toISOString(),
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
  return data as DbUser
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
