import { describe, expect, it } from 'vitest'

import {
  buildExtractionPrompt,
  cleanExtracted,
  isValidLevel,
  levelLabel,
  limitMeanings,
  monthlyLimit,
  taipeiMonthStartDate,
  taipeiMonthStartInstant,
} from '@/lib/extraction'

describe('等級', () => {
  it('各語言只接受自己的等級', () => {
    expect(isValidLevel('en', 'B1')).toBe(true)
    expect(isValidLevel('en', 'N3')).toBe(false)
    expect(isValidLevel('ja', 'N3')).toBe(true)
    expect(isValidLevel('ko', '3')).toBe(true)
    expect(isValidLevel('ko', 3)).toBe(false)
  })

  it('顯示名稱', () => {
    expect(levelLabel('en', 'B2')).toBe('B2')
    expect(levelLabel('ko', '4')).toBe('TOPIK 4 級')
  })
})

describe('monthlyLimit', () => {
  it('試用 10、付費 50、暫停 0', () => {
    expect(monthlyLimit('trial')).toBe(10)
    expect(monthlyLimit('active')).toBe(50)
    expect(monthlyLimit('payment_failed')).toBe(50)
    expect(monthlyLimit('suspended')).toBe(0)
    expect(monthlyLimit('cancelled')).toBe(0)
  })
})

describe('台北自然月', () => {
  it('月初以台北時間計算', () => {
    // 台北 2026-11-01 00:30 = UTC 10-31 16:30
    expect(taipeiMonthStartDate(new Date('2026-10-31T16:30:00Z'))).toBe('2026-11-01')
    expect(taipeiMonthStartDate(new Date('2026-10-31T15:59:00Z'))).toBe('2026-10-01')
  })

  it('月初對應的 UTC 時間', () => {
    expect(taipeiMonthStartInstant(new Date('2026-10-11T03:00:00Z'))).toBe('2026-09-30T16:00:00.000Z')
    expect(taipeiMonthStartInstant(new Date('2027-01-15T00:00:00Z'))).toBe('2026-12-31T16:00:00.000Z')
  })
})

describe('limitMeanings', () => {
  it('最多 3 個譯義，統一以頓號分隔', () => {
    expect(limitMeanings('接受, 受到；承受、遭受')).toBe('接受、受到、承受')
    expect(limitMeanings('旅程')).toBe('旅程')
  })
})

describe('cleanExtracted', () => {
  it('去除空白、同篇重複與已存在的字', () => {
    const r = cleanExtracted(
      [
        { term: ' Journey ', answer: '旅程', description: '名詞', reading: null },
        { term: 'journey', answer: '旅行', description: null, reading: null },
        { term: 'Apple', answer: '蘋果', description: null, reading: null },
        { term: '', answer: 'x', description: null, reading: null },
        { term: 'borrow', answer: '', description: null, reading: null },
      ],
      ['apple']
    )
    expect(r).toEqual([{ term: 'Journey', answer: '旅程', description: '名詞', reading: null }])
  })

  it('讀音與單字相同時不存讀音', () => {
    const r = cleanExtracted(
      [
        { term: '受ける', answer: '接受', description: '動詞', reading: 'うける' },
        { term: 'たび', answer: '旅行', description: null, reading: 'たび' },
      ],
      []
    )
    expect(r.map((w) => w.reading)).toEqual(['うける', null])
  })

  it('型別不符的欄位視為空', () => {
    expect(cleanExtracted([{ term: 1, answer: '旅程' }], [])).toEqual([])
  })
})

describe('buildExtractionPrompt', () => {
  it('包含語言與等級，日文要求讀音', () => {
    const p = buildExtractionPrompt('ja', 'N3')
    expect(p).toContain('JLPT N3')
    expect(p).toContain('hiragana reading')
  })

  it('英文讀音為 null', () => {
    const p = buildExtractionPrompt('en', 'B1')
    expect(p).toContain('CEFR B1')
    expect(p).toContain('reading: always null')
  })
})
