import Link from 'next/link'

/** App 內頁底部：隱私權政策、服務條款 */
export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-line py-6">
      <div className="max-w-5xl mx-auto px-8 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-soft">
        <div className="flex gap-4">
          <Link href="/privacy" className="underline hover:text-ink">
            隱私權政策
          </Link>
          <Link href="/terms" className="underline hover:text-ink">
            服務條款
          </Link>
        </div>
        <span className="font-mono">zilitest.com</span>
      </div>
    </footer>
  )
}
