'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Stamp } from '@/components/Stamp'
import { secondLine } from '@/lib/pronunciation-display'
import {
  formatMatchTime,
  MATCH_PENALTY_MS,
  matchScore,
  MATCH_WORD_COUNT,
  seededRandom,
  type MatchCardWord,
} from '@/lib/games'
import { LANGUAGE_LABELS, type Language } from '@/types/vocab'

interface Tile {
  key: string
  wordId: string
  side: 'term' | 'meaning'
  text: string
  sub: string | null
}

interface MatchGameProps {
  language: Language
  initialWords: MatchCardWord[]
  initialBest: number | null
  /** 第一局洗牌種子（由伺服器產生，讓伺服器與瀏覽器的牌序一致） */
  seed: number
  /** 該語言的 show_pronunciation；第一版只顯示日文讀音，不顯示英文音標與韓文羅馬拼音 */
  showPronunciation: boolean
}

/** 配錯後兩張牌標示錯誤的時間 */
const WRONG_FLASH_MS = 500

function buildTiles(words: MatchCardWord[], random: () => number, showReading: boolean): Tile[] {
  const tiles: Tile[] = words.flatMap((w) => [
    { key: `${w.id}-t`, wordId: w.id, side: 'term' as const, text: w.term, sub: secondLine('ja', w, showReading) },
    { key: `${w.id}-m`, wordId: w.id, side: 'meaning' as const, text: w.meaning, sub: null },
  ])
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[tiles[i], tiles[j]] = [tiles[j], tiles[i]]
  }
  return tiles
}

