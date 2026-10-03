import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Stamp } from '@/components/Stamp'
import { getSessionUser } from '@/lib/auth'
import { ensureToday } from '@/lib/daily-service'
import { ACHIEVEMENTS, levelFor, type AchievementCategory } from '@/lib/growth'
import { getLanguageSettings, getProgressSummary, getUnlockedAchievements } from '@/lib/growth-service'
import { toTaipeiDate } from '@/lib/taipei-date'
import { LANGUAGE_LABELS, LANGUAGES } from '@/types/vocab'

export const dynamic = 'force-dynamic'

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  language: '單一語言掌握',
  total: '總掌握',
  streak: '連續天數',
  polyglot: '多語學習者',
}

export default async function GrowthPage() {
  const user = await getSessionUser()
  if (!user || user.status === 'cancelled') redirect('/auth/login')

  const [overview, summary, settings, unlocked] = await Promise.all([
    ensureToday(user),
    getProgressSummary(user.id),
    getLanguageSettings(user.id),
    getUnlockedAchievements(user.id),
  ])
  const frozen = user.status === 'suspended'
  const unlockedAt = new Map(unlocked.map((a) => [a.achievement_key, a.unlocked_at]))
  const totalMastered = summary.reduce((sum, r) => sum + r.mastered, 0)

  const languages = LANGUAGES.filter(
    (lang) => summary.some((r) => r.language === lang) || settings.some((s) => s.language === lang)
  )

  return (
    <main className="px-5 sm:px-8 py-7 max-w-5xl mx-auto">
      <p className="text-[12.5px] text-ink-soft mb-2">
        <Link href="/app" className="border-b border-dotted border-ink-soft">
          今日任務
        </Link>
        {' ／ 成長'}
      </p>
      <h1 className="font-serif font-black text-2xl mb-6">我的成長</h1>

      {frozen && (
        <div className="p-3.5 rounded-md border border-warn-line bg-warn-bg text-stamp-red-deep text-sm mb-6">
          帳號暫停中，成長紀錄已凍結（不會歸零），付費恢復後立即接續。
        </div>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: '總掌握字數', value: totalMastered.toLocaleString('en-US'), unit: '字', gold: true },
          { label: '目前連續', value: String(overview.streak.current_streak), unit: '天' },
          { label: '最長連續', value: String(overview.streak.longest_streak), unit: '天' },
        ].map((item) => (
          <div key={item.label} className="bg-cream border border-line rounded-lg p-5">
            <div className="font-mono text-[11px] tracking-[0.06em] text-ink-soft mb-1">
              {item.label}
            </div>
            <div className={`font-serif font-black text-3xl ${item.gold ? 'text-gold' : ''}`}>
              {item.value}
              <span className="text-sm font-medium text-ink-soft ml-1">{item.unit}</span>
            </div>
          </div>
        ))}
      </section>

      <h2 className="font-serif font-bold text-xl mb-4">各語言</h2>
      {languages.length === 0 ? (
        <p className="text-sm text-ink-soft mb-8">建立單字本後，這裡會顯示各語言的掌握進度與等級。</p>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {languages.map((lang) => {
            const counts = summary.find((r) => r.language === lang) ?? {
              total: 0,
              mastered: 0,
              learning: 0,
              unlearned: 0,
            }
            const peak = settings.find((s) => s.language === lang)?.peak_mastered_count ?? 0
            const lv = levelFor(peak)
            const toNext = lv.nextThreshold
              ? Math.round(
                  ((peak - lv.currentThreshold) / (lv.nextThreshold - lv.currentThreshold)) * 100
                )
              : 100
            return (
              <div key={lang} className="bg-cream border border-line rounded-lg p-5">
                <div className="flex items-baseline justify-between mb-3">
                  <h3 className="font-serif font-bold text-lg">{LANGUAGE_LABELS[lang]}</h3>
                  <span className="font-mono text-sm font-semibold text-gold">Lv.{lv.level}</span>
                </div>
                <div className="h-1.5 rounded-full bg-paper-deep overflow-hidden mb-1">
                  <div className="h-full bg-gold" style={{ width: `${toNext}%` }} />
                </div>
                <div className="font-mono text-[11px] text-ink-soft mb-4">
                  {lv.nextThreshold
                    ? `歷史最高 ${peak} / 下一級 ${lv.nextThreshold}`
                    : `歷史最高 ${peak}・已達最高等級`}
                </div>
                <dl className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: '已掌握', value: counts.mastered, cls: 'text-good' },
                    { label: '學習中', value: counts.learning, cls: 'text-ink' },
                    { label: '未學習', value: counts.unlearned, cls: 'text-ink-soft' },
                  ].map((c) => (
                    <div key={c.label} className="bg-paper-deep rounded-[5px] py-2">
                      <dt className="font-mono text-[10.5px] text-ink-soft">{c.label}</dt>
                      <dd className={`font-serif font-bold text-lg ${c.cls}`}>{c.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )
          })}
        </section>
      )}

      <h2 className="font-serif font-bold text-xl mb-1">成就</h2>
      <p className="text-[12.5px] text-ink-soft mb-4">
        已解鎖 {unlocked.length} / {ACHIEVEMENTS.length}，解鎖後永不收回。
      </p>
      {(Object.keys(CATEGORY_LABELS) as AchievementCategory[]).map((category) => (
        <section key={category} className="mb-6">
          <div className="font-mono text-[11.5px] tracking-[0.06em] text-ink-soft mb-2.5">
            {CATEGORY_LABELS[category]}
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {ACHIEVEMENTS.filter((a) => a.category === category).map((a) => {
              const at = unlockedAt.get(a.key)
              return (
                <li
                  key={a.key}
                  className={`flex items-center gap-3 border rounded-[5px] px-3.5 py-3 ${
                    at ? 'bg-cream border-gold' : 'bg-paper border-line opacity-60'
                  }`}
                >
                  {at ? (
                    <Stamp label="成就" />
                  ) : (
                    <span className="w-[52px] h-[52px] rounded-full border-[2.5px] border-dashed border-line shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className={`font-serif font-bold text-[15px] ${at ? 'text-gold' : ''}`}>
                      {a.name}
                    </div>
                    <div className="text-[12px] text-ink-soft">{a.description}</div>
                    {at && (
                      <div className="font-mono text-[10.5px] text-ink-soft mt-0.5">
                        {toTaipeiDate(at)}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </main>
  )
}
