import Link from 'next/link'

export default function InAppLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-6">
      <div className="max-w-md w-full bg-cream border border-line rounded-lg p-8 text-center shadow-sm">
        <h1 className="font-serif font-black text-2xl mb-3">字力測驗</h1>
        <p className="text-ink-soft text-sm mb-6">
          請使用瀏覽器開啟以下連結完成 LINE 登入（App 內建瀏覽器可能無法自動跳轉）。
        </p>
        <Link
          href="/api/auth/line-bootstrap"
          className="inline-block w-full bg-[#06C755] text-white font-bold py-3 rounded-md"
        >
          使用 LINE 登入
        </Link>
      </div>
    </div>
  )
}
