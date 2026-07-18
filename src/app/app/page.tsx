import { redirect } from 'next/navigation'

import { StatusBanner } from '@/components/StatusBanner'
import { WordbookGrid } from '@/components/WordbookGrid'
import { getSessionUser } from '@/lib/auth'
import { listWordbooksForUser } from '@/lib/vocab-queries'

export const dynamic = 'force-dynamic'

export default async function AppHomePage() {
  const user = await getSessionUser()
  if (!user || user.status === 'cancelled') {
    redirect('/auth/login')
  }

  const wordbooks = await listWordbooksForUser(user.id)
  const canMutate = user.status !== 'suspended'

  return (
    <main className="px-8 py-7 max-w-5xl mx-auto">
      <StatusBanner user={user} />
      <WordbookGrid wordbooks={wordbooks} canMutate={canMutate} />
    </main>
  )
}
