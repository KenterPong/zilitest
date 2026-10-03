import { describe, expect, it } from 'vitest'

import { applyAnswer, EMPTY_PROGRESS, type ProgressState } from '@/lib/progress'

const today = '2026-10-10'
const now = '2026-10-10T02:00:00.000Z'

function state(partial: Partial<ProgressState>): ProgressState {
  return { ...EMPTY_PROGRESS, ...partial }
}

describe('新字引入', () => {
  it('答對：stage 1、明天複習', () => {
    const r = applyAnswer(null, { isCorrect: true, isNewIntroduction: true, today, now })
    expect(r.changed).toBe(true)
    expect(r.next).toMatchObject({
      stage: 1,
      due_date: '2026-10-11',
      introduced_at: now,
      last_reviewed_date: today,
      lapse_count: 0,
    })
  })

  it('答錯也一樣 stage 1，不計 lapse', () => {
    const r = applyAnswer(null, { isCorrect: false, isNewIntroduction: true, today, now })
    expect(r.next).toMatchObject({ stage: 1, due_date: '2026-10-11', lapse_count: 0 })
  })

  it('自由練習不引入 stage 0 的字', () => {
    const r = applyAnswer(null, { isCorrect: false, isNewIntroduction: false, today, now })
    expect(r.changed).toBe(false)
    expect(r.next.stage).toBe(0)
  })
})

describe('答對升級', () => {
  it('到期答對：stage +1，依新 stage 設間隔', () => {
    const r = applyAnswer(state({ stage: 1, due_date: today, last_reviewed_date: '2026-10-09' }), {
      isCorrect: true,
      isNewIntroduction: false,
      today,
      now,
    })
    expect(r.next).toMatchObject({ stage: 2, due_date: '2026-10-13', last_reviewed_date: today })
  })

  it('逾期答對也升級', () => {
    const r = applyAnswer(state({ stage: 2, due_date: '2026-10-01' }), {
      isCorrect: true,
      isNewIntroduction: false,
      today,
      now,
    })
    expect(r.next).toMatchObject({ stage: 3, due_date: '2026-10-17' })
  })

  it('未到期答對不升級、不記 last_reviewed_date', () => {
    const prev = state({ stage: 2, due_date: '2026-10-12', last_reviewed_date: '2026-10-09' })
    const r = applyAnswer(prev, { isCorrect: true, isNewIntroduction: false, today, now })
    expect(r.changed).toBe(false)
    expect(r.next).toEqual(prev)
  })

  it('升到 stage 4 觸發已掌握', () => {
    const r = applyAnswer(state({ stage: 3, due_date: today }), {
      isCorrect: true,
      isNewIntroduction: false,
      today,
      now,
    })
    expect(r.becameMastered).toBe(true)
    expect(r.next).toMatchObject({ stage: 4, due_date: '2026-10-24', mastered_at: now })
  })

  it('stage 4 以上升級不再觸發已掌握', () => {
    const r = applyAnswer(state({ stage: 4, due_date: today, mastered_at: '2026-09-01T00:00:00Z' }), {
      isCorrect: true,
      isNewIntroduction: false,
      today,
      now,
    })
    expect(r.becameMastered).toBe(false)
    expect(r.next).toMatchObject({ stage: 5, mastered_at: '2026-09-01T00:00:00Z' })
  })

  it('stage 上限 7，間隔 120 天', () => {
    const r = applyAnswer(state({ stage: 7, due_date: today, mastered_at: now }), {
      isCorrect: true,
      isNewIntroduction: false,
      today,
      now,
    })
    expect(r.next).toMatchObject({ stage: 7, due_date: '2027-02-07' })
  })
})

describe('答錯降級', () => {
  it('降為 stage 1、明天、lapse +1、清除 mastered_at', () => {
    const r = applyAnswer(
      state({ stage: 5, due_date: '2026-11-01', lapse_count: 2, mastered_at: '2026-09-01T00:00:00Z' }),
      { isCorrect: false, isNewIntroduction: false, today, now }
    )
    expect(r.next).toMatchObject({
      stage: 1,
      due_date: '2026-10-11',
      lapse_count: 3,
      mastered_at: null,
      last_reviewed_date: today,
    })
  })

  it('未到期答錯一樣降級（反映真實遺忘）', () => {
    const r = applyAnswer(state({ stage: 3, due_date: '2026-10-20' }), {
      isCorrect: false,
      isNewIntroduction: false,
      today,
      now,
    })
    expect(r.next.stage).toBe(1)
  })

  it('降級後再次升到 stage 4 會重新觸發已掌握', () => {
    const r = applyAnswer(state({ stage: 3, due_date: today, mastered_at: null, lapse_count: 1 }), {
      isCorrect: true,
      isNewIntroduction: false,
      today,
      now,
    })
    expect(r.becameMastered).toBe(true)
  })
})

describe('每日首次規則', () => {
  it('同日第二次作答不影響熟練度', () => {
    const prev = state({ stage: 2, due_date: '2026-10-13', last_reviewed_date: today })
    const wrong = applyAnswer(prev, { isCorrect: false, isNewIntroduction: false, today, now })
    expect(wrong.changed).toBe(false)
    expect(wrong.next).toEqual(prev)
  })
})
