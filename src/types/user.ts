export const USER_ID_COOKIE = 'user_id'

export type UserStatus =
  | 'trial'
  | 'active'
  | 'payment_failed'
  | 'suspended'
  | 'cancelled'

export interface DbUser {
  id: string
  line_user_id: string
  display_name: string | null
  avatar_url: string | null
  email: string | null
  status: UserStatus
  auto_renew: boolean
  is_early_bird: boolean
  trial_start_at: string | null
  trial_end_at: string | null
  first_paid_at: string | null
  next_billing_at: string | null
  payment_failed_at: string | null
  grace_period_end_at: string | null
  word_count: number
  suspended_at: string | null
  data_purge_scheduled_at: string | null
  last_reminder_sent_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

export const TRIAL_WORD_LIMIT = 500
export const TRIAL_DAYS = 30
export const EARLY_BIRD_LIMIT = 100
/** 早鳥免費截止（台北時間當日結束） */
export const EARLY_BIRD_END_DATE = '2026-12-31'
export const FEEDBACK_MAX_LENGTH = 2000
