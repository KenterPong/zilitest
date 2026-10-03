import { describe, expect, it } from 'vitest'

import { applyNoTaskDay, applyTaskCompleted, checkStreakBreak } from '@/lib/streak'

const today = '2026-10-10'

describe('applyTaskCompleted', () => {
  it('昨天有計入：+1 並更新最長', () => {
    expect(
      applyTaskCompleted({ current_streak: 4, longest_streak: 4, last_streak_date: '2026-10-09' }, today)
    ).toEqual({ current_streak: 5, longest_streak: 5, last_streak_date: today })
  })

  it('今天已計入：不變', () => {
    const s = { current_streak: 5, longest_streak: 9, last_streak_date: today }
    expect(applyTaskCompleted(s, today)).toBe(s)
  })

  it('中斷過：從 1 開始，最長保留', () => {
    expect(
      applyTaskCompleted({ current_streak: 0, longest_streak: 9, last_streak_date: '2026-10-01' }, today)
    ).toEqual({ current_streak: 1, longest_streak: 9, last_streak_date: today })
  })

  it('第一次完成', () => {
    expect(
      applyTaskCompleted({ current_streak: 0, longest_streak: 0, last_streak_date: null }, today)
    ).toEqual({ current_streak: 1, longest_streak: 1, last_streak_date: today })
  })
})

describe('checkStreakBreak', () => {
  it('最後計入日為昨天：保持', () => {
    const s = { current_streak: 3, longest_streak: 3, last_streak_date: '2026-10-09' }
    expect(checkStreakBreak(s, today, false)).toBe(s)
  })

  it('最後計入日為前天：歸零', () => {
    expect(
      checkStreakBreak({ current_streak: 3, longest_streak: 3, last_streak_date: '2026-10-08' }, today, false)
    ).toEqual({ current_streak: 0, longest_streak: 3, last_streak_date: '2026-10-08' })
  })

  it('凍結中不歸零', () => {
    const s = { current_streak: 3, longest_streak: 3, last_streak_date: '2026-09-01' }
    expect(checkStreakBreak(s, today, true)).toBe(s)
  })
})

describe('applyNoTaskDay', () => {
  it('保持：最後計入日設為今天，不加一', () => {
    expect(
      applyNoTaskDay({ current_streak: 3, longest_streak: 5, last_streak_date: '2026-10-09' }, today)
    ).toEqual({ current_streak: 3, longest_streak: 5, last_streak_date: today })
  })

  it('保持後隔天完成任務可接續', () => {
    const kept = applyNoTaskDay(
      { current_streak: 3, longest_streak: 5, last_streak_date: '2026-10-09' },
      today
    )
    expect(applyTaskCompleted(kept, '2026-10-11').current_streak).toBe(4)
  })
})
