'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ScopeFilter } from '@/components/ScopeFilter'
import { SwipeCard, type SwipeCardHandle } from '@/components/SwipeCard'
import { WritingPractice } from '@/components/WritingPractice'
import type { PronunciationPrefs } from '@/lib/pronunciation-display'
import { speechText } from '@/lib/speech'
import { useAutoSpeak, useSpeaker } from '@/lib/use-speech'
import { isWritable, WRITING_MAX_LENGTH, WRITING_ROUND_SIZE } from '@/lib/writing'
import type { DbTag, Language, WordbookWithCount } from '@/types/vocab'

interface CardItem {
  word_id: string
  term: string
  reading: string | null
  pronunciation: string | null
  answer: string
  description: string | null
  language: Language
  familiarity: 'unknown' | 'known' | null
}

interface CardsClientProps {
  wordbooks: WordbookWithCount[]
  tags: DbTag[]
  initialWordbookId?: string
  pronunciationPrefs: PronunciationPrefs
}

export function CardsClient({
  wordbooks,
  tags,
  initialWordbookId,
  pronunciationPrefs,
}: CardsClientProps) {
  const [wordbookIds, setWordbookIds] = useState<string[]>(
    initialWordbookId ? [initialWordbookId] : []
  )
  const [tagIds, setTagIds] = useState<string[]>([])
  const [poolSize, setPoolSize] = useState(0)
  const [poolLoading, setPoolLoading] = useState(!!initialWordbookId)
  const [phase, setPhase] = useState<'setup' | 'play'>('setup')
  const [mode, setMode] = useState<'swipe' | 'write'>('swipe')
  /** 書寫練習每輪重新掛載，狀態從頭開始 */
  const [round, setRound] = useState(0)
  const [cards, setCards] = useState<CardItem[]>([])
  const [idx, setIdx] = useState(0)
  const swipeRef = useRef<SwipeCardHandle>(null)
  const [knownCount, setKnownCount] = useState(0)
  const [unknownCount, setUnknownCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onFilterChange = useCallback(
    (wb: string[], tg: string[], size: number, loadingPool: boolean) => {
      setWordbookIds(wb)
      setTagIds(tg)
      setPoolSize(size)
      setPoolLoading(loadingPool)
    },
    []
  )

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
        setPhase('setup')
        return
      }
      if (mode === 'write') {
        // 依加權順序套用出題範圍後取前 10 個
        const writable = (data.cards as CardItem[]).filter((c) => isWritable(c.term))
        if (writable.length === 0) {
          setError(`篩選結果的單字都超過 ${WRITING_MAX_LENGTH} 個字元，無法書寫練習`)
          setPhase('setup')
          return
        }
        setCards(writable.slice(0, WRITING_ROUND_SIZE))
        setRound((r) => r + 1)
      } else {
        setCards(data.cards)
      }
      setIdx(0)
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

    setIdx((i) => Math.min(i + 1, cards.length))
  }

  const card = cards[idx]
  // 背誦範圍可能跨語言，每張卡依自己的語言發音；hook 依語言各取一次
  const speakEn = useSpeaker('en')
  const speakJa = useSpeaker('ja')
  const speakKo = useSpeaker('ko')
  const [autoSpeak] = useAutoSpeak()
  const speakCard = useCallback(() => {
    if (!card) return
    const speak = card.language === 'ja' ? speakJa : card.language === 'ko' ? speakKo : speakEn
    speak?.(speechText(card.term, card.reading, card.language))
  }, [card, speakEn, speakJa, speakKo])

  // 自動播放：每張新卡出現時唸一次（設定頁開關，預設關閉）
  useEffect(() => {
    if (phase === 'play' && mode === 'swipe' && autoSpeak && card) speakCard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, mode, autoSpeak, card?.word_id])

  // 鍵盤：← 不認得、→ 認得、空白鍵翻面、S 發音
  useEffect(() => {
    if (phase !== 'play' || mode !== 'swipe') return
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowRight') swipeRef.current?.fly('known')
      else if (e.key === 'ArrowLeft') swipeRef.current?.fly('unknown')
      else if (e.key === ' ') swipeRef.current?.flip()
      else if (e.key === 's' || e.key === 'S') speakCard()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, mode, speakCard])

  const done = phase === 'play' && idx >= cards.length

  if (phase === 'play' && mode === 'write') {
    return (
      <WritingPractice
        key={round}
        cards={cards}
        pronunciationPrefs={pronunciationPrefs}
        onRestart={start}
        onExit={() => setPhase('setup')}
      />
    )
  }

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

        <div className="relative w-[420px] max-w-[90%]">
          {Array.from({ length: Math.min(cards.length - idx - 1, 2) }, (_, i) => (
            <div
              key={i}
              className="absolute inset-0 rounded-lg border border-line bg-cream"
              style={{ transform: `translate(${(i + 1) * 5}px, ${(i + 1) * 5}px) rotate(${(i + 1) * 1.3}deg)` }}
              aria-hidden
            />
          ))}
          <SwipeCard
            key={card.word_id}
            ref={swipeRef}
            term={card.term}
            reading={card.reading}
            pronunciation={card.pronunciation}
            answer={card.answer}
            description={card.description}
            language={card.language}
            showPronunciation={pronunciationPrefs[card.language]}
            onDecide={(choice) => void mark(choice)}
          />
        </div>
        <p className="text-[12px] text-ink-soft mt-4">
          <span className="sm:hidden">左滑不認得、右滑認得，點卡片翻面</span>
          <span className="hidden sm:inline">拖曳或鍵盤 ← 不認得、→ 認得，空白鍵翻面、S 發音</span>
        </p>

        <div className="flex gap-3.5 mt-4">
          <button
            type="button"
            onClick={() => swipeRef.current?.fly('unknown')}
            className="bg-cream border-[1.5px] border-stamp-red text-stamp-red-deep font-bold px-8 py-3 rounded-sm text-[14.5px]"
          >
            不認得
          </button>
          <button
            type="button"
            onClick={() => swipeRef.current?.fly('known')}
            className="bg-ink text-cream font-bold px-8 py-3 rounded-sm text-[14.5px]"
          >
            認得
          </button>
        </div>

        <div className="flex gap-5 mt-5 text-[12.5px] text-ink-soft">
          <button
            type="button"
            disabled={idx === 0}
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
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

      <div className="mb-5">
        <div className="text-[13px] font-bold mb-2">背誦方式</div>
        <div role="radiogroup" aria-label="背誦方式" className="inline-flex border border-line rounded-[5px] overflow-hidden">
          {(
            [
              ['swipe', '滑卡'],
              ['write', '書寫'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => {
                setMode(value)
                setError(null)
              }}
              className={`px-5 py-2 text-sm font-medium ${
                mode === value ? 'bg-ink text-cream' : 'bg-cream text-ink-soft hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-[12px] text-ink-soft mt-2">
          {mode === 'swipe'
            ? '翻卡自評認得或不認得'
            : `先照著抄打，整輪抄完再看中文憑記憶打出單字（每輪最多 ${WRITING_ROUND_SIZE} 個字）`}
        </p>
      </div>

      {error && <p className="text-sm text-stamp-red mb-3">{error}</p>}

      <button
        type="button"
        disabled={
          wordbookIds.length === 0 || poolLoading || poolSize === 0 || loading
        }
        onClick={start}
        className="bg-stamp-red text-cream font-bold text-[15px] px-8 py-3.5 rounded-sm disabled:opacity-60"
      >
        {loading ? '準備中…' : poolLoading ? '計算單字池…' : mode === 'write' ? '開始書寫' : '開始背誦'}
      </button>
      <Link href="/app" className="ml-3 text-sm text-ink-soft underline">
        返回
      </Link>
    </div>
  )
}
