/**
 * 熟練度與間隔複習（技術規格 v5 第八節 2.、3.）
 * 純函式：輸入目前狀態與作答結果，回傳新狀態；不碰資料庫。
 */

import { addDays, diffDays, type TaipeiDate } from '@/lib/taipei-date'

export const MAX_STAGE = 7
/** stage ≥ 4 視為「已掌握」 */
export const MASTERED_STAGE = 4

/** 各 stage 答對後的下次間隔天數 */
export const STAGE_INTERVAL_DAYS: Record<number, number> = {
  1: 1,
  2: 3,
  3: 7,
  4: 14,
  5: 30,
  6: 60,
  7: 120,
}

export interface ProgressState {
  stage: number
  due_date: TaipeiDate | null
  introduced_at: string | null
  last_reviewed_date: TaipeiDate | null
  lapse_count: number
  mastered_at: string | null
}

export const EMPTY_PROGRESS: ProgressState = {
  stage: 0,
  due_date: null,
  introduced_at: null,
  last_reviewed_date: null,
  lapse_count: 0,
  mastered_at: null,
}

export interface AnswerContext {
  isCorrect: boolean
  /** 每日任務中以新字身分首次學習 */
  isNewIntroduction: boolean
  today: TaipeiDate
  /** ISO 時間戳，寫入 introduced_at / mastered_at */
  now: string
}

export interface AnswerOutcome {
  next: ProgressState
  /** 是否需要寫回 word_progress */
  changed: boolean
  /** 本次作答使單字（重新）達到已掌握 */
  becameMastered: boolean
}

export function isMastered(stage: number): boolean {
  return stage >= MASTERED_STAGE
}

function unchanged(prev: ProgressState): AnswerOutcome {
  return { next: prev, changed: false, becameMastered: false }
}

export function applyAnswer(
  prevOrNull: ProgressState | null,
  ctx: AnswerContext
): AnswerOutcome {
  const prev = prevOrNull ?? EMPTY_PROGRESS
  const tomorrow = addDays(ctx.today, 1)

  // 每日首次規則：同一台北日期只有第一次影響熟練度的作答算數
  if (prev.last_reviewed_date === ctx.today) return unchanged(prev)

  // 新字引入：不論對錯一律 stage 1、明天複習
  if (prev.stage === 0) {
    if (!ctx.isNewIntroduction) return unchanged(prev)
    return {
      next: {
        ...prev,
        stage: 1,
        due_date: tomorrow,
        introduced_at: prev.introduced_at ?? ctx.now,
        last_reviewed_date: ctx.today,
      },
      changed: true,
      becameMastered: false,
    }
  }

  if (!ctx.isCorrect) {
    return {
      next: {
        ...prev,
        stage: 1,
        due_date: tomorrow,
        last_reviewed_date: ctx.today,
        lapse_count: prev.lapse_count + 1,
        mastered_at: null,
      },
      changed: true,
      becameMastered: false,
    }
  }

  // 答對但尚未到期：不升級（提前答對不算）
  const isDue = prev.due_date === null || diffDays(ctx.today, prev.due_date) >= 0
  if (!isDue) return unchanged(prev)

  const stage = Math.min(prev.stage + 1, MAX_STAGE)
  const becameMastered = isMastered(stage) && prev.mastered_at === null
  return {
    next: {
      ...prev,
      stage,
      due_date: addDays(ctx.today, STAGE_INTERVAL_DAYS[stage]),
      last_reviewed_date: ctx.today,
      mastered_at: becameMastered ? ctx.now : prev.mastered_at,
    },
    changed: true,
    becameMastered,
  }
}
