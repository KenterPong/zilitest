import { describe, expect, it } from 'vitest'

import {
  isReorderFilledCorrect,
  isReorderUsable,
  pickReorderCards,
  reorderUnavailableReason,
  REORDER_ROUND_SIZE,
  shuffleChunks,
} from '@/lib/reorder'
import type { ExampleChunk } from '@/types/vocab'

const chunks = (...texts: string[]): ExampleChunk[] => texts.map((text) => ({ text }))

function card(id: string, n: number | null, example: string | null = 'x') {
  return { id, example, example_chunks: n === null ? null : chunks(...Array.from({ length: n }, (_, i) => `w${i}`)) }
}

/** 固定序列的亂數（循環使用） */
function seq(...values: number[]) {
  let i = 0
  return () => values[i++ % values.length]!
}

describe('isReorderUsable', () => {
  it('有例句且詞塊 3–12 塊才可用', () => {
    expect(isReorderUsable(card('a', 3))).toBe(true)
    expect(isReorderUsable(card('a', 12))).toBe(true)
    expect(isReorderUsable(card('a', 2))).toBe(false)
    expect(isReorderUsable(card('a', 13))).toBe(false)
    expect(isReorderUsable(card('a', null))).toBe(false)
    expect(isReorderUsable(card('a', 5, null))).toBe(false)
    expect(isReorderUsable(card('a', 5, '  '))).toBe(false)
  })
})

describe('pickReorderCards', () => {
  it('依傳入順序取可用的前 10 句', () => {
    const list = [card('x', 2), ...Array.from({ length: 12 }, (_, i) => card(`c${i}`, 4))]
    const picked = pickReorderCards(list)
    expect(picked).toHaveLength(REORDER_ROUND_SIZE)
    expect(picked[0]!.id).toBe('c0')
  })

  it('不足 10 句時全部入選', () => {
    expect(pickReorderCards([card('a', 4), card('b', null), card('c', 3)]).map((c) => c.id)).toEqual(['a', 'c'])
  })
})

describe('reorderUnavailableReason', () => {
  it('都沒有例句 → no_example；有例句但詞塊不可用 → not_reorderable', () => {
    expect(reorderUnavailableReason([card('a', null, null), card('b', null, '')])).toBe('no_example')
    expect(reorderUnavailableReason([card('a', null, null), card('b', 13)])).toBe('not_reorderable')
  })
})

describe('shuffleChunks', () => {
  it('保留每塊的文字與讀音', () => {
    const src: ExampleChunk[] = [{ text: '私は' }, { text: '学校に', reading: 'がっこうに' }, { text: '行きます。', reading: 'いきます。' }]
    const tiles = shuffleChunks(src)
    expect(tiles).toHaveLength(3)
    for (const t of tiles) {
      expect(t.text).toBe(src[t.id]!.text)
      expect(t.reading).toBe(src[t.id]!.reading)
    }
  })

  it('剛好排回原順序時重新打散', () => {
    // 第一次 Fisher–Yates 都取最後一個（不動）→ 原順序；之後取 0 → 打散
    const tiles = shuffleChunks(chunks('a', 'b', 'c'), seq(0.99, 0.99, 0, 0))
    expect(tiles.map((t) => t.text)).not.toEqual(['a', 'b', 'c'])
  })
})

describe('isReorderFilledCorrect', () => {
  const src = chunks('I', 'think', 'that', 'that', 'is', 'fine.')
  const tiles = src.map((c, id) => ({ id, text: c.text }))

  it('依文字序列判定，相同文字的詞塊互換仍正確', () => {
    const [i, think, that1, that2, is, fine] = tiles
    expect(isReorderFilledCorrect([i!, think!, that2!, that1!, is!, fine!], src)).toBe(true)
    expect(isReorderFilledCorrect([think!, i!, that1!, that2!, is!, fine!], src)).toBe(false)
  })

  it('未全部填入不算正確', () => {
    expect(isReorderFilledCorrect(tiles.slice(0, 5), src)).toBe(false)
  })
})
