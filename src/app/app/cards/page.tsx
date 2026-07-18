import { redirect } from 'next/navigation'

import { CardsClient } from '@/components/CardsClient'
import { getSessionUser } from '@/lib/auth'
import { listTagsForUser, listWordbooksForUser } from '@/lib/vocab-queries'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ wordbook?: string }> }

export default async function CardsPage({ searchParams }: Props) {
  const user = await getSessionUser()
  if (!user || user.status === 'cancelled') redirect('/auth/login')
  if (user.status === 'suspended') redirect('/app/settings')

  const sp = await searchParams
  const [wordbooks, tags] = await Promise.all([
    listWordbooksForUser(user.id),
    listTagsForUser(user.id),
  ])

  return (
    <main className="px-8 py-7 max-w-5xl mx-auto">
      <CardsClient
        wordbooks={wordbooks}
        tags={tags}
        initialWordbookId={sp.wordbook}
      />
    </main>
  )
}
