import Image from 'next/image'
import Link from 'next/link'

export default function HomePage() {
  return (
    <>
      <nav className="sticky top-0 z-40 bg-paper/90 backdrop-blur border-b border-line">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-8 py-4">
          <div className="font-serif font-black text-xl flex items-center gap-2.5">
            <Image src="/logo.png" alt="字力測驗" width={36} height={36} className="rounded-sm" priority />
            <span className="flex items-baseline gap-2">
              字力測驗 <span className="font-mono text-[11px] text-ink-soft tracking-widest">ZILITEST</span>
            </span>
          </div>
          <div className="hidden md:flex gap-8 text-sm text-ink-soft">
            <a href="#features">功能特色</a>
            <a href="#pricing">定價</a>
            <a href="#compare">為什麼選字力測驗</a>
          </div>
          <Link
            href="/auth/login"
            className="bg-ink text-cream text-sm font-medium px-5 py-2.5 rounded-sm hover:bg-stamp-red-deep transition-colors"
          >
            LINE 登入
          </Link>
        </div>
      </nav>

      <section className="relative overflow-hidden py-20">
        <div
          className="absolute inset-0 opacity-60 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(30,42,64,0.06) 1.4px, transparent 1.4px)',
            backgroundSize: '22px 22px',
            maskImage: 'linear-gradient(to bottom, black 0%, transparent 85%)',
          }}
        />
        <div className="max-w-6xl mx-auto px-8 grid lg:grid-cols-2 gap-14 items-center relative">
          <div>
            <div className="inline-flex items-center gap-2 font-mono text-xs tracking-widest text-stamp-red-deep border border-stamp-red-deep px-3 py-1 rounded-sm mb-5">
              ✓ 英文・日文檢定單字神器
            </div>
            <h1 className="font-serif font-black text-4xl md:text-5xl leading-tight mb-5">
              把單字，練成<em className="not-italic text-stamp-red">你的字力</em>。
            </h1>
            <p className="text-ink-soft text-lg mb-8 max-w-md">
              功能完整、價格合理，讓你更專注在背單字這件事。免下載 App，LINE 登入就能開始練。我們不會取得或儲存你的 LINE 密碼。
            </p>
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 bg-stamp-red text-cream font-bold px-6 py-3.5 rounded-sm hover:bg-stamp-red-deep transition-transform hover:-translate-y-0.5"
              >
                使用 LINE 開始
              </Link>
              <a href="#pricing" className="text-sm font-medium border-b border-ink pb-0.5">
                查看定價
              </a>
            </div>
            <p className="font-mono text-xs text-ink-soft">免費試用 30 天・最多 500 字・無廣告</p>
          </div>

          <div className="relative h-80 hidden sm:block">
            {[
              { term: '試験', answer: 'n. 考試、測驗', className: 'top-[70px] left-0 -rotate-[9deg] opacity-85' },
              { term: 'diligent', answer: 'adj. 勤勉的', className: 'top-[35px] left-8 rotate-[4deg] opacity-95' },
              { term: '合格', answer: 'n. 及格、合格', className: 'top-0 left-16 -rotate-[2deg]' },
            ].map((card) => (
              <div
                key={card.term}
                className={`absolute w-56 h-36 bg-cream border border-line rounded-md shadow-lg flex flex-col justify-center px-5 ${card.className}`}
              >
                <div className="font-serif font-bold text-xl mb-1">{card.term}</div>
                <div className="text-sm text-ink-soft">{card.answer}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="compare" className="border-y border-line bg-paper-deep">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3">
          {[
            {
              label: '功能',
              title: '功能完整',
              desc: '不只是陽春卡片，內建錯誤率分析，測驗會自動優先出你還沒背熟的字。',
            },
            {
              label: '價格',
              title: '價格合理',
              desc: '每月 NT$70，功能不分級，不用為了進階測驗另外加價。',
            },
            {
              label: '專注',
              title: '更專注',
              desc: '只做單字背誦與測驗，題型與排序都是為了「背起來」這個目的設計。',
            },
          ].map((item) => (
            <div key={item.title} className="p-8 border-b md:border-b-0 md:border-r border-line last:border-r-0">
              <div className="font-mono text-[11px] tracking-widest text-ink-soft mb-2">{item.label}</div>
              <h3 className="font-serif font-bold text-lg mb-2">{item.title}</h3>
              <p className="text-sm text-ink-soft">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="py-20 max-w-6xl mx-auto px-8">
        <div className="mb-12 max-w-xl">
          <div className="font-mono text-xs tracking-widest text-stamp-red-deep mb-3">功能特色</div>
          <h2 className="font-serif font-black text-3xl">三種題型、一套熟練度邏輯</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-px bg-line border border-line">
          {[
            ['是非・選擇・填空', '填空題顯示中文、輸入外文；拼錯處會用紅字標出。'],
            ['卡牌背誦模式', '標記「認得 / 不認得」，系統會讓不熟的字更常出現。'],
            ['錯誤率分析', '每個單字都看得到正確率，測驗會優先考你還沒背熟的字。'],
            ['Excel 匯入', '貼上單字、答案、說明三欄就能建單字本，不用一筆一筆手動輸入。'],
          ].map(([title, desc]) => (
            <div key={title} className="bg-paper p-9">
              <h3 className="font-serif font-bold text-lg mb-2">{title}</h3>
              <p className="text-sm text-ink-soft">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="pb-20 max-w-6xl mx-auto px-8">
        <div className="mb-10">
          <div className="font-mono text-xs tracking-widest text-stamp-red-deep mb-3">定價</div>
          <h2 className="font-serif font-black text-3xl mb-4">
            先免費用 30 天，再決定要不要付費
          </h2>
          <p className="text-sm text-stamp-red-deep bg-amber-bg border border-amber-line rounded-md px-4 py-3 max-w-2xl">
            前 100 名註冊會員，可以免費使用到今年（2026 年）的 12/31。
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-cream border border-line rounded-md p-9">
            <div className="font-mono text-xs tracking-widest text-ink-soft mb-3">免費使用 30 天</div>
            <div className="font-serif font-black text-4xl mb-2">NT$0</div>
            <p className="text-sm text-ink-soft mb-6">不用先綁信用卡，到期後由你決定要不要繼續</p>
            <ul className="text-sm space-y-2 mb-8 border-t border-dashed border-line pt-4">
              <li>最多可存 500 個單字</li>
              <li>三種題型、卡牌模式全部可用</li>
              <li>測驗次數不限、無廣告</li>
            </ul>
            <Link
              href="/auth/login"
              className="block text-center bg-paper-deep border border-line py-3 rounded-sm font-bold"
            >
              開始使用
            </Link>
          </div>
          <div className="bg-cream border-2 border-stamp-red rounded-md p-9 relative">
            <div className="absolute top-5 -right-8 bg-stamp-red text-cream font-mono text-[11px] px-10 py-1 rotate-[38deg]">
              推薦
            </div>
            <div className="font-mono text-xs tracking-widest text-ink-soft mb-3">付費版</div>
            <div className="font-serif font-black text-4xl mb-2">
              NT$70 <span className="font-mono text-sm font-normal text-ink-soft">/ 月</span>
            </div>
            <p className="text-sm text-ink-soft mb-6">單字數量無上限，其餘功能與免費使用時相同</p>
            <ul className="text-sm space-y-2 mb-8 border-t border-dashed border-line pt-4">
              <li>單字數量無上限</li>
              <li>三種題型、卡牌模式全部可用</li>
              <li>測驗次數不限、無廣告</li>
            </ul>
            <Link
              href="/auth/login"
              className="block text-center bg-stamp-red text-cream py-3 rounded-sm font-bold"
            >
              開始付費使用
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line py-12">
        <div className="max-w-6xl mx-auto px-8 flex flex-wrap justify-between gap-6 items-end">
          <div>
            <div className="font-serif font-black text-lg mb-2 flex items-center gap-2.5">
              <Image src="/logo.png" alt="字力測驗" width={28} height={28} className="rounded-sm" />
              字力測驗
            </div>
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
            </div>
          </div>
          <div className="font-mono text-sm text-ink-soft">zilitest.com</div>
        </div>
      </footer>
    </>
  )
}
