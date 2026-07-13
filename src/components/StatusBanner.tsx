import Link from 'next/link'

import type { DbUser } from '@/types/user'
import { TRIAL_WORD_LIMIT } from '@/types/user'
import { daysRemaining } from '@/lib/auth'

interface StatusBannerProps {
  user: DbUser
}

export function StatusBanner({ user }: StatusBannerProps) {
  if (user.status === 'trial') {
    const days = daysRemaining(user.trial_end_at)
    return (
      <div className="banner-trial flex items-center justify-between gap-4 flex-wrap p-3.5 rounded-md border border-amber-line bg-amber-bg text-[#6B5015] text-sm mb-6">
        <div>
          免費試用剩餘 {days ?? '—'} 天，目前已用 {user.word_count} / {TRIAL_WORD_LIMIT}{' '}
          個單字
        </div>
        <Link href="/app/settings" className="font-bold border-b border-current whitespace-nowrap">
          查看付費方案
        </Link>
      </div>
    )
  }

  if (user.status === 'payment_failed') {
    const days = daysRemaining(user.grace_period_end_at)
    return (
      <div className="flex items-center justify-between gap-4 flex-wrap p-3.5 rounded-md border border-[#E9BCAE] bg-[#FBEAE3] text-stamp-red-deep text-sm mb-6">
        <div>本月扣款失敗，寬限期剩餘 {days ?? '—'} 天，請確認付款方式</div>
        <Link href="/app/settings" className="font-bold border-b border-current whitespace-nowrap">
          前往更新付款
        </Link>
      </div>
    )
  }

  if (user.status === 'suspended') {
    const keepUntil = user.data_purge_scheduled_at
      ? new Date(user.data_purge_scheduled_at).toLocaleDateString('zh-TW')
      : '—'
    return (
      <div className="flex items-center justify-between gap-4 flex-wrap p-3.5 rounded-md border border-stamp-red bg-[#F3E1E0] text-stamp-red-deep text-sm mb-6 font-medium">
        <div>帳號已暫停使用，資料將保留至 {keepUntil}</div>
        <Link href="/app/settings" className="font-bold border-b border-current whitespace-nowrap">
          立即付費恢復 ・ 匯出資料
        </Link>
      </div>
    )
  }

  return null
}
