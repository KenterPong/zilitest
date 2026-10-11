import { describe, expect, it } from 'vitest'

import {
  firstMeaning,
  formatMatchTime,
  isGameKey,
  isNewBest,
  matchScore,
  pickGameWords,
  seededRandom,
  type GameWord,
} from '@/lib/games'

let n = 0
function w(term: string, answer: string, stage: number): GameWord {
  n += 1
  return { id: `w${n}`, term, reading: null, answer, stage }
}

describe('firstMeaning', () => {
  it('取第一個譯義', () => {
    expect(firstMeaning('償還、退款、報銷')).toBe('償還')
    expect(firstMeaning('旅程')).toBe('旅程')
    expect(firstMeaning('、繼續')).toBe('繼續')
  })
})

describe('pickGameWords', () => {
  it('優先抽學過的字，不足以未學的字補足', () => {
    const words = [
      w('a', '一', 1),
      w('b', '二', 2),
      w('c', '三', 5),
      w('d', '四', 0),
      w('e', '五', 0),
      w('f', '六', 0),
      w('g', '七', 0),
    ]
    const picked = pickGameWords(words, 6, () => 0.5)!
    expect(picked).toHaveLength(6)
    const ids = picked.map((p) => p.id)
    for (const learned of words.filter((x) => x.stage >= 1)) expect(ids).toContain(learned.id)
  })

  it('第一個譯義相同的字不同時入選', () => {
    const words = [
      w('repay', '償還、還款', 2),
      w('reimburse', '償還、報銷', 2),
      w('b', '二', 1),
      w('c', '三', 1),
      w('d', '四', 1),
      w('e', '五', 1),
      w('f', '六', 1),
    ]
    const picked = pickGameWords(words, 6)!
    expect(picked.filter((p) => p.meaning === '償還')).toHaveLength(1)
  })

  it('外文相同（大小寫不同）也不重複', () => {
    const words = [w('Apple', '蘋果', 1), w('apple', '蘋果樹', 1), w('b', '二', 1), w('c', '三', 1), w('d', '四', 1), w('e', '五', 1)]
    expect(pickGameWords(words, 6)).toBeNull()
  })

  it('字數不足回傳 null', () => {
    expect(pickGameWords([w('a', '一', 1), w('b', '二', 1)], 6)).toBeNull()
  })

  it('中文只保留第一個譯義', () => {
    const words = Array.from({ length: 6 }, (_, i) => w(`t${i}`, `意思${i}、其他`, 1))
    expect(pickGameWords(words, 6)!.every((p) => !p.meaning.includes('、'))).toBe(true)
  })
})

describe('計分與最佳', () => {
  it('配對成績含罰秒', () => {
    expect(matchScore(12_345.6, 2)).toBe(18_346)
  })

  it('配對越快越好；其他遊戲越多越好', () => {
    expect(isNewBest('match', 15_000, null)).toBe(true)
    expect(isNewBest('match', 15_000, 16_000)).toBe(true)
    expect(isNewBest('match', 16_000, 15_000)).toBe(false)
    expect(isNewBest('listen', 12, 10)).toBe(true)
    expect(isNewBest('listen', 10, 10)).toBe(false)
  })

  it('格式與遊戲代碼', () => {
    expect(formatMatchTime(12_340)).toBe('12.3 秒')
    expect(isGameKey('match')).toBe(true)
    expect(isGameKey('poker')).toBe(false)
  })
})

describe('seededRandom', () => {
  it('同一個種子產生相同序列，範圍在 [0, 1)', () => {
    const a = seededRandom(42)
    const b = seededRandom(42)
    const seqA = Array.from({ length: 5 }, a)
    const seqB = Array.from({ length: 5 }, b)
    expect(seqA).toEqual(seqB)
    expect(seqA.every((x) => x >= 0 && x < 1)).toBe(true)
  })

  it('不同種子產生不同序列', () => {
    expect(seededRandom(1)()).not.toBe(seededRandom(2)())
  })
})
