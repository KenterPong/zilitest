/**
 * 連續天數（技術規格 v5 第九節 2.）
 */

import { addDays, type TaipeiDate } from '@/lib/taipei-date'

export interface StreakState {
  current_streak: number
  longest_streak: number
  last_streak_date: TaipeiDate | null
}

/** 進入 App 時：最後計入日早於昨天且未凍結 → 歸零 */
export function checkStreakBreak(
  state: StreakState,
  today: TaipeiDate,
  frozen: boolean
): StreakState {
  if (frozen || state.current_streak === 0 || state.last_streak_date === null) return state
  if (state.last_streak_date >= addDays(today, -1)) return state
  return { ...state, current_streak: 0 }
}

/** 當日完成至少一個語言的每日任務 */
export function applyTaskCompleted(state: StreakState, today: TaipeiDate): StreakState {
  if (state.last_streak_date === today) return state
  const current =
    state.last_streak_date === addDays(today, -1) ? state.current_streak + 1 : 1
  return {
    current_streak: current,
    longest_streak: Math.max(state.longest_streak, current),
    last_streak_date: today,
  }
}

/**
 * 當日所有已啟用語言都沒有任務可做：視為保持，不加一也不中斷。
 * 須在 checkStreakBreak 之後呼叫，已中斷的紀錄不會因此被救回。
 */
export function applyNoTaskDay(state: StreakState, today: TaipeiDate): StreakState {
  if (state.last_streak_date === today) return state
  return { ...state, last_streak_date: today }
}
