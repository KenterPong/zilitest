import { describe, expect, it } from 'vitest'

import { chunk, fetchAllRows, fetchByIds } from '@/lib/db-paging'

describe('fetchAllRows', () => {
  it('分頁直到最後一頁不滿 1000', async () => {
    const all = Array.from({ length: 2345 }, (_, i) => i)
    const calls: [number, number][] = []
    const rows = await fetchAllRows((from, to) => {
      calls.push([from, to])
      return Promise.resolve({ data: all.slice(from, to + 1), error: null })
    })
    expect(rows).toEqual(all)
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ])
  })

  it('剛好 1000 筆會多查一頁空結果', async () => {
    const all = Array.from({ length: 1000 }, (_, i) => i)
    const rows = await fetchAllRows((from, to) =>
      Promise.resolve({ data: all.slice(from, to + 1), error: null })
    )
    expect(rows).toHaveLength(1000)
  })

  it('錯誤時拋出', async () => {
    await expect(
      fetchAllRows(() => Promise.resolve({ data: null, error: { message: 'boom' } }))
    ).rejects.toThrow('boom')
  })
})

describe('chunk / fetchByIds', () => {
  it('切塊', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('分批查詢並合併', async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `id${i}`)
    const sizes: number[] = []
    const rows = await fetchByIds(ids, (part) => {
      sizes.push(part.length)
      return Promise.resolve({ data: part.map((id) => ({ id })), error: null })
    })
    expect(sizes).toEqual([100, 100, 50])
    expect(rows).toHaveLength(250)
  })

  it('空陣列不查詢', async () => {
    let called = false
    await fetchByIds([], () => {
      called = true
      return Promise.resolve({ data: [], error: null })
    })
    expect(called).toBe(false)
  })
})
