/**
 * 小遊戲（技術規格 v5 第十二節）的純邏輯：出題、計分、個人最佳。
 */

import { normalizeAnswer } from '@/lib/answer-match'

export const GAMES = ['match', 'listen', 'spell'] as const
export type GameKey = (typeof GAMES)[number]

export function isGameKey(value: unknown): value is GameKey {
  return typeof value === 'string' && (GAMES as readonly string[]).includes(value)
}

/** 配對消除：一局 6 個字（12 張牌） */
export const MATCH_WORD_COUNT = 6
/** 配錯一次加罰毫秒 */
export const MATCH_PENALTY_MS = 3000

export interface GameWord {
  id: string
  term: string
  reading: string | null
  answer: string
  stage: number
}

export interface MatchCardWord {
  id: string
  term: string
  reading: string | null
  /** 只取第一個譯義 */
  meaning: string
}

/** 中文只顯示第一個譯義（以頓號等分隔） */
export function firstMeaning(answer: string): string {
  return (
    answer
      .split(/[、,，;；/]/)
      .map((s) => s.trim())
      .find(Boolean) ?? answer.trim()
  )
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * 抽出一局的字：優先 stage ≥ 1（學過的字），不足以 stage 0 補足；
 * 第一個譯義或外文正規化後相同的字不同時入選。字數不足回傳 null。
 */
export function pickGameWords(
  words: GameWord[],
  count = MATCH_WORD_COUNT,
  random: () => number = Math.random
): MatchCardWord[] | null {
  const learned = shuffled(
    words.filter((w) => w.stage >= 1),
    random
  )
  const fresh = shuffled(
    words.filter((w) => w.stage < 1),
    random
  )
  const seenMeaning = new Set<string>()
  const seenTerm = new Set<string>()
  const picked: MatchCardWord[] = []

  for (const w of [...learned, ...fresh]) {
    if (picked.length >= count) break
    const meaning = firstMeaning(w.answer)
    const mKey = normalizeAnswer(meaning)
    const tKey = normalizeAnswer(w.term)
    if (!mKey || !tKey || seenMeaning.has(mKey) || seenTerm.has(tKey)) continue
    seenMeaning.add(mKey)
    seenTerm.add(tKey)
    picked.push({ id: w.id, term: w.term, reading: w.reading, meaning })
  }
  return picked.length >= count ? picked : null
}

/** 配對成績：經過時間 + 罰秒（毫秒，越小越好） */
export function matchScore(elapsedMs: number, mistakes: number): number {
  return Math.max(0, Math.round(elapsedMs)) + mistakes * MATCH_PENALTY_MS
}

/** 配對越快越好；聽音與拼字答對越多越好 */
export function lowerIsBetter(game: GameKey): boolean {
  return game === 'match'
}

export function isNewBest(game: GameKey, score: number, previousBest: number | null): boolean {
  if (previousBest === null) return true
  return lowerIsBetter(game) ? score < previousBest : score > previousBest
}

/** 顯示配對成績：12.3 秒 */
export function formatMatchTime(ms: number): string {
  return `${(ms / 1000).toFixed(1)} 秒`
}

/**
 * 可重現的亂數（mulberry32）。第一局的洗牌由伺服器給定種子，
 * 讓伺服器渲染與瀏覽器得到相同牌序，避免 hydration 不一致。
 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
