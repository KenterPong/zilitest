import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { SpellGame } from '@/components/SpellGame'
import { getSessionUser } from '@/lib/auth'
import { getPersonalBest, getSpellRound } from '@/lib/game-service'
import { getLanguageSettings } from '@/lib/growth-service'
import { prefsFromSettings } from '@/lib/pronunciation-display'
import { SPELL_MIN_WORDS } from '@/lib/spell'
import { isLanguage, LANGUAGE_LABELS } from '@/types/vocab'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ lang?: string }> }

export default async function SpellPage({ searchParams }: Props) {
  const user = await getSessionUser()
  if (!user || user.status === 'cancelled') redirect('/auth/login')
  if (user.status === 'suspended') redirect('/app/games')

  const { lang } = await searchParams
  if (!isLanguage(lang)) notFound()

  const [round, best, settings] = await Promise.all([
    getSpellRound(user.id, lang),
    getPersonalBest(user.id, 'spell', lang),
    getLanguageSettings(user.id),
  ])

  if (!round.pool) {
    return (
      <main className="px-5 sm:px-8 py-10 max-w-md mx-auto text-center">
        <p className="text-ink-soft mb-4">
          {LANGUAGE_LABELS[lang]}至少需要 {SPELL_MIN_WORDS} 個可拼字的單字才能玩拼字挑戰（目前 {round.available}{' '}
          個）。單字須為 2–12 個字，且不含空格、符號或數字。
        </p>
        <Link href="/app/games" className="border-b border-current text-sm">
          回遊戲
        </Link>
      </main>
    )
  }

  return (
    <main className="px-5 sm:px-8 py-7 max-w-5xl mx-auto">
      <SpellGame
        language={lang}
        pool={round.pool}
        terms={round.terms}
        initialBest={best}
        showPronunciation={prefsFromSettings(settings)[lang]}
      />
    </main>
  )
}
