import Link from 'next/link'
import { redirect } from 'next/navigation'

import { FeedbackForm } from '@/components/FeedbackForm'
import { getSessionUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function FeedbackPage() {
  const user = await getSessionUser()
  if (!user || user.status === 'cancelled') {
    redirect('/auth/login')
  }

  return (
    <main className="px-8 py-10 max-w-3xl mx-auto">
      <Link href="/app" className="text-sm text-ink-soft underline">
        ← 返回首頁
      </Link>
      <h1 className="font-serif font-black text-2xl mt-4 mb-2">改善建議</h1>
      <p className="text-sm text-ink-soft mb-6">
        歡迎告訴我們使用心得、想要的功能或遇到的問題。你的建議會幫助我們把字力測驗做得更好。
      </p>
      <div className="bg-cream border border-line rounded-lg p-6">
        <FeedbackForm />
      </div>
    </main>
  )
}
