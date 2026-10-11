import Link from 'next/link'
import { redirect } from 'next/navigation'

import { CollectionClient } from '@/components/CollectionClient'
import { getSessionUser } from '@/lib/auth'
import { buildCollection } from '@/lib/collection'
import { getLanguageWords } from '@/lib/daily-service'
import { getLanguageSettings, getProgressSummary } from '@/lib/growth-service'
import { isLanguage, LANGUAGE_LABELS, LANGUAGES } from '@/types/vocab'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ lang?: string }> }

export default async function CollectionPage({ searchParams }: Props) {
  const user = await getSessionUser()
  if (!user || user.status === 'cancelled') redirect('/auth/login')

  const [summary, settings, sp] = await Promise.all([
    getProgressSummary(user.id),
    getLanguageSettings(user.id),
    searchParams,
  ])
  const languages = LANGUAGES.filter(
    (lang) => summary.some((r) => r.language === lang) || settings.some((s) => s.language === lang)
  )
  const lang = isLanguage(sp.lang) && languages.includes(sp.lang) ? sp.lang : languages[0]
  const words = lang ? await getLanguageWords(user.id, lang) : []
  const collection = buildCollection(words)

  return (
    <main className="px-5 sm:px-8 py-7 max-w-5xl mx-auto">
      <p className="text-[12.5px] text-ink-soft mb-2">
        <Link href="/app/growth" className="border-b border-dotted border-ink-soft">
          成長
        </Link>
        {' ／ 單字卡冊'}
      </p>
      <h1 className="font-serif font-black text-2xl mb-5">單字卡冊</h1>

      {languages.length === 0 ? (
        <p className="text-sm text-ink-soft">建立單字本後，掌握的單字會依語言收進卡冊。</p>
      ) : (
        <>
          {languages.length > 1 && (
            <nav className="flex gap-2 mb-6" aria-label="語言">
              {languages.map((l) => (
                <Link
                  key={l}
                  href={`/app/collection?lang=${l}`}
                  aria-current={l === lang ? 'page' : undefined}
                  className={`font-mono text-xs px-3.5 py-1.5 rounded-full border ${
                    l === lang ? 'bg-ink text-cream border-ink' : 'bg-cream text-ink-soft border-line hover:border-ink'
                  }`}
                >
                  {LANGUAGE_LABELS[l]}
                </Link>
              ))}
            </nav>
          )}
          <CollectionClient key={lang} collection={collection} language={lang} />
        </>
      )}
    </main>
  )
}
