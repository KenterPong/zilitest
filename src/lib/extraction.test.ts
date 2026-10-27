import { describe, expect, it } from 'vitest'

import {
  appendTranscript,
  buildExtractionPrompt,
  buildTranscriptionPrompt,
  cleanExtracted,
  fitWithin,
  isValidLevel,
  levelLabel,
  levelsUpTo,
  limitMeanings,
  monthlyLimit,
  OWNER_MONTHLY_LIMIT,
  OWNER_USER_IDS,
  taipeiMonthStartDate,
  taipeiMonthStartInstant,
  validateImages,
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

  it('站長帳號 300，但暫停或刪除時仍為 0', () => {
    const owner = OWNER_USER_IDS[0]!
    expect(monthlyLimit('trial', owner)).toBe(OWNER_MONTHLY_LIMIT)
    expect(monthlyLimit('active', owner)).toBe(OWNER_MONTHLY_LIMIT)
    expect(monthlyLimit('suspended', owner)).toBe(0)
    expect(monthlyLimit('cancelled', owner)).toBe(0)
    expect(monthlyLimit('trial', 'someone-else')).toBe(10)
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
    expect(r).toEqual([{ term: 'Journey', answer: '旅程', description: '名詞', reading: null, level: null }])
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

describe('levelsUpTo', () => {
  it('設定等級以及以下（由易到難）', () => {
    expect(levelsUpTo('en', 'B2')).toEqual(['A2', 'B1', 'B2'])
    expect(levelsUpTo('ja', 'N3')).toEqual(['N5', 'N4', 'N3'])
    expect(levelsUpTo('ko', '1')).toEqual(['1'])
    expect(levelsUpTo('en', 'N3')).toEqual([])
  })
})

describe('cleanExtracted 等級', () => {
  const raw = [
    { term: 'apple', answer: '蘋果', description: null, reading: null, level: 'A2' },
    { term: 'reimburse', answer: '償還', description: null, reading: null, level: 'B2' },
    { term: 'journey', answer: '旅程', description: null, reading: null, level: 'B1' },
    { term: 'ubiquitous', answer: '普遍存在的', description: null, reading: null, level: 'C1' },
    { term: 'borrow', answer: '借', description: null, reading: null, level: 'B2' },
  ]

  it('範圍外的等級標為 null，依等級由難到易排序、同級維持原順序', () => {
    const r = cleanExtracted(raw, [], ['A2', 'B1', 'B2'])
    expect(r.map((w) => `${w.term}:${w.level}`)).toEqual([
      'reimburse:B2',
      'borrow:B2',
      'journey:B1',
      'apple:A2',
      'ubiquitous:null',
    ])
  })

  it('去掉 AI 加上的制度名稱', () => {
    const r = cleanExtracted(
      [
        { term: '약속', answer: '約定', level: 'TOPIK 2' },
        { term: '공부', answer: '學習', level: '1級' },
      ],
      [],
      ['1', '2', '3']
    )
    expect(r.map((w) => w.level)).toEqual(['2', '1'])
  })

  it('沒傳範圍時不排序', () => {
    expect(cleanExtracted(raw, []).map((w) => w.term)).toEqual(raw.map((w) => w.term))
  })
})

describe('buildExtractionPrompt', () => {
  it('包含語言與等級，日文要求讀音', () => {
    const p = buildExtractionPrompt('ja', 'N3')
    expect(p).toContain('JLPT N3')
    expect(p).toContain('JLPT N5, JLPT N4, JLPT N3')
    expect(p).toContain('hiragana reading')
  })

  it('英文讀音為 null', () => {
    const p = buildExtractionPrompt('en', 'B1')
    expect(p).toContain('CEFR B1')
    expect(p).toContain('reading: always null')
  })
})

describe('validateImages', () => {
  const img = (type: string, size = 1000) => ({ type, size })

  it('只接受 JPG、PNG、WebP', () => {
    expect(validateImages([img('image/jpeg')])).toBeNull()
    expect(validateImages([img('image/png'), img('image/webp')])).toBeNull()
    expect(validateImages([img('image/jpeg'), img('image/heic')])).not.toBeNull()
    expect(validateImages([img('application/pdf')])).not.toBeNull()
  })

  it('1–2 張', () => {
    expect(validateImages([])).not.toBeNull()
    expect(validateImages([img('image/jpeg'), img('image/jpeg'), img('image/jpeg')])).toBe('一次最多 2 張圖片')
  })

  it('空檔與合計大小上限', () => {
    expect(validateImages([img('image/jpeg', 0)])).not.toBeNull()
    expect(validateImages([img('image/jpeg', 2_000_000), img('image/jpeg', 2_000_000)])).toBeNull()
    expect(validateImages([img('image/jpeg', 2_000_000), img('image/jpeg', 2_000_001)])).not.toBeNull()
  })
})

describe('fitWithin', () => {
  it('長邊縮到上限、維持比例', () => {
    expect(fitWithin(4032, 3024, 1800)).toEqual({ width: 1800, height: 1350 })
    expect(fitWithin(1080, 2400, 1800)).toEqual({ width: 810, height: 1800 })
  })

  it('小圖不放大', () => {
    expect(fitWithin(800, 600, 1800)).toEqual({ width: 800, height: 600 })
  })
})

describe('appendTranscript', () => {
  it('空白文字框直接填入', () => {
    expect(appendTranscript('', '  昨日、駅に行った。\n')).toBe('昨日、駅に行った。')
  })

  it('接在既有內容後空一行', () => {
    expect(appendTranscript('第一段\n', '第二段')).toBe('第一段\n\n第二段')
  })

  it('轉譯結果為空時不變', () => {
    expect(appendTranscript('原本的字', '   ')).toBe('原本的字')
  })
})

describe('buildTranscriptionPrompt', () => {
  it('要求照原文轉錄、不翻譯', () => {
    const p = buildTranscriptionPrompt('ko')
    expect(p).toContain('Korean')
    expect(p).toContain('Do not translate')
  })
})
