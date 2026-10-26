import { describe, expect, it } from 'vitest'

import { normalizeAnswer } from '@/lib/answer-match'
import type { GameWord } from '@/lib/games'
import {
  buildSpellPool,
  isSpellable,
  isSpellCorrect,
  isValidSpellResult,
  makeSpellQuestion,
  pickDistractors,
  shuffleTiles,
  splitTiles,
  tileForKey,
} from '@/lib/spell'

/** 固定序列的亂數，讓打散結果可預期 */
function seq(...values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length]!
}

describe('splitTiles', () => {
  it('英文逐字母，重複字母各自一塊並保留大小寫', () => {
    expect(splitTiles('Apple')).toEqual(['A', 'p', 'p', 'l', 'e'])
  })

  it('日文逐字元：漢字＋送假名、片假名含ー、小字假名、々', () => {
    expect(splitTiles('受ける')).toEqual(['受', 'け', 'る'])
    expect(splitTiles('コーヒー')).toEqual(['コ', 'ー', 'ヒ', 'ー'])
    expect(splitTiles('ちょっと')).toEqual(['ち', 'ょ', 'っ', 'と'])
    expect(splitTiles('人々')).toEqual(['人', '々'])
  })

  it('韓文逐音節，不拆字母', () => {
    expect(splitTiles('학교')).toEqual(['학', '교'])
  })
})

describe('isSpellable', () => {
  it('長度 2–12', () => {
    expect(isSpellable('en', 'a')).toBe(false)
    expect(isSpellable('en', 'go')).toBe(true)
    expect(isSpellable('en', 'abcdefghijkl')).toBe(true)
    expect(isSpellable('en', 'abcdefghijklm')).toBe(false)
  })

  it('含空格、連字號、撇號、數字或符號者排除', () => {
    expect(isSpellable('en', 'New York')).toBe(false)
    expect(isSpellable('en', 'well-known')).toBe(false)
    expect(isSpellable('en', "don't")).toBe(false)
    expect(isSpellable('en', 'mp3')).toBe(false)
  })

  it('只能包含該語言的文字', () => {
    expect(isSpellable('ja', '受ける')).toBe(true)
    expect(isSpellable('ja', 'コーヒー')).toBe(true)
    expect(isSpellable('ja', '人々')).toBe(true)
    expect(isSpellable('ja', 'Tシャツ')).toBe(false)
    expect(isSpellable('ko', '학교')).toBe(true)
    expect(isSpellable('ko', 'SNS계정')).toBe(false)
    expect(isSpellable('en', '학교')).toBe(false)
  })
})

describe('pickDistractors', () => {
  it('不與 term 重疊（不分大小寫），彼此不重複', () => {
    for (let i = 0; i < 50; i++) {
      const d = pickDistractors('en', 'Apple', ['banana', 'cherry'])
      expect(d).toHaveLength(3)
      const keys = d.map(normalizeAnswer)
      expect(new Set(keys).size).toBe(3)
      for (const k of keys) expect(['a', 'p', 'l', 'e']).not.toContain(k)
    }
  })

  it('片假名視同平假名：含「カ」的字不會出現「か」', () => {
    for (let i = 0; i < 50; i++) {
      const d = pickDistractors('ja', 'カメラ', ['かさ', 'めがね', 'らいおん', 'たべる'])
      for (const c of d) expect(['か', 'め', 'ら']).not.toContain(normalizeAnswer(c))
    }
  })

  it('優先取同類型的字元', () => {
    const d = pickDistractors('ja', 'コーヒー', ['テレビ', '学校', 'たべる'])
    expect(d.every((c) => ['テ', 'レ', 'ビ'].includes(c))).toBe(true)
  })

  it('英文不足時以 a–z 補足，全大寫的字用大寫', () => {
    const d = pickDistractors('en', 'NASA', [])
    expect(d).toHaveLength(3)
    for (const c of d) {
      expect(c).toMatch(/^[A-Z]$/)
      expect(['N', 'A', 'S']).not.toContain(c)
    }
  })

  it('韓文不足時以常用字表補足', () => {
    const d = pickDistractors('ko', '학교', [])
    expect(d).toHaveLength(3)
    for (const c of d) expect(['학', '교']).not.toContain(c)
  })

  it('日文不足 3 個時不補，有幾個算幾個', () => {
    expect(pickDistractors('ja', '受ける', [])).toEqual([])
    const d = pickDistractors('ja', '受ける', ['受かる'])
    expect(d).toEqual(['か'])
  })

  it('ー 與 々 不當干擾字', () => {
    const d = pickDistractors('ja', 'ねこ', ['コーヒー', '人々'])
    expect(d).not.toContain('ー')
    expect(d).not.toContain('々')
  })
})

