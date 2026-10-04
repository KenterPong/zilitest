import { describe, expect, it } from 'vitest'

import {
  pickDistractors,
  planDailyTask,
  questionKindFor,
  taskCompletion,
  type TaskCandidateWord,
} from '@/lib/daily-task'

const today = '2026-10-10'
const limits = { daily_review_limit: 3, daily_new_limit: 2 }

let seq = 0
function word(partial: Partial<TaskCandidateWord>): TaskCandidateWord {
  seq += 1
  return {
    id: `w${String(seq).padStart(3, '0')}`,
    created_at: `2026-09-01T00:00:${String(seq % 60).padStart(2, '0')}Z`,
    wordbook_created_at: '2026-09-01T00:00:00Z',
    stage: 0,
    due_date: null,
    lapse_count: 0,
    ...partial,
  }
}

describe('planDailyTask', () => {
  it('少於 4 字不產生任務', () => {
    const r = planDailyTask([word({}), word({}), word({})], limits, today)
    expect(r).toEqual({ status: 'too_few_words', word_count: 3 })
  })

  it('沒有到期字也沒有新字', () => {
    const words = Array.from({ length: 4 }, () => word({ stage: 2, due_date: '2026-10-20' }))
    expect(planDailyTask(words, limits, today)).toEqual({ status: 'nothing_to_do' })
  })

  it('複習字：最逾期優先，同日期 lapse 多者優先，取上限', () => {
    const a = word({ id: 'a', stage: 2, due_date: '2026-10-10', lapse_count: 0 })
    const b = word({ id: 'b', stage: 2, due_date: '2026-10-08', lapse_count: 0 })
    const c = word({ id: 'c', stage: 2, due_date: '2026-10-10', lapse_count: 3 })
    const d = word({ id: 'd', stage: 2, due_date: '2026-10-09', lapse_count: 0 })
    const notDue = word({ id: 'e', stage: 3, due_date: '2026-10-11' })
    const r = planDailyTask([a, b, c, d, notDue], limits, today)
    expect(r).toMatchObject({ status: 'ok', review_word_ids: ['b', 'd', 'c'] })
  })

  it('新字依單字本建立順序、再依單字建立順序', () => {
    const lateBook = '2026-09-05T00:00:00Z'
    const n1 = word({ id: 'n1', wordbook_created_at: lateBook, created_at: '2026-09-05T00:00:01Z' })
    const n2 = word({ id: 'n2', created_at: '2026-09-02T00:00:02Z' })
    const n3 = word({ id: 'n3', created_at: '2026-09-02T00:00:01Z' })
    const n4 = word({ id: 'n4', wordbook_created_at: lateBook, created_at: '2026-09-05T00:00:00Z' })
    const r = planDailyTask([n1, n2, n3, n4], limits, today)
    expect(r).toMatchObject({ status: 'ok', review_word_ids: [], new_word_ids: ['n3', 'n2'] })
  })

  it('積壓保護：到期字 > 上限 × 2 時新字為 0', () => {
    const due = Array.from({ length: 7 }, () => word({ stage: 1, due_date: '2026-10-09' }))
    const fresh = [word({}), word({})]
    const r = planDailyTask([...due, ...fresh], limits, today)
    expect(r).toMatchObject({ status: 'ok', new_word_ids: [] })
    if (r.status === 'ok') expect(r.review_word_ids).toHaveLength(3)
  })

  it('到期字剛好 = 上限 × 2 仍引入新字', () => {
    const due = Array.from({ length: 6 }, () => word({ stage: 1, due_date: '2026-10-09' }))
    const fresh = [word({ id: 'f1' })]
    const r = planDailyTask([...due, ...fresh], limits, today)
    expect(r).toMatchObject({ status: 'ok', new_word_ids: ['f1'] })
  })

  it('只有新字也算任務', () => {
    const words = Array.from({ length: 5 }, () => word({}))
    const r = planDailyTask(words, limits, today)
    expect(r.status).toBe('ok')
    if (r.status === 'ok') expect(r.new_word_ids).toHaveLength(2)
  })

  it('上限為 0 時沒有任務', () => {
    const words = Array.from({ length: 5 }, () => word({}))
    expect(planDailyTask(words, { daily_review_limit: 0, daily_new_limit: 0 }, today)).toEqual({
      status: 'nothing_to_do',
    })
  })
})

describe('questionKindFor', () => {
  it('新字、stage 1–3、stage ≥ 4', () => {
    expect(questionKindFor(0, true)).toBe('new')
    expect(questionKindFor(0, false)).toBe('new')
    expect(questionKindFor(1, false)).toBe('mcq')
    expect(questionKindFor(3, false)).toBe('mcq')
    expect(questionKindFor(4, false)).toBe('fill')
    expect(questionKindFor(7, false)).toBe('fill')
  })
})

describe('pickDistractors', () => {
  it('排除正確答案與重複文字', () => {
    const r = pickDistractors('償還', ['償還', '退款', '退款 ', '延期', '', '取消', '延期'])
    expect(r).toHaveLength(3)
    expect(new Set(r.map((s) => s.trim())).size).toBe(3)
    expect(r.map((s) => s.trim())).not.toContain('償還')
  })

  it('候選不足時回傳全部可用者', () => {
    expect(pickDistractors('a', ['a', 'b'])).toEqual(['b'])
  })
})

describe('taskCompletion', () => {
  it('剩餘單字全部作答完即完成', () => {
    expect(taskCompletion(3, 3)).toBe('done')
    expect(taskCompletion(3, 2)).toBe('pending')
  })

  it('未答的字被刪除後，剩下的都答完即完成', () => {
    // 原本 5 字，答了 3 字後刪除未答的 2 字 → 剩 3 字皆已答
    expect(taskCompletion(3, 3)).toBe('done')
  })

  it('全部刪除不算完成', () => {
    expect(taskCompletion(0, 0)).toBe('empty')
  })
})
