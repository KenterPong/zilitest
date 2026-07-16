import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ExportWordsButton } from '@/components/ExportWordsButton'
import { getSessionUser, daysRemaining } from '@/lib/auth'
import { TRIAL_WORD_LIMIT } from '@/types/user'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const user = await getSessionUser()
  if (!user || user.status === 'cancelled') {
    redirect('/auth/login')
  }

  const trialDays = daysRemaining(user.trial_end_at)

  return (
    <div className="min-h-screen bg-paper px-8 py-10 max-w-3xl mx-auto">
      <Link href="/app" className="text-sm text-ink-soft underline">
        ← 返回首頁
      </Link>
      <h1 className="font-serif font-black text-2xl mt-4 mb-6">帳號設定</h1>

      <div className="bg-cream border border-line rounded-lg p-6 mb-4">
        <h2 className="font-serif font-bold mb-3">訂閱狀態</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between border-b border-dashed border-line pb-2">
            <dt>目前方案</dt>
            <dd className="font-mono text-xs bg-amber-bg border border-amber-line px-2 py-0.5 rounded-full">
              {user.status === 'trial' ? '試用中' : user.status}
            </dd>
          </div>
          {user.status === 'trial' && (
            <>
              <div className="flex justify-between border-b border-dashed border-line pb-2">
                <dt>剩餘天數</dt>
                <dd>
                  {trialDays ?? '—'} 天（{TRIAL_WORD_LIMIT} 字上限）
                </dd>
              </div>
              <div className="flex justify-between border-b border-dashed border-line pb-2">
                <dt>單字用量</dt>
                <dd>
                  {user.word_count} / {TRIAL_WORD_LIMIT}
                </dd>
              </div>
              <div className="flex justify-between pb-2">
                <dt>到期日</dt>
                <dd>
                  {user.trial_end_at
                    ? new Date(user.trial_end_at).toLocaleDateString('zh-TW')
                    : '—'}
                </dd>
              </div>
            </>
          )}
        </dl>
        <button
          type="button"
          disabled
          className="mt-4 bg-stamp-red text-cream font-semibold text-sm px-4 py-2 rounded opacity-60 cursor-not-allowed"
        >
          升級為付費版 NT$70/月（Phase 2）
        </button>
      </div>

      <div className="bg-cream border border-line rounded-lg p-6">
        <h2 className="font-serif font-bold mb-2">資料備份</h2>
        <p className="text-sm text-ink-soft mb-4">
          將所有單字本匯出為 Excel，無論試用、付費或帳號已暫停（3 個月保留期內）皆可使用。
        </p>
        <ExportWordsButton />
      </div>
    </div>
  )
}
