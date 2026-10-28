/**
 * 書寫練習（技術規格 v5 第六節 4.）的純邏輯：出題範圍、比對、回想順序與佇列、Enter 判定。
 * 比對一律沿用填空題（第五節 8.），不另寫一套。
 */
import { isFillAnswerCorrect, normalizeAnswer } from '@/lib/answer-match'
import { shuffled } from '@/lib/games'
import type { Language } from '@/types/vocab'

/** 一輪最多字數 */
export const WRITING_ROUND_SIZE = 10
/** term 正規化後長度上限（長句抄打負擔過重） */
export const WRITING_MAX_LENGTH = 30
/** 抄寫通過後停留時間 */
export const WRITING_COPY_PASS_MS = 500
/** 回想答對後停留時間 */
export const WRITING_RECALL_CORRECT_MS = 800

/** 正規化後長度 1–30 字元（以 code point 計）才出題 */
export function isWritable(term: string): boolean {
  const len = Array.from(normalizeAnswer(term)).length
  return len >= 1 && len <= WRITING_MAX_LENGTH
}

/** 與 term 或 reading（若有）任一個一致即通過；規則同填空題，三種語言相同 */
export function isWritingMatch(
  _language: Language,
  input: string,
  term: string,
  reading: string | null | undefined
): boolean {
  return isFillAnswerCorrect(input, term, reading)
}

/** 回想順序：打散；2 個字以上時第一題不可是抄寫段最後一張 */
export function buildRecallOrder(
  wordIds: string[],
  lastCopiedId: string | null,
  random: () => number = Math.random
): string[] {
  const order = shuffled(wordIds, random)
  if (order.length >= 2 && order[0] === lastCopiedId) {
    const j = 1 + Math.floor(random() * (order.length - 1))
    ;[order[0], order[j]] = [order[j]!, order[0]!]
  }
  return order
}

export type RecallOutcome = 'correct' | 'wrong'

export interface RecallQueue {
  /** 出題順序；第一次答錯的字會加到最後再出 1 次 */
  queue: string[]
  /** 目前題目在 queue 的位置 */
  index: number
  /** 每個字第一次回想的結果 */
  first: Record<string, RecallOutcome>
}

export function createRecallQueue(order: string[]): RecallQueue {
  return { queue: [...order], index: 0, first: {} }
}

export function currentRecallId(state: RecallQueue): string | null {
  return state.queue[state.index] ?? null
}

export function isRecallDone(state: RecallQueue): boolean {
  return state.index >= state.queue.length
}

/** 目前這題是否為該字第一次回想（只有第一次會寫入 card_familiarity） */
export function isFirstRecall(state: RecallQueue): boolean {
  const id = currentRecallId(state)
  return id !== null && !(id in state.first)
}

/**
 * 記錄目前這題的作答（「不會」視同答錯）。
 * 第一次：記入成績，答錯則加到最後再出 1 次；重出時只回傳顯示用結果，狀態不變
 */
export function answerRecall(state: RecallQueue, outcome: RecallOutcome): RecallQueue {
  const id = currentRecallId(state)
  if (id === null || id in state.first) return state
  return {
    ...state,
    queue: outcome === 'wrong' ? [...state.queue, id] : state.queue,
    first: { ...state.first, [id]: outcome },
  }
}

export function advanceRecall(state: RecallQueue): RecallQueue {
  return { ...state, index: Math.min(state.index + 1, state.queue.length) }
}

export interface RecallSummary {
  /** 第一次回想答對數 */
  correct: number
  total: number
  /** 依 wordIds 順序的每字第一次結果（尚未回想的字為 null） */
  results: { word_id: string; outcome: RecallOutcome | null }[]
  /** 應寫入 card_familiarity 的清單 */
  familiarity: { word_id: string; familiarity: 'known' | 'unknown' }[]
}

export function summarizeRecall(state: RecallQueue, wordIds: string[]): RecallSummary {
  const results = wordIds.map((id) => ({ word_id: id, outcome: state.first[id] ?? null }))
  return {
    correct: results.filter((r) => r.outcome === 'correct').length,
    total: wordIds.length,
    results,
    familiarity: results
      .filter((r) => r.outcome !== null)
      .map((r) => ({
        word_id: r.word_id,
        familiarity: r.outcome === 'correct' ? ('known' as const) : ('unknown' as const),
      })),
  }
}

/** Enter 是否觸發判定：組字中（isComposing 或 keyCode 229）的 Enter 是輸入法確認，不觸發 */
export function shouldSubmitOnEnter(e: { key: string; isComposing: boolean; keyCode: number }): boolean {
  return e.key === 'Enter' && !e.isComposing && e.keyCode !== 229
}
