import { describe, expect, it } from 'vitest'

import {
  arpabetToIpa,
  englishPronunciation,
  generatePronunciation,
  koreanPronunciation,
} from '@/lib/pronunciation'
import { needsReadingHint, prefsFromSettings, secondLine } from '@/lib/pronunciation-display'

const dict: Record<string, string> = {
  apple: 'AE1 P AH0 L',
  about: 'AH0 B AW1 T',
  bird: 'B ER1 D',
  teacher: 'T IY1 CH ER0',
  new: 'N UW1',
  york: 'Y AO1 R K',
}
const lookup = (w: string) => dict[w]

describe('arpabetToIpa', () => {
  it('依重音轉換 AH 與 ER，不標重音符號', () => {
    expect(arpabetToIpa('AH0 B AW1 T')).toBe('əbaʊt')
    expect(arpabetToIpa('B AH1 T')).toBe('bʌt')
    expect(arpabetToIpa('B ER1 D')).toBe('bɝd')
    expect(arpabetToIpa('T IY1 CH ER0')).toBe('titʃɚ')
  })

  it('無法辨識的音素回傳 null', () => {
    expect(arpabetToIpa('XX1 B')).toBeNull()
  })
})

describe('englishPronunciation', () => {
  it('一般單字，去頭尾空白並忽略大小寫', () => {
    expect(englishPronunciation('  Apple ', lookup)).toBe('/æpəl/')
  })

  it('片語全部查得到才以空格串接', () => {
    expect(englishPronunciation('New York', lookup)).toBe('/nu jɔrk/')
    expect(englishPronunciation('new zilitest', lookup)).toBeNull()
  })

  it('查不到的字回傳 null', () => {
    expect(englishPronunciation('zilitest', lookup)).toBeNull()
  })
})

describe('koreanPronunciation', () => {
  it('依標準發音轉羅馬拼音（含音變）', () => {
    expect(koreanPronunciation('학교')).toBe('hakgyo')
    expect(koreanPronunciation('같이')).toBe('gachi')
    expect(koreanPronunciation('신라')).toBe('silla')
  })

  it('不含韓文字回傳 null', () => {
    expect(koreanPronunciation('SNS')).toBeNull()
  })
})

describe('generatePronunciation', () => {
  it('英文查 CMUdict；多個發音取第一個', async () => {
    expect(await generatePronunciation('en', 'about')).toBe('/əbaʊt/')
    expect(await generatePronunciation('en', 'read')).toBe('/rɛd/')
    expect(await generatePronunciation('en', 'zilitestx')).toBeNull()
  })

  it('韓文轉羅馬拼音，日文一律 null', async () => {
    expect(await generatePronunciation('ko', '같이')).toBe('gachi')
    expect(await generatePronunciation('ja', '受ける')).toBeNull()
  })
})

describe('secondLine', () => {
  it('英韓取 pronunciation，日文取 reading', () => {
    expect(secondLine('en', { term: 'about', pronunciation: '/əbaʊt/' })).toBe('/əbaʊt/')
    expect(secondLine('ko', { term: '같이', pronunciation: 'gachi' })).toBe('gachi')
    expect(secondLine('ja', { term: '受ける', reading: 'うける', pronunciation: 'x' })).toBe('うける')
  })

  it('日文讀音為空或與 term 相同時不顯示', () => {
    expect(secondLine('ja', { term: 'はし', reading: 'はし' })).toBeNull()
    expect(secondLine('ja', { term: '橋', reading: '  ' })).toBeNull()
  })

  it('關閉顯示或沒有資料時不顯示', () => {
    expect(secondLine('en', { term: 'about', pronunciation: '/əbaʊt/' }, false)).toBeNull()
    expect(secondLine('en', { term: 'zilitest', pronunciation: null })).toBeNull()
  })
})

describe('needsReadingHint', () => {
  it('日文含漢字且未填讀音才提示', () => {
    expect(needsReadingHint('ja', '受ける', null)).toBe(true)
    expect(needsReadingHint('ja', '受ける', 'うける')).toBe(false)
    expect(needsReadingHint('ja', 'はし', null)).toBe(false)
    expect(needsReadingHint('en', 'apple', null)).toBe(false)
  })
})

describe('prefsFromSettings', () => {
  it('只有明確關閉的語言為 false', () => {
    expect(
      prefsFromSettings([
        { language: 'en', show_pronunciation: false },
        { language: 'ja', show_pronunciation: true },
      ])
    ).toEqual({ en: false, ja: true, ko: true })
  })
})
