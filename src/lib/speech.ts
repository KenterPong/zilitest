/**
 * 單字發音（技術規格 v5 第十一節：第二階段，瀏覽器 Web Speech API，英日韓皆支援、免費）。
 * 純函式：挑語音、決定要唸的文字；實際播放在 SpeakButton / useSpeech。
 */

import type { Language } from '@/types/vocab'

export const SPEECH_LOCALE: Record<Language, string> = {
  en: 'en-US',
  ja: 'ja-JP',
  ko: 'ko-KR',
}

/** 只取 SpeechSynthesisVoice 用得到的欄位，方便測試 */
export interface VoiceLike {
  name: string
  lang: string
  default?: boolean
  localService?: boolean
}

/** 名稱帶這些字的通常是較自然的高品質語音 */
const QUALITY_HINTS = ['natural', 'neural', 'premium', 'enhanced', 'google', 'siri']

function langOf(voiceLang: string): string {
  return voiceLang.replace('_', '-').toLowerCase()
}

/**
 * 挑選語音：同語言才列入；完全符合地區（en-US）優先，其次高品質語音，再其次系統預設。
 * 沒有該語言的語音時回傳 null（不顯示發音按鈕）。
 */
export function pickVoice<T extends VoiceLike>(voices: T[], language: Language): T | null {
  const locale = SPEECH_LOCALE[language].toLowerCase()
  const prefix = locale.slice(0, 2)
  const candidates = voices.filter((v) => langOf(v.lang).startsWith(prefix))
  if (candidates.length === 0) return null

  const score = (v: T) => {
    const name = v.name.toLowerCase()
    let s = 0
    if (langOf(v.lang) === locale) s += 4
    if (QUALITY_HINTS.some((h) => name.includes(h))) s += 2
    if (v.default) s += 1
    return s
  }
  return candidates.reduce((best, v) => (score(v) > score(best) ? v : best))
}

/** 要唸的文字：日文有讀音時唸讀音，避免語音引擎把漢字唸錯 */
export function speechText(term: string, reading: string | null | undefined, language: Language): string {
  const r = reading?.trim()
  return language === 'ja' && r ? r : term.trim()
}

/** 例句整句朗讀：日文有朗讀用假名時唸假名版，否則唸原句 */
export function exampleSpeechText(example: string, tts: string | null | undefined, language: Language): string {
  const k = tts?.trim()
  return language === 'ja' && k ? k : example.trim()
}

/** 自動播放設定只存在這台裝置（localStorage） */
export const AUTO_SPEAK_KEY = 'zilitest:auto-speak'
