'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'

import { ScopeFilter } from '@/components/ScopeFilter'
import type { DbTag, WordbookWithCount } from '@/types/vocab'

interface CardItem {
  word_id: string
  term: string
  answer: string
  description: string | null
  familiarity: 'unknown' | 'known' | null
}

interface CardsClientProps {
  wordbooks: WordbookWithCount[]
  tags: DbTag[]
  initialWordbookId?: string
}

export function CardsClient({
  wordbooks,
  tags,
  initialWordbookId,
}: CardsClientProps) {
  const [wordbookIds, setWordbookIds] = useState<string[]>(
    initialWordbookId ? [initialWordbookId] : []
  )
  const [tagIds, setTagIds] = useState<string[]>([])
  const [poolSize, setPoolSize] = useState(0)
  const [phase, setPhase] = useState<'setup' | 'play'>('setup')
  const [cards, setCards] = useState<CardItem[]>([])
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [knownCount, setKnownCount] = useState(0)
  const [unknownCount, setUnknownCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onFilterChange = useCallback((wb: string[], tg: string[], size: number) => {
    setWordbookIds(wb)
    setTagIds(tg)
    setPoolSize(size)
  }, [])

  async function start() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/cards/pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordbook_ids: wordbookIds, tag_ids: tagIds }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '無法開始背誦')
        return
      }
      setCards(data.cards)
      setIdx(0)
      setFlipped(false)
      setKnownCount(0)
      setUnknownCount(0)
      setPhase('play')
    } catch {
      setError('網路錯誤')
    } finally {
      setLoading(false)
    }
  }

  async function mark(familiarity: 'known' | 'unknown') {
    const card = cards[idx]
    if (!card) return
    void fetch('/api/cards/familiarity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word_id: card.word_id, familiarity }),
    })
    if (familiarity === 'known') setKnownCount((c) => c + 1)
    else setUnknownCount((c) => c + 1)

    if (idx + 1 >= cards.length) {
      setIdx(cards.length)
      setFlipped(false)
    } else {
      setIdx(idx + 1)
      setFlipped(false)
    }
  }

  const done = phase === 'play' && idx >= cards.length
  const card = cards[idx]

  if (phase === 'play') {
    const quizHref =
      '/app/quiz' +
      (wordbookIds[0] ? `?wordbook=${wordbookIds[0]}` : '')

    if (done) {
      return (
        <div className="flex flex-col items-center py-10">
          <h2 className="font-serif font-black text-2xl mb-3">本輪背誦結束</h2>
          <p className="font-mono text-sm text-ink-soft mb-6">
            認得 {knownCount} ・ 不認得 {unknownCount} ・ 共 {cards.length} 張
          </p>
          <div className="flex gap-3 flex-wrap justify-center">
            <button
              type="button"
              onClick={() => setPhase('setup')}
              className="border border-line bg-cream px-5 py-2.5 rounded-sm text-sm font-medium"
            >
              變更篩選
            </button>
            <button
              type="button"
              onClick={start}
              className="bg-ink text-cream px-5 py-2.5 rounded-sm text-sm font-medium"
            >
              再背一輪
            </button>
            <Link
              href={quizHref}
              className="bg-stamp-red text-cream px-5 py-2.5 rounded-sm text-sm font-bold"
            >
              直接開始測驗 →
            </Link>
          </div>
          <Link href="/app" className="mt-6 text-sm text-ink-soft underline">
            回首頁
          </Link>
        </div>
      )
    }

    return (
      <div className="flex flex-col items-center py-5">
        <div className="flex items-center gap-2.5 text-[13px] text-ink-soft mb-6">
          背誦範圍已選定
          <button
            type="button"
            onClick={() => setPhase('setup')}
            className="font-mono text-[11.5px] border-b border-dotted border-ink-soft"
          >
            變更篩選
          </button>
        </div>
        <div className="font-mono text-xs text-ink-soft mb-4">
          第 {idx + 1} / {cards.length} 張 ・ 不認得 {unknownCount}・認得 {knownCount}
        </div>

        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          className="w-[420px] max-w-[90%] min-h-[230px] bg-cream border border-line rounded-[10px] shadow-lg flex flex-col items-center justify-center text-center p-8"
        >
          <div className="font-serif font-black text-[34px] mb-3.5">{card.term}</div>
          {flipped ? (
            <>
              <div className="text-[15.5px] text-ink-soft mb-2">{card.answer}</div>
              {card.description && (
                <div className="text-[12.5px] text-ink-soft border-t border-dashed border-line pt-2.5 mt-2.5 max-w-[320px]">
                  {card.description}
                </div>
              )}
            </>
          ) : (
            <div className="font-mono text-[11px] text-ink-soft mt-3.5">
              點卡片查看答案
            </div>
          )}
        </button>

        <div className="flex gap-3.5 mt-6">
          <button
            type="button"
            onClick={() => mark('unknown')}
            className="bg-cream border-[1.5px] border-stamp-red text-stamp-red-deep font-bold px-8 py-3 rounded-sm text-[14.5px]"
          >
            不認得
          </button>
          <button
            type="button"
            onClick={() => mark('known')}
            className="bg-ink text-cream font-bold px-8 py-3 rounded-sm text-[14.5px]"
          >
            認得
          </button>
        </div>

        <div className="flex gap-5 mt-5 text-[12.5px] text-ink-soft">
          <button
            type="button"
            disabled={idx === 0}
            onClick={() => {
              setIdx((i) => Math.max(0, i - 1))
              setFlipped(false)
            }}
            className="disabled:opacity-40 hover:text-ink"
          >
            ← 上一張
          </button>
          <button
            type="button"
            onClick={() => setPhase('setup')}
            className="hover:text-ink"
          >
            結束背誦
          </button>
        </div>

        <div className="mt-8 border-t border-line pt-4 w-full text-center text-sm">
          背完想確認記得多少？
          <br />
          <Link
            href={quizHref}
            className="font-bold text-stamp-red-deep border-b border-stamp-red-deep"
          >
            直接開始測驗 →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="text-[12.5px] text-ink-soft mb-2.5">
        <Link href="/app" className="border-b border-dotted border-ink-soft">
          我的單字本
        </Link>
        {' ／ 卡牌背誦'}
      </p>
      <h1 className="font-serif font-black text-2xl mb-6">卡牌背誦</h1>

      <ScopeFilter
        wordbooks={wordbooks}
        tags={tags}
        initialWordbookIds={initialWordbookId ? [initialWordbookId] : []}
        onChange={onFilterChange}
      />

      {error && <p className="text-sm text-stamp-red mb-3">{error}</p>}

      <button
        type="button"
        disabled={wordbookIds.length === 0 || poolSize === 0 || loading}
        onClick={start}
        className="bg-stamp-red text-cream font-bold text-[15px] px-8 py-3.5 rounded-sm disabled:opacity-60"
      >
        {loading ? '準備中…' : '開始背誦'}
      </button>
      <Link href="/app" className="ml-3 text-sm text-ink-soft underline">
        返回
      </Link>
    </div>
  )
}
