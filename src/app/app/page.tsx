import { redirect } from 'next/navigation'

import { StatusBanner } from '@/components/StatusBanner'
import { TodayPanel } from '@/components/TodayPanel'
import { WordbookGrid } from '@/components/WordbookGrid'
import { getSessionUser } from '@/lib/auth'
import { ensureToday } from '@/lib/daily-service'
import { getProgressSummary } from '@/lib/growth-service'
import { listWordbooksForUser } from '@/lib/vocab-queries'

export const dynamic = 'force-dynamic'

export default async function AppHomePage() {
  const user = await getSessionUser()
  if (!user || user.status === 'cancelled') {
    redirect('/auth/login')
  }

  const [overview, wordbooks, summary] = await Promise.all([
    ensureToday(user),
    listWordbooksForUser(user.id),
    getProgressSummary(user.id),
  ])
  const canMutate = user.status !== 'suspended'
  const totalMastered = summary.reduce((sum, r) => sum + r.mastered, 0)

  return (
    <main className="px-5 sm:px-8 py-7 max-w-5xl mx-auto">
      <StatusBanner user={user} />
      <TodayPanel
        overview={overview}
        totalMastered={totalMastered}
        hasWordbooks={wordbooks.length > 0}
        frozen={!canMutate}
      />
      <WordbookGrid wordbooks={wordbooks} canMutate={canMutate} />
    </main>
  )
}
