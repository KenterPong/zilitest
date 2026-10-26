'use client'

import { useState } from 'react'

import { SpeakButton } from '@/components/SpeakButton'
import { StagePips } from '@/components/StagePips'
import { TermSecondLine } from '@/components/TermSecondLine'
import { COLLECTION_TIERS, tierFor, type Collection, type CollectionWord } from '@/lib/collection'
import { MASTERED_STAGE } from '@/lib/progress'
import type { Language } from '@/types/vocab'

const PAGE_SIZE = 24

/** 各等級卡框：等級越高越接近金色 */
const TIER_FRAME: Record<number, string> = {
  4: 'border border-gold',
  5: 'border-2 border-gold',
  6: 'border-2 border-gold [--card-bg:var(--amber-bg)]',
  7: 'border-2 border-gold [--card-bg:var(--amber-bg)] ring-1 ring-gold ring-offset-2 ring-offset-paper',
}

function WordCard({ word, language, show }: { word: CollectionWord; language: Language; show: boolean }) {
  const [flipped, setFlipped] = useState(false)
  const tier = tierFor(word.stage)
  const frame = tier ? TIER_FRAME[tier.stage] : 'border border-line'
  const toGo = MASTERED_STAGE - word.stage

  return (
    // 用 div 而非 button：卡片內還有發音按鈕，button 不可巢狀
    <div
      role="button"
      tabIndex={0}
      onClick={() => setFlipped((f) => !f)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setFlipped((f) => !f)
        }
      }}
      aria-pressed={flipped}
      aria-label={`${word.term}，${flipped ? '顯示單字' : '翻面看中文'}`}
      className="card-3d h-[136px] text-left cursor-pointer"
    >
      <div className={`card-inner ${flipped ? 'is-flipped' : ''}`}>
        <div className={`card-face card-ruled rounded-lg ${frame} p-3 flex flex-col`}>
          <div className="flex items-center justify-between">
            <span className={`font-mono text-[10.5px] tracking-[0.08em] ${tier ? 'text-gold font-semibold' : 'text-ink-soft'}`}>
              {tier ? tier.name : `再 ${toGo} 階掌握`}
            </span>
            <div className="flex items-center gap-1.5">
              <SpeakButton term={word.term} reading={word.reading} language={language} size="sm" />
              <StagePips stage={word.stage} />
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-center min-h-0">
            <div className="font-serif font-bold text-[19px] leading-tight break-words line-clamp-2">
              {word.term}
            </div>
            <TermSecondLine language={language} word={word} show={show} className="text-[11.5px] mt-0.5" />
          </div>
        </div>
        <div className={`card-face card-back card-ruled rounded-lg ${frame} p-3 flex items-center justify-center text-center`}>
          <div className="text-[14px] leading-snug line-clamp-4">{word.answer}</div>
        </div>
      </div>
    </div>
  )
}

function CardGrid({ words, language, show }: { words: CollectionWord[]; language: Language; show: boolean }) {
  const [shown, setShown] = useState(PAGE_SIZE)
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {words.slice(0, shown).map((w) => (
          <WordCard key={w.id} word={w} language={language} show={show} />
        ))}
      </div>
      {words.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE_SIZE * 2)}
          className="mt-4 w-full border border-line bg-cream rounded-[5px] py-2.5 text-sm text-ink-soft hover:border-ink hover:text-ink"
        >
          再顯示 {Math.min(PAGE_SIZE * 2, words.length - shown)} 張（共 {words.length} 張）
        </button>
      )}
    </>
  )
}

export function CollectionClient({
  collection,
  language,
  showPronunciation,
}: {
  collection: Collection
  language: Language
  /** 該語言的 show_pronunciation */
  showPronunciation: boolean
}) {
  const { mastered, learning, unlearnedCount, total, tierCounts } = collection

  if (total === 0) {
    return (
      <p className="text-sm text-ink-soft py-10 text-center">
        這個語言還沒有單字。建立單字本並開始每日任務，掌握的單字會收進卡冊。
      </p>
    )
  }

  const pct = Math.round((mastered.length / total) * 100)

  return (
    <div className="space-y-10">
      <section className="bg-cream border border-line rounded-lg p-5">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-3">
          <div>
            <div className="font-mono text-[11px] tracking-[0.06em] text-ink-soft mb-1">已收集</div>
            <div className="font-serif font-black text-3xl text-gold">
              {mastered.length}
              <span className="text-sm font-medium text-ink-soft ml-1">/ {total} 張</span>
            </div>
          </div>
          <ul className="flex gap-4 text-[12px] text-ink-soft">
            {COLLECTION_TIERS.map((t) => (
              <li key={t.stage} className="text-center">
                <div className="font-serif font-bold text-lg text-ink">{tierCounts[t.stage] ?? 0}</div>
                {t.name}
              </li>
            ))}
          </ul>
        </div>
        <div className="h-1.5 rounded-full bg-paper-deep overflow-hidden">
          <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[12px] text-ink-soft mt-2">
          單字在不同日期連續答對、升到 stage 4 就會收進卡冊；之後繼續答對，卡框會一路升級到「滿級」。點卡片可以翻面看中文。
        </p>
      </section>

      <section>
        <h2 className="font-serif font-bold text-xl mb-3">
          已掌握 <span className="font-mono text-sm text-ink-soft font-normal">{mastered.length}</span>
        </h2>
        {mastered.length === 0 ? (
          <p className="text-sm text-ink-soft">還沒有收藏卡。每日任務持續答對，最快約 11 天會收進第一張。</p>
        ) : (
          <CardGrid words={mastered} language={language} show={showPronunciation} />
        )}
      </section>

      {learning.length > 0 && (
        <section>
          <h2 className="font-serif font-bold text-xl mb-3">
            學習中 <span className="font-mono text-sm text-ink-soft font-normal">{learning.length}</span>
          </h2>
          <CardGrid words={learning} language={language} show={showPronunciation} />
        </section>
      )}

      {unlearnedCount > 0 && (
        <section className="flex items-center gap-5">
          <div className="relative w-[92px] h-[120px] shrink-0" aria-hidden>
            {[2, 1, 0].map((i) => (
              <div
                key={i}
                className="absolute inset-0 rounded-lg border border-line bg-paper-deep"
                style={{ transform: `translate(${i * 4}px, ${i * 4}px) rotate(${i * 2}deg)` }}
              />
            ))}
          </div>
          <p className="text-sm text-ink-soft">
            還有 <b className="text-ink">{unlearnedCount}</b> 張尚未翻開，會由每日任務依建立順序陸續引入。
          </p>
        </section>
      )}
    </div>
  )
}
