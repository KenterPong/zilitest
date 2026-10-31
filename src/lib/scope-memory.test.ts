import { describe, expect, it } from 'vitest'

import { parseScopeMemory, serializeScopeMemory } from '@/lib/scope-memory'

const valid = { wordbookIds: ['b1', 'b2'], tagIds: ['t1'] }

describe('parseScopeMemory', () => {
  it('沒有記錄或格式損壞 → 空範圍', () => {
    expect(parseScopeMemory(null, valid)).toEqual({ wordbookIds: [], tagIds: [], extra: {} })
    expect(parseScopeMemory('{bad', valid)).toEqual({ wordbookIds: [], tagIds: [], extra: {} })
    expect(parseScopeMemory('[1,2]', valid)).toEqual({ wordbookIds: [], tagIds: [], extra: {} })
  })

  it('還原範圍與頁面設定', () => {
    const raw = serializeScopeMemory({ wordbookIds: ['b2'], tagIds: ['t1'], extra: { mode: 'write' } })
    expect(parseScopeMemory(raw, valid)).toEqual({ wordbookIds: ['b2'], tagIds: ['t1'], extra: { mode: 'write' } })
  })

  it('已刪除的單字本、標籤與非字串值略過', () => {
    const raw = JSON.stringify({ wordbookIds: ['b1', 'gone', 3], tagIds: ['gone'] })
    expect(parseScopeMemory(raw, valid)).toEqual({ wordbookIds: ['b1'], tagIds: [], extra: {} })
  })

  it('網址帶入單字本時以網址為準，頁面設定照常沿用', () => {
    const raw = serializeScopeMemory({ wordbookIds: ['b1'], tagIds: ['t1'], extra: { qtype: 'input' } })
    expect(parseScopeMemory(raw, valid, 'b2')).toEqual({ wordbookIds: ['b2'], tagIds: [], extra: { qtype: 'input' } })
  })
})
