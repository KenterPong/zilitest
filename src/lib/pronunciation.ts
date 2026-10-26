/**
 * 發音標註產生（技術規格 v5 第十三節）：英文 IPA 音標、韓文羅馬拼音，寫入 words.pronunciation。
 * 不呼叫 AI；英文查 CMUdict（ARPAbet 轉 IPA），韓文以 es-hangul 依標準發音轉國語羅馬字。
 * 日文第二層直接取 reading，一律回傳 null。
 * CMUdict 約 4.7 MB，只在第一次需要時動態載入，且只應由伺服器端程式引用。
 */
import { romanize } from 'es-hangul'

import type { Language } from '@/types/vocab'

/** 不含重音數字的音素；母音另依重音區分（AH、ER） */
const ARPABET_IPA: Record<string, string> = {
  AA: 'ɑ',
  AE: 'æ',
  AO: 'ɔ',
  AW: 'aʊ',
  AY: 'aɪ',
  EH: 'ɛ',
  EY: 'eɪ',
  IH: 'ɪ',
  IY: 'i',
  OW: 'oʊ',
  OY: 'ɔɪ',
  UH: 'ʊ',
  UW: 'u',
  B: 'b',
  CH: 'tʃ',
  D: 'd',
  DH: 'ð',
  F: 'f',
  G: 'ɡ',
  HH: 'h',
  JH: 'dʒ',
  K: 'k',
  L: 'l',
  M: 'm',
  N: 'n',
  NG: 'ŋ',
  P: 'p',
  R: 'r',
  S: 's',
  SH: 'ʃ',
  T: 't',
  TH: 'θ',
  V: 'v',
  W: 'w',
  Y: 'j',
  Z: 'z',
  ZH: 'ʒ',
}

/**
 * ARPAbet（如 "AH0 B AW1 T"）→ IPA（不含斜線）。
 * 依重音數字轉換母音：AH0 → ə、AH1/2 → ʌ，ER0 → ɚ、ER1/2 → ɝ；第一版不標 ˈ ˌ。
 * 遇到無法辨識的音素回傳 null
 */
export function arpabetToIpa(arpabet: string): string | null {
  let out = ''
  for (const token of arpabet.trim().split(/\s+/)) {
    const m = /^([A-Z]+)([0-2])?$/.exec(token)
    if (!m) return null
    const [, phone, stress] = m
    if (phone === 'AH') out += stress === '0' ? 'ə' : 'ʌ'
    else if (phone === 'ER') out += stress === '0' ? 'ɚ' : 'ɝ'
    else if (ARPABET_IPA[phone]) out += ARPABET_IPA[phone]
    else return null
  }
  return out || null
}

export type ArpabetLookup = (word: string) => string | undefined

/**
 * 英文：去頭尾空白、轉小寫後查字典（有多個發音時字典即回傳第一個）。
 * 片語逐字查詢，全部查得到才以空格串接，否則 null。結果以 /…/ 包住
 */
export function englishPronunciation(term: string, lookup: ArpabetLookup): string | null {
  const words = term.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return null
  const parts: string[] = []
  for (const w of words) {
    const arpabet = lookup(w)
    const ipa = arpabet ? arpabetToIpa(arpabet) : null
    if (!ipa) return null
    parts.push(ipa)
  }
  return `/${parts.join(' ')}/`
}

const HANGUL_SYLLABLE = /[가-힣]/

/** 韓文：term 含韓文字才轉換；音變處理以 es-hangul 的能力為準 */
export function koreanPronunciation(term: string): string | null {
  const t = term.trim()
  if (!HANGUL_SYLLABLE.test(t)) return null
  const r = romanize(t).trim()
  return r || null
}

let cmuLookup: Promise<ArpabetLookup> | null = null

function loadCmuLookup(): Promise<ArpabetLookup> {
  cmuLookup ??= import('cmu-pronouncing-dictionary').then(({ dictionary }) => {
    const dict = dictionary as Record<string, string>
    return (word: string) => (Object.prototype.hasOwnProperty.call(dict, word) ? dict[word] : undefined)
  })
  return cmuLookup
}

/** 寫入 words 時計算 pronunciation；ja 與無法產生時為 null */
export async function generatePronunciation(language: Language, term: string): Promise<string | null> {
  if (language === 'en') return englishPronunciation(term, await loadCmuLookup())
  if (language === 'ko') return koreanPronunciation(term)
  return null
}
