import { describe, expect, it } from 'vitest'

import { addDays, diffDays, taipeiToday, toTaipeiDate } from '@/lib/taipei-date'

describe('toTaipeiDate', () => {
  it('UTC 15:59:59 仍是台北當天', () => {
    expect(toTaipeiDate('2026-10-03T15:59:59.999Z')).toBe('2026-10-03')
  })

  it('UTC 16:00 已是台北隔天', () => {
    expect(toTaipeiDate('2026-10-03T16:00:00.000Z')).toBe('2026-10-04')
  })

  it('跨年', () => {
    expect(toTaipeiDate('2026-12-31T16:00:00.000Z')).toBe('2027-01-01')
  })

  it('接受 Date 物件與帶時區的字串', () => {
    expect(toTaipeiDate(new Date('2026-10-03T23:30:00+08:00'))).toBe('2026-10-03')
    expect(toTaipeiDate('2026-10-04T00:30:00+08:00')).toBe('2026-10-04')
  })

  it('無效時間拋出錯誤', () => {
    expect(() => toTaipeiDate('not a date')).toThrow()
  })
})

describe('taipeiToday', () => {
  it('以傳入的 now 計算', () => {
    expect(taipeiToday(new Date('2026-02-28T20:00:00Z'))).toBe('2026-03-01')
  })
})

describe('addDays', () => {
  it('加減天數，含跨月與閏年', () => {
    expect(addDays('2026-10-03', 1)).toBe('2026-10-04')
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2026-10-03', 120)).toBe('2027-01-31')
  })

  it('格式錯誤或不存在的日期拋出錯誤', () => {
    expect(() => addDays('2026/10/03', 1)).toThrow()
    expect(() => addDays('2026-02-30', 1)).toThrow()
  })
})

describe('diffDays', () => {
  it('a − b', () => {
    expect(diffDays('2026-10-04', '2026-10-03')).toBe(1)
    expect(diffDays('2026-10-03', '2026-10-04')).toBe(-1)
    expect(diffDays('2027-01-01', '2026-12-31')).toBe(1)
    expect(diffDays('2026-10-03', '2026-10-03')).toBe(0)
  })
})
