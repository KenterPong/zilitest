/**
 * 等級與成就（技術規格 v5 第九節 1.、3.）
 * 成就定義寫在程式碼常數，不建資料表；一經解鎖永不收回。
 */

import { LANGUAGE_LABELS, LANGUAGES, type Language } from '@/types/vocab'

/** 等級門檻：索引 i 對應 Lv.(i+1) 所需的歷史最高掌握數 */
export const LEVEL_THRESHOLDS = [0, 50, 150, 300, 600, 1000, 2000, 3500, 5000] as const

export interface LevelInfo {
  level: number
  /** 下一級門檻；已滿級為 null */
  nextThreshold: number | null
  currentThreshold: number
}

/** 等級只升不降：以 peak_mastered_count 計算 */
export function levelFor(peakMastered: number): LevelInfo {
  let idx = 0
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (peakMastered >= LEVEL_THRESHOLDS[i]) idx = i
  }
  return {
    level: idx + 1,
    currentThreshold: LEVEL_THRESHOLDS[idx],
    nextThreshold: idx + 1 < LEVEL_THRESHOLDS.length ? LEVEL_THRESHOLDS[idx + 1] : null,
  }
}

export type AchievementCategory = 'language' | 'total' | 'streak' | 'polyglot'

export interface AchievementDef {
  key: string
  category: AchievementCategory
  name: string
  description: string
  threshold: number
  language?: Language
}

const LANGUAGE_THRESHOLDS = [50, 100, 300, 500, 1000, 2000]
const TOTAL_THRESHOLDS = [100, 500, 1000, 3000, 5000]
const STREAK_THRESHOLDS = [3, 7, 30, 100, 365]
const POLYGLOT_LANGUAGES = [2, 3]
const POLYGLOT_MIN_MASTERED = 100

export const ACHIEVEMENTS: AchievementDef[] = [
  ...LANGUAGES.flatMap((language) =>
    LANGUAGE_THRESHOLDS.map((n) => ({
      key: `mastered_${language}_${n}`,
      category: 'language' as const,
      name: `${LANGUAGE_LABELS[language]} ${n.toLocaleString('en-US')} 字`,
      description: `${LANGUAGE_LABELS[language]}掌握 ${n.toLocaleString('en-US')} 個單字`,
      threshold: n,
      language,
    }))
  ),
  ...TOTAL_THRESHOLDS.map((n) => ({
    key: `mastered_total_${n}`,
    category: 'total' as const,
    name: `總掌握 ${n.toLocaleString('en-US')} 字`,
    description: `跨語言合計掌握 ${n.toLocaleString('en-US')} 個單字`,
    threshold: n,
  })),
  ...STREAK_THRESHOLDS.map((n) => ({
    key: `streak_${n}`,
    category: 'streak' as const,
    name: `連續 ${n} 天`,
    description: `連續 ${n} 天完成每日任務`,
    threshold: n,
  })),
  ...POLYGLOT_LANGUAGES.map((n) => ({
    key: `polyglot_${n}`,
    category: 'polyglot' as const,
    name: `${n} 語學習者`,
    description: `${n} 種語言各掌握 ${POLYGLOT_MIN_MASTERED} 字以上`,
    threshold: n,
  })),
]

export const ACHIEVEMENT_BY_KEY = new Map(ACHIEVEMENTS.map((a) => [a.key, a]))

export interface AchievementInput {
  /** 各語言目前已掌握字數 */
  masteredByLanguage: Partial<Record<Language, number>>
  currentStreak: number
}

/** 回傳目前條件下已達成的全部成就代碼（呼叫端負責排除已解鎖者） */
export function satisfiedAchievements(input: AchievementInput): string[] {
  const mastered = (lang: Language) => input.masteredByLanguage[lang] ?? 0
  const total = LANGUAGES.reduce((sum, lang) => sum + mastered(lang), 0)
  const polyglotCount = LANGUAGES.filter((lang) => mastered(lang) >= POLYGLOT_MIN_MASTERED).length

  return ACHIEVEMENTS.filter((a) => {
    switch (a.category) {
      case 'language':
        return mastered(a.language!) >= a.threshold
      case 'total':
        return total >= a.threshold
      case 'streak':
        return input.currentStreak >= a.threshold
      case 'polyglot':
        return polyglotCount >= a.threshold
    }
  }).map((a) => a.key)
}
