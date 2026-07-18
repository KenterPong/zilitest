import Link from 'next/link'

import { SiteFooter, SiteHeader } from '@/components/SiteChrome'

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-8 py-16 min-h-[60vh]">
        <Link href="/" className="text-sm text-ink-soft hover:text-ink mb-6 inline-block">
          ← 返回首頁
        </Link>
        <h1 className="font-serif font-black text-3xl mb-6">服務條款</h1>
        <div className="space-y-6 text-sm text-ink-soft leading-relaxed">
          <p>
            本頁為上線初期摘要，正式完整條款將持續補充。使用本服務即表示你同意以下重點。
          </p>

          <section>
            <h2 className="font-serif font-bold text-ink text-lg mb-2">試用與付費</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>一般新用戶享有 30 天試用，單字上限 500 個（帳號全站加總）。</li>
              <li>付費版 NT$70／月，單字數量無上限；付費後採每月自動續訂，可隨時取消訂閱。</li>
              <li>試用期不需綁定付款方式，到期不會自動扣款。</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif font-bold text-ink text-lg mb-2">早鳥推廣期</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>前 100 名註冊會員可免費使用至 2026/12/31（台北時間當日結束）。</li>
              <li>早鳥仍適用 500 字上限；名額以非已刪除帳號計算，刪除帳號後名額可釋出予後續註冊者。</li>
              <li>刪除帳號後再以同一 LINE 登入，視為全新帳號，僅給予一般 30 天試用，不再重新取得早鳥資格。</li>
              <li>2026/12/31 之後新註冊者，即使名額未滿，亦不再發放早鳥，一律走一般 30 天試用。</li>
              <li>早鳥到期未付費，比照試用期滿：帳號暫停、資料保留 3 個月，期間可付費恢復或匯出資料。</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif font-bold text-ink text-lg mb-2">帳號暫停與資料</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>試用／早鳥到期或扣款寬限期滿未成功，帳號暫停；暫停期間僅可匯出資料。</li>
              <li>暫停後資料保留 3 個月，期滿清除後視同帳號取消。</li>
              <li>「取消訂閱」僅停止續扣，可用至本期結束；「刪除帳號」立即清空資料且不退款。</li>
            </ul>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
