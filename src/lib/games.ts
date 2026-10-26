/**
 * 小遊戲（技術規格 v5 第十二節）的純邏輯：出題、計分、個人最佳。
 */

import { normalizeAnswer } from '@/lib/answer-match'
import type { Language } from '@/types/vocab'

/** 拼字挑戰已取消；資料庫 CHECK 仍允許 'spell'，但程式不再接受 */
export const GAMES = ['match', 'listen'] as const
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
  pronunciation?: string | null
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

/** 配對越快越好；聽音答對越多越好 */
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

// ---------- 聽音辨字（第十二節 4.） ----------

/** 一局 60 秒 */
export const LISTEN_DURATION_MS = 60_000
/** 每題 4 個選項 */
export const LISTEN_CHOICES = 4
/** 作答後顯示對錯與中文意思的時間（計時照算） */
export const LISTEN_FEEDBACK_MS = 1200
/** 成績合理上限：60 秒內不可能答對超過 60 題 */
export const LISTEN_MAX_SCORE = 60
/** 題庫上限（避免字很多時傳太大的資料給瀏覽器） */
export const LISTEN_POOL_LIMIT = 300

export interface ListenWord {
  id: string
  term: string
  reading: string | null
  /** 作答後的第二層顯示用 */
  pronunciation: string | null
  /** 只取第一個譯義（作答後顯示） */
  meaning: string
  /** stage ≥ 1（學過的字），再玩一局重新洗牌時仍排在前面 */
  learned: boolean
}

export interface ListenQuestion {
  answer: ListenWord
  choices: ListenWord[]
}

/**
 * 同一題不可同時出現的比對鍵：外文本身；日文另加「讀音」（沒填讀音時以單字本身當讀音），
 * 比照填空題正規化（NFKC、大小寫、片假名 → 平假名）。英文同音字（right / write）不另外排除。
 */
export function listenKeys(w: { term: string; reading: string | null }, language: Language): string[] {
  const term = normalizeAnswer(w.term)
  if (language !== 'ja') return [term]
  return [term, `sound:${normalizeAnswer(w.reading?.trim() || w.term)}`]
}

function conflicts(a: string[], taken: Set<string>): boolean {
  return a.some((k) => taken.has(k))
}

/** 題庫：學過的字（stage ≥ 1）在前、新字在後，各自打散；出題時依序輪流當正解 */
export function buildListenPool(
  words: GameWord[],
  random: () => number = Math.random,
  limit = LISTEN_POOL_LIMIT
): ListenWord[] {
  const toListen = (w: GameWord): ListenWord => ({
    id: w.id,
    term: w.term,
    reading: w.reading,
    pronunciation: w.pronunciation ?? null,
    meaning: firstMeaning(w.answer),
    learned: w.stage >= 1,
  })
  const learned = shuffled(
    words.filter((w) => w.stage >= 1 && w.term.trim()),
    random
  )
  const fresh = shuffled(
    words.filter((w) => w.stage < 1 && w.term.trim()),
    random
  )
  return [...learned, ...fresh].slice(0, limit).map(toListen)
}

/** 再玩一局：學過的字與新字各自重新打散，學過的字仍在前 */
export function reshuffleListenPool(pool: ListenWord[], random: () => number = Math.random): ListenWord[] {
  return [
    ...shuffled(
      pool.filter((w) => w.learned),
      random
    ),
    ...shuffled(
      pool.filter((w) => !w.learned),
      random
    ),
  ]
}

/** 題庫中能否湊出 4 個彼此不衝突的字（不足時不開放） */
export function canStartListen(pool: ListenWord[], language: Language): boolean {
  const taken = new Set<string>()
  let count = 0
  for (const w of pool) {
    const keys = listenKeys(w, language)
    if (conflicts(keys, taken)) continue
    keys.forEach((k) => taken.add(k))
    if (++count >= LISTEN_CHOICES) return true
  }
  return false
}

/** 以 target 為正解出一題：另挑 3 個不衝突的干擾選項後打散；湊不滿回傳 null */
export function makeListenQuestion(
  pool: ListenWord[],
  target: ListenWord,
  language: Language,
  random: () => number = Math.random
): ListenQuestion | null {
  const taken = new Set(listenKeys(target, language))
  const picks: ListenWord[] = []
  for (const w of shuffled(
    pool.filter((p) => p.id !== target.id),
    random
  )) {
    if (picks.length >= LISTEN_CHOICES - 1) break
    const keys = listenKeys(w, language)
    if (conflicts(keys, taken)) continue
    keys.forEach((k) => taken.add(k))
    picks.push(w)
  }
  if (picks.length < LISTEN_CHOICES - 1) return null
  return { answer: target, choices: shuffled([target, ...picks], random) }
}

/**
 * 從題庫第 start 個字起找下一題（輪流當正解，跳過湊不出選項的字）。
 * 回傳題目與下一次的起點；整個題庫都湊不出時回傳 null。
 */
export function nextListenQuestion(
  pool: ListenWord[],
  start: number,
  language: Language,
  random: () => number = Math.random
): { question: ListenQuestion; next: number } | null {
  for (let i = 0; i < pool.length; i++) {
    const idx = (start + i) % pool.length
    const q = makeListenQuestion(pool, pool[idx]!, language, random)
    if (q) return { question: q, next: idx + 1 }
  }
  return null
}

/** 成績檢查：答對題數 0–60；出題數 ≥ 1，介於答對數與「答對＋答錯＋最後一題未作答」之間 */
export function isValidListenResult(score: number, wordCount: number, mistakes: number): boolean {
  return (
    Number.isInteger(score) &&
    Number.isInteger(wordCount) &&
    Number.isInteger(mistakes) &&
    score >= 0 &&
    score <= LISTEN_MAX_SCORE &&
    wordCount >= 1 &&
    wordCount >= score &&
    wordCount <= score + mistakes + 1 &&
    mistakes >= 0
  )
}
