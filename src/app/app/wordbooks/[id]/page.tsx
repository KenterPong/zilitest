import { notFound, redirect } from 'next/navigation'

import { WordbookDetailClient } from '@/components/WordbookDetailClient'
import { getSessionUser } from '@/lib/auth'
import {
  getWordbookForUser,
  listTagsForUser,
  listWordsForWordbook,
} from '@/lib/vocab-queries'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export default async function WordbookDetailPage({ params }: Props) {
  const user = await getSessionUser()
  if (!user || user.status === 'cancelled') {
    redirect('/auth/login')
  }

  const { id } = await params
  const book = await getWordbookForUser(user.id, id)
  if (!book) notFound()

  const [words, tags] = await Promise.all([
    listWordsForWordbook(user.id, id),
    listTagsForUser(user.id),
  ])

  return (
    <main className="px-8 py-7 max-w-5xl mx-auto">
      <WordbookDetailClient
        wordbookId={book.id}
        wordbookName={book.name}
        words={words}
        tags={tags}
        accountWordCount={user.word_count}
        userStatus={user.status}
        canMutate={user.status !== 'suspended'}
      />
    </main>
  )
}
