import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AppNav } from '@/components/AppNav'
import { StatusBanner } from '@/components/StatusBanner'
import { getSessionUser } from '@/lib/auth'

export default async function AppHomePage() {
  const user = await getSessionUser()
  if (!user || user.status === 'cancelled') {
    redirect('/auth/login')
  }

  return (
    <div className="min-h-screen bg-paper">
      <AppNav user={user} />
      <main className="px-8 py-7 max-w-5xl mx-auto">
        <StatusBanner user={user} />

        <div className="flex items-center justify-between mb-4">
          <h1 className="font-serif font-bold text-xl">我的單字本</h1>
          <button
            type="button"
            disabled
            className="bg-ink text-cream text-sm font-medium px-4 py-2 rounded opacity-60 cursor-not-allowed"
          >
            + 新增單字本（Phase 1）
          </button>
        </div>

        <div className="border border-dashed border-line rounded-lg p-12 text-center text-ink-soft bg-cream">
          <p className="mb-2">登入成功，Phase 0 骨架已就緒。</p>
          <p className="text-sm">
            單字本、測驗、卡牌等功能將於 Phase 1 實作。
          </p>
          <p className="text-sm mt-4">
            <Link href="/app/settings" className="underline text-ink">
              帳號設定
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
