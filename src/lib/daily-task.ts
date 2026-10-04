/**
 * 每日任務產生與出題方式（技術規格 v5 第八節 4.、5.）
 * 純函式：輸入某語言的全部單字與熟練度，回傳今日複習字與新字。
 */

import { MASTERED_STAGE } from '@/lib/progress'
import type { TaipeiDate } from '@/lib/taipei-date'

/** 選擇題需 1 正確 + 3 干擾項 */
export const MIN_WORDS_FOR_TASK = 4
/** 到期字數 > 複習上限 × 此倍數時，當日不引入新字 */
export const BACKLOG_MULTIPLIER = 2

export interface TaskCandidateWord {
  id: string
  created_at: string
  wordbook_created_at: string
  /** 無 word_progress row 時為 0 */
  stage: number
  due_date: TaipeiDate | null
  lapse_count: number
}

export interface TaskLimits {
  daily_review_limit: number
  daily_new_limit: number
}

export type DailyTaskPlan =
  | { status: 'too_few_words'; word_count: number }
  | { status: 'nothing_to_do' }
  | { status: 'ok'; review_word_ids: string[]; new_word_ids: string[] }

export function planDailyTask(
  words: TaskCandidateWord[],
  limits: TaskLimits,
  today: TaipeiDate
): DailyTaskPlan {
  if (words.length < MIN_WORDS_FOR_TASK) {
    return { status: 'too_few_words', word_count: words.length }
  }

  // 日期皆為 YYYY-MM-DD，字串比較即日期比較
  const due = words
    .filter((w) => w.stage >= 1 && w.due_date !== null && w.due_date <= today)
    .sort((a, b) => {
      if (a.due_date !== b.due_date) return a.due_date! < b.due_date! ? -1 : 1
      return b.lapse_count - a.lapse_count
    })

  const newLimit =
    due.length > limits.daily_review_limit * BACKLOG_MULTIPLIER ? 0 : limits.daily_new_limit

  const fresh = words
    .filter((w) => w.stage === 0)
    .sort((a, b) => {
      if (a.wordbook_created_at !== b.wordbook_created_at) {
        return a.wordbook_created_at < b.wordbook_created_at ? -1 : 1
      }
      if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1
      return a.id < b.id ? -1 : 1
    })

  const review_word_ids = due.slice(0, limits.daily_review_limit).map((w) => w.id)
  const new_word_ids = fresh.slice(0, newLimit).map((w) => w.id)

  if (review_word_ids.length === 0 && new_word_ids.length === 0) {
    return { status: 'nothing_to_do' }
  }
  return { status: 'ok', review_word_ids, new_word_ids }
}

/** 每日任務題型：新字先看卡片再選擇；stage 1–3 選擇題；stage ≥ 4 填空題 */
export type TaskQuestionKind = 'new' | 'mcq' | 'fill'

export function questionKindFor(stage: number, isNew: boolean): TaskQuestionKind {
  if (isNew || stage === 0) return 'new'
  return stage >= MASTERED_STAGE ? 'fill' : 'mcq'
}

/**
 * 選擇題干擾項：從同語言其他單字的中文意思隨機取 n 個，
 * 排除與正確答案相同、以及彼此重複的文字，避免出現兩個正確選項。
 */
export function pickDistractors(
  correct: string,
  candidates: string[],
  n = 3,
  random: () => number = Math.random
): string[] {
  const key = (s: string) => s.trim()
  const seen = new Set([key(correct)])
  const unique: string[] = []
  for (const c of candidates) {
    const k = key(c)
    if (!k || seen.has(k)) continue
    seen.add(k)
    unique.push(c)
  }
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[unique[i], unique[j]] = [unique[j], unique[i]]
  }
  return unique.slice(0, n)
}

/**
 * 任務完成狀態（第八節 6.）：只計仍存在的單字。
 * empty：任務中的字已全部刪除，不算完成，視同當日該語言沒有任務
 */
export type TaskCompletion = 'empty' | 'done' | 'pending'

export function taskCompletion(remainingWords: number, answeredRemaining: number): TaskCompletion {
  if (remainingWords === 0) return 'empty'
  return answeredRemaining >= remainingWords ? 'done' : 'pending'
}
