import { describe, expect, it } from 'vitest'

import { buildCollection, tierFor, type CollectionWord } from '@/lib/collection'

function w(id: string, stage: number, extra: Partial<CollectionWord> = {}): CollectionWord {
  return {
    id,
    term: id,
    reading: null,
    answer: id,
    stage,
    mastered_at: null,
    created_at: '2026-10-01T00:00:00Z',
    ...extra,
  }
}

describe('tierFor', () => {
  it('stage 4–7 對應四個等級，未掌握為 null', () => {
    expect(tierFor(3)).toBeNull()
    expect(tierFor(4)?.name).toBe('掌握')
    expect(tierFor(5)?.name).toBe('熟練')
    expect(tierFor(6)?.name).toBe('精通')
    expect(tierFor(7)?.name).toBe('滿級')
  })
})

describe('buildCollection', () => {
  it('依熟練度分組並計數', () => {
    const c = buildCollection([w('a', 0), w('b', 2), w('c', 4), w('d', 7), w('e', 0), w('f', 5)])
    expect(c.total).toBe(6)
    expect(c.unlearnedCount).toBe(2)
    expect(c.learning.map((x) => x.id)).toEqual(['b'])
    expect(c.mastered.map((x) => x.id)).toEqual(['d', 'f', 'c'])
    expect(c.tierCounts).toEqual({ 4: 1, 5: 1, 6: 0, 7: 1 })
  })

  it('同等級已掌握卡依最近掌握在前', () => {
    const c = buildCollection([
      w('old', 4, { mastered_at: '2026-10-01T00:00:00Z' }),
      w('new', 4, { mastered_at: '2026-10-09T00:00:00Z' }),
    ])
    expect(c.mastered.map((x) => x.id)).toEqual(['new', 'old'])
  })

  it('學習中依 stage 高者在前，同 stage 依建立順序', () => {
    const c = buildCollection([
      w('late', 1, { created_at: '2026-10-05T00:00:00Z' }),
      w('early', 1, { created_at: '2026-10-01T00:00:00Z' }),
      w('close', 3),
    ])
    expect(c.learning.map((x) => x.id)).toEqual(['close', 'early', 'late'])
  })

  it('空卡冊', () => {
    expect(buildCollection([])).toMatchObject({ total: 0, unlearnedCount: 0, mastered: [], learning: [] })
  })
})
