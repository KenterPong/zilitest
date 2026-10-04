import Image from 'next/image'
import Link from 'next/link'

import { SiteFooter } from '@/components/SiteChrome'
import { EARLY_BIRD_END_DATE, EARLY_BIRD_LIMIT } from '@/types/user'

const EARLY_BIRD_END_LABEL = EARLY_BIRD_END_DATE.replace(/-/g, '/')

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
              ✓ 英・日・韓 多語自學
            </div>
            <h1 className="font-serif font-black text-4xl md:text-5xl leading-tight mb-5">
              把單字，練成<em className="not-italic text-stamp-red">你的字力</em>。
            </h1>
            <p className="text-ink-soft text-lg mb-8 max-w-md">
              用你自己的單字，同時自學英文、日文、韓文。系統每天依熟練度安排複習任務，掌握字數、等級與連續天數，讓你看見自己的成長。免下載 App，LINE 登入就能開始，我們不會取得或儲存你的 LINE 密碼。
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
              { lang: '韓文', term: '꾸준히', answer: 'adv. 持之以恆地', className: 'top-[70px] left-0 -rotate-[9deg] opacity-85' },
              { lang: '日文', term: '続ける', answer: 'v. 繼續、持續', className: 'top-[35px] left-8 rotate-[4deg] opacity-95' },
              { lang: '英文', term: 'journey', answer: 'n. 旅程', className: 'top-0 left-16 -rotate-[2deg]' },
            ].map((card) => (
              <div
                key={card.term}
                className={`absolute w-56 h-36 bg-cream border border-line rounded-md shadow-lg flex flex-col justify-center px-5 ${card.className}`}
              >
                <div className="font-mono text-[11px] tracking-[0.08em] text-ink-soft mb-1">{card.lang}</div>
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
              label: '你的單字',
              title: '背你真正遇到的字',
              desc: '不是固定課程。課本、影集、文章裡遇到的字，建成自己的單字本，系統幫你排進每天的複習。',
            },
            {
              label: '看得見的成長',
              title: '每天都知道自己往前走',
              desc: '掌握字數、等級、連續天數與成就，不只是把字存起來，而是看見自己真的記住了多少。',
            },
            {
              label: '多語累積',
              title: '英・日・韓一起算',
              desc: '每種語言各自排程、各自升級，再以跨語言的總掌握字數，作為你自學多種語言的成長指標。',
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
          <h2 className="font-serif font-black text-3xl">每天打開，就知道今天要背什麼</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-px bg-line border border-line">
          {[
            ['每日任務', '系統依熟練度安排今天要複習的字與新字。你只要決定學哪些語言、每天學多少，不用自己挑範圍。'],
            ['間隔複習', '答對就拉長下次複習的間隔，答錯就回到隔天；在不同日期連續答對，才算真正「掌握」。'],
            ['成長面板', '各語言的等級、掌握字數、連續天數與成就一目了然，解鎖的成就永遠不會收回。'],
            ['英・日・韓分語言', '每本單字本設定一種語言，每日任務與成長統計都分語言進行，多種語言同時學也不混亂。'],
            ['自由練習與卡牌', '想加強特定範圍時，自選單字本與標籤練習；是非、選擇、填空三種題型，填空題看中文拼外文。'],
            ['Excel 匯入與匯出', '單字、答案、說明三欄就能建單字本；隨時可把單字匯出成 Excel 備份。'],
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
            前 {EARLY_BIRD_LIMIT} 名註冊會員，可免費使用至 {EARLY_BIRD_END_LABEL}（台北時間）。
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-cream border border-line rounded-md p-9">
            <div className="font-mono text-xs tracking-widest text-ink-soft mb-3">免費使用 30 天</div>
            <div className="font-serif font-black text-4xl mb-2">NT$0</div>
            <p className="text-sm text-ink-soft mb-6">不用先綁信用卡，到期後由你決定要不要繼續</p>
            <ul className="text-sm space-y-2 mb-8 border-t border-dashed border-line pt-4">
              <li>最多可存 500 個單字（英日韓合計）</li>
              <li>每日任務、成長面板與成就全部可用</li>
              <li>自由練習、卡牌模式不限次數、無廣告</li>
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
              <li>每日任務、成長面板與成就全部可用</li>
              <li>自由練習、卡牌模式不限次數、無廣告</li>
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

      <SiteFooter />
    </>
  )
}
