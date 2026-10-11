import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getSessionUser } from '@/lib/auth'
import { getMatchBests } from '@/lib/game-service'
import { formatMatchTime, MATCH_WORD_COUNT } from '@/lib/games'
import { getLanguageSettings, getProgressSummary } from '@/lib/growth-service'
import { LANGUAGE_LABELS, LANGUAGES } from '@/types/vocab'

export const dynamic = 'force-dynamic'

const COMING_SOON = [
  { name: '聽音辨字', desc: '聽發音，從 4 個選項選出聽到的字。60 秒內答對越多越好。' },
  { name: '拼字挑戰', desc: '看中文，用打散的方塊拼出外文，不用切換輸入法。' },
]

export default async function GamesPage() {
  const user = await getSessionUser()
  if (!user || user.status === 'cancelled') redirect('/auth/login')

  const [summary, settings, bests] = await Promise.all([
    getProgressSummary(user.id),
    getLanguageSettings(user.id),
    getMatchBests(user.id),
  ])
  const languages = LANGUAGES.filter(
    (l) => summary.some((r) => r.language === l) || settings.some((s) => s.language === l)
  )
  const frozen = user.status === 'suspended'

  return (
    <main className="px-5 sm:px-8 py-7 max-w-5xl mx-auto">
      <h1 className="font-serif font-black text-2xl mb-1">遊戲</h1>
      <p className="text-sm text-ink-soft mb-6">
        用你學過的單字玩一局。遊戲是額外的樂趣，成績不影響熟練度與連續天數。
      </p>

      {frozen && (
        <div className="p-3.5 rounded-md border border-warn-line bg-warn-bg text-stamp-red-deep text-sm mb-6">
          帳號暫停中，暫時無法開始新的一局；過去的成績仍可查看。
        </div>
      )}

      <section className="bg-cream border border-line rounded-lg p-6 mb-6">
        <h2 className="font-serif font-bold text-xl mb-1">配對消除</h2>
        <p className="text-sm text-ink-soft mb-4">
          12 張牌全部正面朝上，把 {MATCH_WORD_COUNT} 個外文和中文配成對，越快越好；配錯一次罰 3 秒。
        </p>
        {languages.length === 0 ? (
          <p className="text-sm text-ink-soft">建立單字本並加入至少 {MATCH_WORD_COUNT} 個單字後就能開始。</p>
        ) : (
          <ul className="divide-y divide-dashed divide-line">
            {languages.map((lang) => {
              const total = summary.find((r) => r.language === lang)?.total ?? 0
              const best = bests[lang]
              const enough = total >= MATCH_WORD_COUNT
              return (
                <li key={lang} className="flex items-center justify-between gap-4 py-3 flex-wrap">
                  <div>
                    <div className="font-serif font-bold">{LANGUAGE_LABELS[lang]}</div>
                    <div className="font-mono text-[11.5px] text-ink-soft">
                      {best !== undefined ? `個人最佳 ${formatMatchTime(best)}` : '還沒有紀錄'}
                    </div>
                  </div>
                  {frozen ? null : enough ? (
                    <Link
                      href={`/app/games/match?lang=${lang}`}
                      className="bg-ink text-cream font-semibold text-sm px-5 py-2.5 rounded-[5px] hover:bg-stamp-red-deep"
                    >
                      開始配對
                    </Link>
                  ) : (
                    <span className="text-[12.5px] text-ink-soft">
                      至少需要 {MATCH_WORD_COUNT} 個單字（目前 {total} 個）
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {COMING_SOON.map((g) => (
          <div key={g.name} className="border border-dashed border-line rounded-lg p-5 bg-paper">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-serif font-bold text-lg text-ink-soft">{g.name}</h2>
              <span className="font-mono text-[11px] text-ink-soft border border-line rounded-full px-2 py-0.5">
                即將推出
              </span>
            </div>
            <p className="text-[13px] text-ink-soft">{g.desc}</p>
          </div>
        ))}
      </section>
    </main>
  )
}
