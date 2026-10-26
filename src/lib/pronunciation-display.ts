/**
 * 單字第二層顯示（技術規格 v5 第十三節 1.、3.）：英文音標、日文讀音假名、韓文羅馬拼音。
 * 前後端共用的純函式，不引用字典。
 */
import type { Language } from '@/types/vocab'

export interface SecondLineSource {
  term: string
  reading?: string | null
  pronunciation?: string | null
}

/** 每個語言是否顯示第二層（user_language_settings.show_pronunciation，預設開啟） */
export type PronunciationPrefs = Record<Language, boolean>

export const DEFAULT_PRONUNCIATION_PREFS: PronunciationPrefs = { en: true, ja: true, ko: true }

/**
 * 第二層文字；不顯示時回傳 null。
 * en / ko 取 pronunciation；ja 取 reading，為空或與 term 相同時不顯示
 */
export function secondLine(language: Language, word: SecondLineSource, show = true): string | null {
  if (!show) return null
  if (language === 'ja') {
    const r = word.reading?.trim()
    return r && r !== word.term.trim() ? r : null
  }
  return word.pronunciation?.trim() || null
}

// tsconfig 未指定 target，正規表示式的 u 旗標須以建構子寫法
const HAN = new RegExp(String.raw`\p{Script=Han}`, 'u')

/** 日文含漢字但未填讀音：單字列表與編輯畫面提示「未填讀音」 */
export function needsReadingHint(language: Language, term: string, reading: string | null | undefined): boolean {
  return language === 'ja' && HAN.test(term) && !reading?.trim()
}

/** user_language_settings → 各語言開關；尚未建立設定的語言視為開啟 */
export function prefsFromSettings(
  settings: { language: Language; show_pronunciation?: boolean | null }[]
): PronunciationPrefs {
  const prefs = { ...DEFAULT_PRONUNCIATION_PREFS }
  for (const s of settings) {
    if (s.show_pronunciation === false) prefs[s.language] = false
  }
  return prefs
}
