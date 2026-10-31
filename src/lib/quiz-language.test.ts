import { describe, expect, it } from 'vitest'

import {
  countByLanguage,
  filterEligibleByLanguage,
  insufficientLanguagesText,
  MIN_WORDS_PER_LANGUAGE,
  pickSameLanguage,
  splitLanguagesByMinimum,
} from '@/lib/quiz-language'
import type { Language } from '@/types/vocab'

function words(language: Language, n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `${language}${i}`, language }))
}

describe('countByLanguage', () => {
  it('依語言計數', () => {
    expect(countByLanguage([...words('en', 3), ...words('ja', 1)])).toEqual({ en: 3, ja: 1 })
  })
})

describe('filterEligibleByLanguage', () => {
  it('單一語言足夠', () => {
    const pool = words('en', 4)
    const r = filterEligibleByLanguage(pool, MIN_WORDS_PER_LANGUAGE.choice)
    expect(r.eligible).toHaveLength(4)
    expect(r.insufficient).toEqual([])
  })

  it('雙語言各自足夠', () => {
    const pool = [...words('en', 4), ...words('ja', 5)]
    const r = filterEligibleByLanguage(pool, MIN_WORDS_PER_LANGUAGE.choice)
    expect(r.eligible).toHaveLength(9)
    expect(r.insufficient).toEqual([])
  })

  it('其中一語言不足被排除', () => {
    const pool = [...words('en', 6), ...words('ja', 3)]
    const r = filterEligibleByLanguage(pool, MIN_WORDS_PER_LANGUAGE.choice)
    expect(r.eligible.every((w) => w.language === 'en')).toBe(true)
    expect(r.eligible).toHaveLength(6)
    expect(r.insufficient).toEqual(['ja'])
  })

  it('全部不足', () => {
    const pool = [...words('en', 1), ...words('ko', 1)]
    const r = filterEligibleByLanguage(pool, MIN_WORDS_PER_LANGUAGE.tf)
    expect(r.eligible).toEqual([])
    expect(r.insufficient).toEqual(['en', 'ko'])
  })

  it('填空題每個語言 1 個字即可', () => {
    const r = filterEligibleByLanguage([...words('en', 1), ...words('ja', 1)], MIN_WORDS_PER_LANGUAGE.input)
    expect(r.eligible).toHaveLength(2)
  })
})

describe('splitLanguagesByMinimum', () => {
  it('沒有字的語言不列入', () => {
    expect(splitLanguagesByMinimum({ en: 2, ko: 0 }, 2)).toEqual({ ok: ['en'], insufficient: [] })
  })
})

describe('pickSameLanguage', () => {
  it('只取同語言、不含自己', () => {
    const pool = [...words('en', 5), ...words('ja', 5)]
    for (let i = 0; i < 50; i++) {
      const picked = pickSameLanguage(pool, pool[0]!, 3)
      expect(picked).toHaveLength(3)
      expect(picked.every((w) => w.language === 'en' && w.id !== 'en0')).toBe(true)
      expect(new Set(picked.map((w) => w.id)).size).toBe(3)
    }
  })

  it('同語言不足時有幾個給幾個', () => {
    const pool = [...words('en', 2), ...words('ja', 5)]
    expect(pickSameLanguage(pool, pool[0]!, 3)).toEqual([pool[1]])
  })
})

describe('insufficientLanguagesText', () => {
  it('列出不足的語言', () => {
    expect(insufficientLanguagesText(['ja', 'ko'], 4)).toBe('日文、韓文少於 4 個字')
    expect(insufficientLanguagesText([], 4)).toBeNull()
  })
})
