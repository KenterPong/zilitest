import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AutoSpeakToggle } from '@/components/AutoSpeakToggle'
import { DeleteAccountSection } from '@/components/DeleteAccountSection'
import { ExportWordsButton } from '@/components/ExportWordsButton'
import { LanguageSettingsForm } from '@/components/LanguageSettingsForm'
import { PronunciationToggles } from '@/components/PronunciationToggles'
import { daysRemaining, formatTrialEndDate, getSessionUser } from '@/lib/auth'
import { getExtractionQuota } from '@/lib/ai-extract'
import { getLanguageSettings } from '@/lib/growth-service'
import {
  EARLY_BIRD_END_DATE,
  EARLY_BIRD_LIMIT,
  TRIAL_WORD_LIMIT,
  type DbUser,
} from '@/types/user'

function planLabel(user: DbUser): string {
  switch (user.status) {
    case 'trial':
      return user.is_early_bird ? '早鳥試用中' : '試用中'
    case 'active':
      return user.auto_renew ? '付費中' : '付費中（已取消續訂）'
    case 'payment_failed':
      return '扣款失敗（寬限期）'
    case 'suspended':
      return '已暫停'
    default:
      return user.status
  }
}

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const user = await getSessionUser()
  if (!user || user.status === 'cancelled') {
    redirect('/auth/login')
  }

  const trialDays = daysRemaining(user.trial_end_at)
  const [languageSettings, aiQuota] = await Promise.all([
    getLanguageSettings(user.id),
    getExtractionQuota(user),
  ])

  return (
    <main className="px-8 py-10 max-w-3xl mx-auto">
      <Link href="/app" className="text-sm text-ink-soft underline">
        ← 回今日任務
      </Link>
      <h1 className="font-serif font-black text-2xl mt-4 mb-6">帳號設定</h1>

      <div className="bg-cream border border-line rounded-lg p-6 mb-4">
        <h2 className="font-serif font-bold mb-3">訂閱狀態</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between border-b border-dashed border-line pb-2">
            <dt>目前方案</dt>
            <dd className="font-mono text-xs bg-amber-bg border border-amber-line px-2 py-0.5 rounded-full">
              {planLabel(user)}
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
                <dt>{user.is_early_bird ? '早鳥到期日' : '到期日'}</dt>
                <dd>{formatTrialEndDate(user.trial_end_at)}</dd>
              </div>
            </>
          )}
          {user.status === 'suspended' && (
            <>
              <div className="flex justify-between border-b border-dashed border-line pb-2">
                <dt>暫停日期</dt>
                <dd>{formatTrialEndDate(user.suspended_at)}</dd>
              </div>
              <div className="flex justify-between pb-2">
                <dt>資料保留至</dt>
                <dd>{formatTrialEndDate(user.data_purge_scheduled_at)}</dd>
              </div>
            </>
          )}
        </dl>
        {user.status === 'suspended' && (
          <p className="text-xs text-ink-soft mt-3">
            帳號暫停期間僅可匯出資料；連續天數與成就已凍結（不會歸零），付費恢復後立即接續。保留期滿後資料將被清除。
          </p>
        )}
        {user.is_early_bird && user.status === 'trial' && (
          <p className="text-xs text-ink-soft mt-3">
            你是前 {EARLY_BIRD_LIMIT} 名早鳥會員，可免費使用至 {EARLY_BIRD_END_DATE.replace(/-/g, '/')}（台北時間）。期滿後若未付費，帳號將暫停並保留資料 3 個月。
          </p>
        )}
        <button
          type="button"
          disabled
          className="mt-4 bg-stamp-red text-cream font-semibold text-sm px-4 py-2 rounded opacity-60 cursor-not-allowed"
        >
          升級為付費版 NT$70/月（Phase 2）
        </button>
      </div>

      <div className="bg-cream border border-line rounded-lg p-6 mb-4">
        <h2 className="font-serif font-bold mb-1">每日任務</h2>
        <p className="text-sm text-ink-soft mb-2">
          選擇要學習的語言與每日量，系統會依熟練度自動安排複習字與新字。修改自明天的任務起生效。AI 抽字會抽出所設定等級以及以下的單字，本月剩 {aiQuota.remaining} / {aiQuota.limit} 次（每月 1 日重置）。
        </p>
        <LanguageSettingsForm
          settings={languageSettings}
          disabled={user.status === 'suspended'}
        />
      </div>

      <div className="bg-cream border border-line rounded-lg p-6 mb-4">
        <h2 className="font-serif font-bold mb-1">發音</h2>
        <p className="text-sm text-ink-soft mb-3">
          單字旁的 🔊 按鈕使用這台裝置內建的語音播放，不需網路費用。若沒有看到按鈕，代表裝置沒有該語言的語音，可在系統設定中加裝。
        </p>
        <AutoSpeakToggle />
        <PronunciationToggles settings={languageSettings} disabled={user.status === 'suspended'} />
      </div>

      <div className="bg-cream border border-line rounded-lg p-6 mb-4">
        <h2 className="font-serif font-bold mb-2">資料備份</h2>
        <p className="text-sm text-ink-soft mb-4">
          將所有單字本匯出為 Excel，無論試用、付費或帳號已暫停（3 個月保留期內）皆可使用。
        </p>
        <ExportWordsButton />
      </div>

      <DeleteAccountSection isPaid={user.status === 'active' || user.status === 'payment_failed'} />
    </main>
  )
}
