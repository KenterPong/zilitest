import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { MatchGame } from '@/components/MatchGame'
import { getSessionUser } from '@/lib/auth'
import { getLanguageSettings } from '@/lib/growth-service'
import { prefsFromSettings } from '@/lib/pronunciation-display'
import { getMatchRound, getPersonalBest } from '@/lib/game-service'
import { MATCH_WORD_COUNT } from '@/lib/games'
import { isLanguage, LANGUAGE_LABELS } from '@/types/vocab'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ lang?: string }> }

export default async function MatchPage({ searchParams }: Props) {
  const user = await getSessionUser()
  if (!user || user.status === 'cancelled') redirect('/auth/login')
  if (user.status === 'suspended') redirect('/app/games')

  const { lang } = await searchParams
  if (!isLanguage(lang)) notFound()

  const [round, best, settings] = await Promise.all([
    getMatchRound(user.id, lang),
    getPersonalBest(user.id, 'match', lang, MATCH_WORD_COUNT),
    getLanguageSettings(user.id),
  ])

  if (!round.words) {
    return (
      <main className="px-5 sm:px-8 py-10 max-w-md mx-auto text-center">
        <p className="text-ink-soft mb-4">
          {LANGUAGE_LABELS[lang]}至少需要 {MATCH_WORD_COUNT} 個意思不同的單字才能玩配對（目前 {round.available} 個）。
        </p>
        <Link href="/app/games" className="border-b border-current text-sm">
          回遊戲
        </Link>
      </main>
    )
  }

  return (
    <main className="px-5 sm:px-8 py-7 max-w-5xl mx-auto">
      <MatchGame
        language={lang}
        initialWords={round.words}
        initialBest={best}
        seed={Math.floor(Math.random() * 2 ** 31)}
        showPronunciation={prefsFromSettings(settings)[lang]}
      />
    </main>
  )
}
