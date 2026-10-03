import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { DailyTaskClient } from '@/components/DailyTaskClient'
import { getSessionUser } from '@/lib/auth'
import { ensureToday, getDailyTaskPayload } from '@/lib/daily-service'
import { isLanguage, LANGUAGE_LABELS } from '@/types/vocab'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ language: string }> }

export default async function DailyTaskPage({ params }: Props) {
  const user = await getSessionUser()
  if (!user || user.status === 'cancelled') redirect('/auth/login')
  if (user.status === 'suspended') redirect('/app')

  const { language } = await params
  if (!isLanguage(language)) notFound()

  // 確保今日任務已產生（直接開啟此頁時）
  const overview = await ensureToday(user)
  const payload = await getDailyTaskPayload(user, language)

  if (!payload) {
    return (
      <main className="px-5 sm:px-8 py-10 max-w-md mx-auto text-center">
        <p className="text-ink-soft mb-4">今天沒有{LANGUAGE_LABELS[language]}的每日任務。</p>
        <Link href="/app" className="border-b border-current text-sm">
          回今日任務
        </Link>
      </main>
    )
  }

  return (
    <main className="px-5 sm:px-8 py-7 max-w-5xl mx-auto">
      <DailyTaskClient payload={payload} currentStreak={overview.streak.current_streak} />
    </main>
  )
}
