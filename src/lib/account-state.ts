/**
 * 帳號狀態機中「時間到期」與「付費恢復」的純函式（技術規格 v5 第一節 2.、第九節 4.）
 * 付款相關轉換（trial/suspended → active、扣款失敗）待 LINE Pay 串接後再補。
 */

import { checkStreakBreak, type StreakState } from '@/lib/streak'
import { diffDays, toTaipeiDate, type TaipeiDate } from '@/lib/taipei-date'
import type { DbUser } from '@/types/user'

/** 暫停後資料保留月數 */
export const DATA_RETENTION_MONTHS = 3

export type SuspensionReason = 'trial_expired' | 'grace_expired' | 'renewal_cancelled'

type TimedFields = Pick<
  DbUser,
  'status' | 'trial_end_at' | 'grace_period_end_at' | 'auto_renew' | 'next_billing_at'
>

function reached(at: string | null, now: Date): boolean {
  return at !== null && now.getTime() >= new Date(at).getTime()
}

/** 依時間判斷是否應轉為 suspended；不需轉換回傳 null */
export function timedSuspension(user: TimedFields, now: Date): SuspensionReason | null {
  switch (user.status) {
    case 'trial':
      // trial_end_at 為當日 23:59:59，超過才算到期
      return user.trial_end_at !== null && now.getTime() > new Date(user.trial_end_at).getTime()
        ? 'trial_expired'
        : null
    case 'payment_failed':
      return reached(user.grace_period_end_at, now) ? 'grace_expired' : null
    case 'active':
      // 取消訂閱（auto_renew = false）到達 next_billing_at：略過扣款、直接暫停
      return !user.auto_renew && reached(user.next_billing_at, now) ? 'renewal_cancelled' : null
    default:
      return null
  }
}

/** 日曆月相加；月底遇到較短月份時取該月最後一天（1/31 + 1 個月 = 2/28） */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime())
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + months)
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, lastDay))
  return d
}

export interface SuspensionUpdate {
  status: 'suspended'
  suspended_at: string
  data_purge_scheduled_at: string
  streak_frozen_at: string
  current_streak: number
}

/**
 * 轉為暫停時要寫入的欄位。
 * 凍結前先做一次連續天數中斷判定：若暫停前就已中斷（久未使用），凍結的是 0，而非過期的舊數字。
 */
export function buildSuspension(streak: StreakState, now: Date): SuspensionUpdate {
  const checked = checkStreakBreak(streak, toTaipeiDate(now), false)
  const iso = now.toISOString()
  return {
    status: 'suspended',
    suspended_at: iso,
    data_purge_scheduled_at: addMonths(now, DATA_RETENTION_MONTHS).toISOString(),
    streak_frozen_at: iso,
    current_streak: checked.current_streak,
  }
}

/**
 * 付費恢復時的位移天數 D = 恢復日（台北）− 暫停日（台北）。
 * last_streak_date 與 word_progress.due_date 都順延 D 天（第九節 4.）。
 */
export function restoreShiftDays(suspendedAt: string, restoredAt: Date): number {
  const from: TaipeiDate = toTaipeiDate(suspendedAt)
  const to: TaipeiDate = toTaipeiDate(restoredAt)
  return Math.max(0, diffDays(to, from))
}
