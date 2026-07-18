import Image from 'next/image'
import Link from 'next/link'

import { getSessionUser } from '@/lib/auth'

export async function SiteHeader() {
  const user = await getSessionUser()
  const loggedIn = Boolean(user && user.status !== 'cancelled')

  return (
    <nav className="sticky top-0 z-40 bg-paper/90 backdrop-blur border-b border-line">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-8 py-4">
        <Link
          href={loggedIn ? '/app' : '/'}
          className="font-serif font-black text-xl flex items-center gap-2.5 text-ink"
        >
          <Image src="/logo.png" alt="字力測驗" width={36} height={36} className="rounded-sm" priority />
          <span className="flex items-baseline gap-2">
            字力測驗 <span className="font-mono text-[11px] text-ink-soft tracking-widest">ZILITEST</span>
          </span>
        </Link>
        <div className="flex items-center gap-4">
          {loggedIn ? (
            <>
              <Link href="/" className="text-sm text-ink-soft hover:text-ink">
                官網首頁
              </Link>
              <Link
                href="/app"
                className="bg-ink text-cream text-sm font-medium px-5 py-2.5 rounded-sm hover:bg-stamp-red-deep transition-colors"
              >
                返回 App
              </Link>
            </>
          ) : (
            <>
              <Link href="/" className="text-sm text-ink-soft hover:text-ink">
                返回首頁
              </Link>
              <Link
                href="/auth/login"
                className="bg-ink text-cream text-sm font-medium px-5 py-2.5 rounded-sm hover:bg-stamp-red-deep transition-colors"
              >
                LINE 登入
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line py-12">
      <div className="max-w-6xl mx-auto px-8 flex flex-wrap justify-between gap-6 items-end">
        <div>
          <Link href="/" className="font-serif font-black text-lg mb-2 flex items-center gap-2.5 text-ink">
            <Image src="/logo.png" alt="字力測驗" width={28} height={28} className="rounded-sm" />
            字力測驗
          </Link>
          <p className="text-sm text-ink-soft max-w-sm">
            英文、日文檢定單字背誦與測驗工具，免下載 App，LINE 登入即可使用。
          </p>
          <div className="flex gap-4 mt-3 text-xs text-ink-soft">
            <Link href="/privacy" className="underline">
              隱私權政策
            </Link>
            <Link href="/terms" className="underline">
              服務條款
            </Link>
            <Link href="/app/feedback" className="underline">
              改善建議
            </Link>
          </div>
        </div>
        <div className="font-mono text-sm text-ink-soft">zilitest.com</div>
      </div>
    </footer>
  )
}
