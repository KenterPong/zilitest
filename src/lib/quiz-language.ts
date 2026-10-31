/**
 * 自由練習依語言出題（技術規格 v5 第五節 5.–7.、9.，2026/10/31）：
 * 干擾項與是非題替換字只取同語言的字；字數防呆依語言計算，不足的語言不出題。
 * 一般題型與例句題型共用。
 */
import { shuffled } from '@/lib/games'
import { LANGUAGE_LABELS, LANGUAGES, type Language } from '@/types/vocab'

/**
 * 各題型每個語言至少需要的字數：選擇題 1 正確 + 3 干擾項、是非題要有另一個字可替換。
 * 例句題型同規則，以篩選範圍內該語言的全部字計算（干擾項不限有例句，第五節 9.）
 */
export const MIN_WORDS_PER_LANGUAGE = {
  tf: 2,
  choice: 4,
  input: 1,
  example_tf: 2,
  example_choice: 4,
  example_reorder: 1,
} as const

export type LanguageCounts = Partial<Record<Language, number>>

export function countByLanguage(words: { language: Language }[]): LanguageCounts {
  const counts: LanguageCounts = {}
  for (const w of words) counts[w.language] = (counts[w.language] ?? 0) + 1
  return counts
}

/** 依各語言字數判斷哪些語言可出題（固定依 en / ja / ko 順序） */
export function splitLanguagesByMinimum(
  counts: LanguageCounts,
  min: number
): { ok: Language[]; insufficient: Language[] } {
  const present = LANGUAGES.filter((l) => (counts[l] ?? 0) > 0)
  return {
    ok: present.filter((l) => counts[l]! >= min),
    insufficient: present.filter((l) => counts[l]! < min),
  }
}

/** 只留下字數達門檻的語言的字；所有語言都不足時 eligible 為空 */
export function filterEligibleByLanguage<T extends { language: Language }>(
  words: T[],
  min: number
): { eligible: T[]; insufficient: Language[] } {
  const { ok, insufficient } = splitLanguagesByMinimum(countByLanguage(words), min)
  return { eligible: words.filter((w) => ok.includes(w.language)), insufficient }
}

/** 從同語言的其他字隨機抽 n 個（不足時有幾個給幾個） */
export function pickSameLanguage<T extends { id: string; language: Language }>(
  pool: T[],
  word: { id: string; language: Language },
  n: number,
  random: () => number = Math.random
): T[] {
  const others = pool.filter((w) => w.id !== word.id && w.language === word.language)
  return shuffled(others, random).slice(0, n)
}

/** 不足語言的說明文字，例如「日文少於 4 個字」；沒有不足的語言時回傳 null */
export function insufficientLanguagesText(insufficient: Language[], min: number): string | null {
  if (insufficient.length === 0) return null
  return `${insufficient.map((l) => LANGUAGE_LABELS[l]).join('、')}少於 ${min} 個字`
}
