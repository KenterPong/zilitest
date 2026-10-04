import { describe, expect, it } from 'vitest'

import { addMonths, buildSuspension, restoreShiftDays, timedSuspension } from '@/lib/account-state'

const base = {
  status: 'trial' as const,
  trial_end_at: '2027-12-31T15:59:59.000Z', // 台北 2027-12-31 23:59:59
  grace_period_end_at: null,
  auto_renew: true,
  next_billing_at: null,
}

describe('timedSuspension', () => {
  it('試用到期當日結束前不暫停，超過才暫停', () => {
    expect(timedSuspension(base, new Date('2027-12-31T15:59:59.000Z'))).toBeNull()
    expect(timedSuspension(base, new Date('2027-12-31T16:00:00.000Z'))).toBe('trial_expired')
  })

  it('扣款失敗寬限期滿', () => {
    const u = { ...base, status: 'payment_failed' as const, grace_period_end_at: '2027-03-10T00:00:00Z' }
    expect(timedSuspension(u, new Date('2027-03-09T23:59:59Z'))).toBeNull()
    expect(timedSuspension(u, new Date('2027-03-10T00:00:00Z'))).toBe('grace_expired')
  })

  it('付費中：取消訂閱且到達下次扣款日才暫停', () => {
    const u = { ...base, status: 'active' as const, next_billing_at: '2027-05-01T00:00:00Z' }
    const after = new Date('2027-05-02T00:00:00Z')
    expect(timedSuspension(u, after)).toBeNull()
    expect(timedSuspension({ ...u, auto_renew: false }, new Date('2027-04-30T00:00:00Z'))).toBeNull()
    expect(timedSuspension({ ...u, auto_renew: false }, after)).toBe('renewal_cancelled')
  })

  it('暫停或已刪除不再轉換', () => {
    const now = new Date('2030-01-01T00:00:00Z')
    expect(timedSuspension({ ...base, status: 'suspended' }, now)).toBeNull()
    expect(timedSuspension({ ...base, status: 'cancelled' }, now)).toBeNull()
  })
})

describe('addMonths', () => {
  it('一般情況', () => {
    expect(addMonths(new Date('2028-01-01T10:00:00Z'), 3).toISOString()).toBe('2028-04-01T10:00:00.000Z')
  })

  it('月底取該月最後一天', () => {
    expect(addMonths(new Date('2027-11-30T00:00:00Z'), 3).toISOString()).toBe('2028-02-29T00:00:00.000Z')
    expect(addMonths(new Date('2027-01-31T00:00:00Z'), 1).toISOString()).toBe('2027-02-28T00:00:00.000Z')
  })

  it('跨年', () => {
    expect(addMonths(new Date('2027-12-31T16:00:00Z'), 3).toISOString()).toBe('2028-03-31T16:00:00.000Z')
  })
})

describe('buildSuspension', () => {
  const now = new Date('2028-01-05T02:00:00Z') // 台北 2028-01-05

  it('寫入暫停時間、清除預定日（+3 個月）與凍結時間', () => {
    const r = buildSuspension({ current_streak: 30, longest_streak: 30, last_streak_date: '2028-01-04' }, now)
    expect(r).toEqual({
      status: 'suspended',
      suspended_at: '2028-01-05T02:00:00.000Z',
      data_purge_scheduled_at: '2028-04-05T02:00:00.000Z',
      streak_frozen_at: '2028-01-05T02:00:00.000Z',
      current_streak: 30,
    })
  })

  it('暫停前已中斷的連續天數凍結為 0', () => {
    const r = buildSuspension({ current_streak: 30, longest_streak: 30, last_streak_date: '2027-12-20' }, now)
    expect(r.current_streak).toBe(0)
  })
})

describe('restoreShiftDays', () => {
  it('以台北日期計算位移天數', () => {
    // 暫停：台北 2028-01-05；恢復：台北 2028-01-20
    expect(restoreShiftDays('2028-01-04T16:30:00Z', new Date('2028-01-20T01:00:00Z'))).toBe(15)
  })

  it('同日恢復為 0', () => {
    expect(restoreShiftDays('2028-01-05T02:00:00Z', new Date('2028-01-05T10:00:00Z'))).toBe(0)
  })
})
