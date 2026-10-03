import { describe, expect, it } from 'vitest'

import { ACHIEVEMENTS, levelFor, satisfiedAchievements } from '@/lib/growth'

describe('levelFor', () => {
  it('門檻邊界', () => {
    expect(levelFor(0)).toEqual({ level: 1, currentThreshold: 0, nextThreshold: 50 })
    expect(levelFor(49).level).toBe(1)
    expect(levelFor(50).level).toBe(2)
    expect(levelFor(149).level).toBe(2)
    expect(levelFor(150).level).toBe(3)
    expect(levelFor(4999).level).toBe(8)
  })

  it('滿級', () => {
    expect(levelFor(5000)).toEqual({ level: 9, currentThreshold: 5000, nextThreshold: null })
    expect(levelFor(99999).level).toBe(9)
  })
})

describe('satisfiedAchievements', () => {
  it('成就代碼不重複', () => {
    const keys = ACHIEVEMENTS.map((a) => a.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toContain('mastered_en_100')
    expect(keys).toContain('mastered_total_500')
    expect(keys).toContain('streak_30')
    expect(keys).toContain('polyglot_3')
  })

  it('沒有任何進度', () => {
    expect(satisfiedAchievements({ masteredByLanguage: {}, currentStreak: 0 })).toEqual([])
  })

  it('單一語言與總掌握', () => {
    const keys = satisfiedAchievements({ masteredByLanguage: { en: 120 }, currentStreak: 0 })
    expect(keys).toEqual(['mastered_en_50', 'mastered_en_100', 'mastered_total_100'])
  })

  it('總掌握跨語言加總', () => {
    const keys = satisfiedAchievements({ masteredByLanguage: { en: 60, ja: 45 }, currentStreak: 0 })
    expect(keys).toContain('mastered_total_100')
    expect(keys).not.toContain('mastered_ja_50')
  })

  it('連續天數', () => {
    const keys = satisfiedAchievements({ masteredByLanguage: {}, currentStreak: 7 })
    expect(keys).toEqual(['streak_3', 'streak_7'])
  })

  it('多語學習者需各語言 ≥ 100', () => {
    expect(
      satisfiedAchievements({ masteredByLanguage: { en: 100, ja: 99 }, currentStreak: 0 })
    ).not.toContain('polyglot_2')
    const keys = satisfiedAchievements({
      masteredByLanguage: { en: 100, ja: 100, ko: 100 },
      currentStreak: 0,
    })
    expect(keys).toContain('polyglot_2')
    expect(keys).toContain('polyglot_3')
  })
})
