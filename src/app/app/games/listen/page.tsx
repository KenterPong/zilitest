import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { ListenGame } from '@/components/ListenGame'
import { getSessionUser } from '@/lib/auth'
import { getListenPool, getPersonalBest } from '@/lib/game-service'
import { LISTEN_CHOICES } from '@/lib/games'
import { isLanguage, LANGUAGE_LABELS } from '@/types/vocab'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ lang?: string }> }

export default async function ListenPage({ searchParams }: Props) {
  const user = await getSessionUser()
  if (!user || user.status === 'cancelled') redirect('/auth/login')
  if (user.status === 'suspended') redirect('/app/games')

  const { lang } = await searchParams
  if (!isLanguage(lang)) notFound()

  const [round, best] = await Promise.all([getListenPool(user.id, lang), getPersonalBest(user.id, 'listen', lang)])

  if (!round.pool) {
    return (
      <main className="px-5 sm:px-8 py-10 max-w-md mx-auto text-center">
        <p className="text-ink-soft mb-4">
          {LANGUAGE_LABELS[lang]}至少需要 {LISTEN_CHOICES} 個發音不同的單字才能玩聽音辨字（目前 {round.available} 個）。
        </p>
        <Link href="/app/games" className="border-b border-current text-sm">
          回遊戲
        </Link>
      </main>
    )
  }

  return (
    <main className="px-5 sm:px-8 py-7 max-w-5xl mx-auto">
      <ListenGame language={lang} pool={round.pool} initialBest={best} />
    </main>
  )
}
