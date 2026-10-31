import { notFound, redirect } from 'next/navigation'

import { WordbookDetailClient } from '@/components/WordbookDetailClient'
import { getExtractionQuota } from '@/lib/ai-extract'
import { getSessionUser } from '@/lib/auth'
import { getLanguageSettings } from '@/lib/growth-service'
import { prefsFromSettings } from '@/lib/pronunciation-display'
import {
  getWordbookForUser,
  listTagsForUser,
  listWordsForWordbook,
} from '@/lib/vocab-queries'
import type { Language } from '@/types/vocab'

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

  const [words, tags, settings, quota] = await Promise.all([
    listWordsForWordbook(user.id, id),
    listTagsForUser(user.id),
    getLanguageSettings(user.id),
    getExtractionQuota(user),
  ])
  const level = settings.find((s) => s.language === book.language)?.extract_level ?? null

  return (
    <main className="px-5 sm:px-8 py-7 max-w-5xl mx-auto">
      <WordbookDetailClient
        wordbookId={book.id}
        wordbookName={book.name}
        wordbookLanguage={book.language}
        aiExtract={{ level, remaining: quota.remaining, limit: quota.limit }}
        words={words}
        tags={tags}
        accountWordCount={user.word_count}
        userStatus={user.status}
        canMutate={user.status !== 'suspended'}
        showPronunciation={prefsFromSettings(settings)[book.language as Language]}
      />
    </main>
  )
}