/** 配對消除（第十二節 3.）：12 張牌正面朝上，外文與中文配對，越快越好 */
export function MatchGame({ language, initialWords, initialBest, seed, showPronunciation }: MatchGameProps) {
  const label = LANGUAGE_LABELS[language]
  // 只有日文單字有讀音；英韓的 reading 為 null
  const showReading = language === 'ja' && showPronunciation
  const [tiles, setTiles] = useState<Tile[]>(() => buildTiles(initialWords, seededRandom(seed), showReading))
  const [selected, setSelected] = useState<string | null>(null)
  const [matched, setMatched] = useState<Set<string>>(new Set())
  const [wrong, setWrong] = useState<string[]>([])
  const [mistakes, setMistakes] = useState(0)
  const startRef = useRef<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState<{ score: number; isNewBest: boolean; best: number | null } | null>(null)
  const [best, setBest] = useState(initialBest)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const running = startRef.current !== null && result === null

  // 計時：從第一次點牌開始
  useEffect(() => {
    if (!running) return
    const t = window.setInterval(() => {
      if (startRef.current !== null) setElapsed(performance.now() - startRef.current)
    }, 100)
    return () => window.clearInterval(t)
  }, [running])

  const finish = useCallback(
    async (finalMistakes: number) => {
      const ms = startRef.current !== null ? performance.now() - startRef.current : 0
      const score = matchScore(ms, finalMistakes)
      setElapsed(ms)
      setResult({ score, isNewBest: false, best })
      try {
        const res = await fetch('/api/games/scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            game: 'match',
            language,
            word_count: MATCH_WORD_COUNT,
            score,
            mistakes: finalMistakes,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? '成績儲存失敗')
          return
        }
        setResult({ score, isNewBest: data.is_new_best, best: data.best })
        setBest(data.best)
      } catch {
        setError('網路錯誤，成績未儲存')
      }
    },
    [best, language]
  )

  function pick(tile: Tile) {
    if (result || matched.has(tile.wordId) || wrong.length > 0) return
    if (startRef.current === null) startRef.current = performance.now()

    if (selected === null) {
      setSelected(tile.key)
      return
    }
    if (selected === tile.key) {
      setSelected(null)
      return
    }
    const first = tiles.find((t) => t.key === selected)
    if (!first) return
    // 同一邊（都是外文或都是中文）就改選這張
    if (first.side === tile.side) {
      setSelected(tile.key)
      return
    }
    if (first.wordId === tile.wordId) {
      const next = new Set(matched)
      next.add(tile.wordId)
      setMatched(next)
      setSelected(null)
      if (next.size === MATCH_WORD_COUNT) void finish(mistakes)
      return
    }
    setMistakes((m) => m + 1)
    setWrong([first.key, tile.key])
    window.setTimeout(() => {
      setWrong([])
      setSelected(null)
    }, WRONG_FLASH_MS)
  }

  async function playAgain() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/games/match?language=${language}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '無法開始新的一局')
        return
      }
      // 之後的局只在瀏覽器產生，可直接用 Math.random
      setTiles(buildTiles(data.words, Math.random, showReading))
      setSelected(null)
      setMatched(new Set())
      setWrong([])
      setMistakes(0)
      startRef.current = null
      setElapsed(0)
      setResult(null)
    } catch {
      setError('網路錯誤，請再試一次')
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div className="max-w-md mx-auto text-center py-6">
        <div className="bg-cream border border-line rounded-lg p-8 shadow-[0_18px_40px_rgba(30,42,64,0.14)]">
          <div className="flex justify-center mb-4 min-h-[96px] items-center">
            {result.isNewBest ? <Stamp label="新紀錄" size="lg" animate /> : <Stamp label="完成" size="lg" />}
          </div>
          <h1 className="font-serif font-black text-3xl mb-1">{formatMatchTime(result.score)}</h1>
          <p className="text-sm text-ink-soft mb-6">
            用時 {formatMatchTime(elapsed)}
            {mistakes > 0 && ` ＋ 配錯 ${mistakes} 次（每次罰 ${MATCH_PENALTY_MS / 1000} 秒）`}
          </p>
          {result.best !== null && !result.isNewBest && (
            <p className="font-mono text-[12px] text-ink-soft mb-6">{label}個人最佳 {formatMatchTime(result.best)}</p>
          )}
          {error && <p className="text-sm text-stamp-red mb-4">{error}</p>}
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              type="button"
              autoFocus
              disabled={loading}
              onClick={() => void playAgain()}
              className="bg-stamp-red text-cream font-bold text-sm px-6 py-3 rounded-[5px] hover:bg-stamp-red-deep disabled:opacity-60"
            >
              {loading ? '準備中…' : '再玩一局'}
            </button>
            <Link
              href="/app/games"
              className="bg-cream border border-line text-ink font-semibold text-sm px-6 py-3 rounded-[5px] hover:border-ink"
            >
              回遊戲
            </Link>
          </div>
          <p className="text-[12px] text-ink-soft mt-5">遊戲成績不影響熟練度與連續天數。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between text-[12.5px] text-ink-soft mb-4 flex-wrap gap-2">
        <span>
          <Link href="/app/games" className="border-b border-dotted border-ink-soft">
            遊戲
          </Link>
          {` ／ 配對消除 ・ ${label}`}
        </span>
        <span className="font-mono text-[12px]">
          {matched.size} / {MATCH_WORD_COUNT} 對 ・ {formatMatchTime(elapsed)}
          {mistakes > 0 && <span className="text-stamp-red"> ・ 罰 {mistakes * (MATCH_PENALTY_MS / 1000)} 秒</span>}
        </span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
        {tiles.map((t) => {
          const isMatched = matched.has(t.wordId)
          const isSelected = selected === t.key
          const isWrong = wrong.includes(t.key)
          const state = isWrong
            ? 'border-stamp-red bg-warn-bg tile-shake'
            : isSelected
              ? 'border-stamp-red'
              : 'border-line hover:border-ink'
          return (
            <button
              key={t.key}
              type="button"
              disabled={isMatched}
              aria-pressed={isSelected}
              onClick={() => pick(t)}
              className={`card-ruled min-h-[88px] rounded-lg border-[1.5px] px-2 py-3 flex flex-col items-center justify-center text-center shadow-[0_4px_12px_rgba(30,42,64,0.06)] transition-colors ${state} ${isMatched ? 'tile-matched' : ''}`}
            >
              <span
                className={
                  t.side === 'term'
                    ? 'font-serif font-bold text-[18px] leading-tight break-words'
                    : 'text-[15px] leading-snug break-words'
                }
              >
                {t.text}
              </span>
              {t.sub && <span className="text-[11.5px] text-ink-soft mt-0.5">{t.sub}</span>}
            </button>
          )
        })}
      </div>

      <p className="text-xs text-ink-soft mt-4">
        點一張外文、再點對應的中文（順序不限）。配錯一次罰 {MATCH_PENALTY_MS / 1000} 秒；從第一次點牌開始計時。
        {best !== null && ` ${label}個人最佳 ${formatMatchTime(best)}。`}
      </p>
      {error && <p className="text-sm text-stamp-red mt-2">{error}</p>}
    </div>
  )
}