describe('shuffleTiles', () => {
  it('打散後剛好依原順序排出單字時重新打散', () => {
    // 第一次的亂數讓 [a, b, x] 維持原樣（剛好排出 ab），第二次打散成其他順序
    const tiles = shuffleTiles(['a', 'b', 'x'], ['a', 'b'], seq(0.99, 0.99, 0, 0))
    const joined = tiles.map((t) => t.char).join('')
    expect(joined.includes('ab')).toBe(false)
    expect(tiles.map((t) => t.char).sort()).toEqual(['a', 'b', 'x'])
  })

  it('重複字元無法避免時仍會結束', () => {
    const tiles = shuffleTiles(['a', 'a'], ['a', 'a'])
    expect(tiles).toHaveLength(2)
  })
})

describe('makeSpellQuestion', () => {
  it('方塊 = term 的字元 + 干擾字', () => {
    const q = makeSpellQuestion(
      { id: '1', term: 'apple', reading: null, pronunciation: null, answer: '蘋果', learned: true },
      'en',
      ['dog']
    )
    expect(q.answerTiles).toEqual(['a', 'p', 'p', 'l', 'e'])
    expect(q.tiles).toHaveLength(8)
  })
})

describe('buildSpellPool', () => {
  it('只收可出題的字，學過的字在前', () => {
    const words: GameWord[] = [
      { id: 'n', term: 'new', reading: null, answer: '新', stage: 0 },
      { id: 'l', term: 'learned', reading: null, answer: '學過', stage: 2 },
      { id: 'x', term: 'New York', reading: null, answer: '紐約', stage: 3 },
    ]
    expect(buildSpellPool(words, 'en').map((w) => w.id)).toEqual(['l', 'n'])
  })
})

describe('isSpellCorrect', () => {
  it('正規化後一致即正確，不接受讀音', () => {
    expect(isSpellCorrect(['A', 'p', 'p', 'l', 'e'], 'Apple')).toBe(true)
    expect(isSpellCorrect(['p', 'A', 'p', 'l', 'e'], 'Apple')).toBe(false)
    expect(isSpellCorrect(['う', 'け', 'る'], '受ける')).toBe(false)
  })
})

describe('tileForKey', () => {
  it('選第一個相符且未使用的方塊，不分大小寫', () => {
    const tiles = [
      { id: 0, char: 'p' },
      { id: 1, char: 'A' },
      { id: 2, char: 'p' },
    ]
    expect(tileForKey(tiles, new Set(), 'a')?.id).toBe(1)
    expect(tileForKey(tiles, new Set([0]), 'p')?.id).toBe(2)
    expect(tileForKey(tiles, new Set([0, 2]), 'p')).toBeNull()
    expect(tileForKey(tiles, new Set(), '1')).toBeNull()
  })
})

describe('isValidSpellResult', () => {
  it('檢查成績範圍', () => {
    expect(isValidSpellResult(10, 12, 3)).toBe(true)
    expect(isValidSpellResult(0, 1, 0)).toBe(true)
    expect(isValidSpellResult(10, 9, 0)).toBe(false)
    expect(isValidSpellResult(76, 76, 0)).toBe(false)
    expect(isValidSpellResult(5, 10, 1)).toBe(false)
  })
})
