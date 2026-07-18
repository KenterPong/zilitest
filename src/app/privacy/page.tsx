import Link from 'next/link'

import { SiteFooter, SiteHeader } from '@/components/SiteChrome'
import { getSessionUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function PrivacyPage() {
  const user = await getSessionUser()
  const loggedIn = Boolean(user && user.status !== 'cancelled')

  return (
    <>
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-8 py-16 min-h-[60vh]">
        <Link
          href={loggedIn ? '/app' : '/'}
          className="text-sm text-ink-soft hover:text-ink mb-6 inline-block"
        >
          {loggedIn ? '← 返回 App' : '← 返回首頁'}
        </Link>
        <h1 className="font-serif font-black text-3xl mb-4">隱私權政策</h1>
        <p className="text-ink-soft text-sm leading-relaxed">
          本頁面為上線前佔位。正式上線前需依營運文件撰寫完整隱私權政策（含 LINE
          登入資料處理、學習紀錄保存與刪除機制等），供 LINE 審核與金流申請檢附。
        </p>
      </main>
      <SiteFooter />
    </>
  )
}
