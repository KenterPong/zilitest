import { describe, expect, it } from 'vitest'

import {
  advanceRecall,
  answerRecall,
  buildRecallOrder,
  createRecallQueue,
  currentRecallId,
  isFirstRecall,
  isRecallDone,
  isWritable,
  isWritingMatch,
  shouldSubmitOnEnter,
  summarizeRecall,
  type RecallOutcome,
  type RecallQueue,
} from '@/lib/writing'

describe('isWritable', () => {
  it('30 字元可出題、31 字元排除', () => {
    expect(isWritable('a'.repeat(30))).toBe(true)
    expect(isWritable('a'.repeat(31))).toBe(false)
  })

  it('以正規化後長度計算（頭尾空白不算）', () => {
    expect(isWritable(`  ${'a'.repeat(30)}  `)).toBe(true)
  })

  it('含空格片語在長度內可出題', () => {
    expect(isWritable('look forward to')).toBe(true)
  })

  it('空字串排除', () => {
    expect(isWritable('   ')).toBe(false)
  })
})

describe('isWritingMatch', () => {
  it('英文忽略大小寫、頭尾空白、全形半形', () => {
    expect(isWritingMatch('en', '  APPLE ', 'apple', null)).toBe(true)
    expect(isWritingMatch('en', 'ａｐｐｌｅ', 'apple', null)).toBe(true)
    expect(isWritingMatch('en', 'appl', 'apple', null)).toBe(false)
  })

  it('日文漢字字輸入讀音通過', () => {
    expect(isWritingMatch('ja', 'うける', '受ける', 'うける')).toBe(true)
    expect(isWritingMatch('ja', '受ける', '受ける', 'うける')).toBe(true)
  })

  it('日文片假名輸入平假名通過', () => {
    expect(isWritingMatch('ja', 'こーひー', 'コーヒー', null)).toBe(true)
  })

  it('日文未填讀音時只接受 term', () => {
    expect(isWritingMatch('ja', 'うける', '受ける', null)).toBe(false)
    expect(isWritingMatch('ja', 'うける', '受ける', '  ')).toBe(false)
  })

  it('韓文', () => {
    expect(isWritingMatch('ko', '사과', '사과', null)).toBe(true)
    expect(isWritingMatch('ko', '사고', '사과', null)).toBe(false)
  })

  it('空白輸入不通過', () => {
    expect(isWritingMatch('en', '  ', 'apple', null)).toBe(false)
  })
})

describe('buildRecallOrder', () => {
  it('1 個字照常出題', () => {
    expect(buildRecallOrder(['a'], 'a')).toEqual(['a'])
  })

  it('2 個字時第一題一定不是最後抄的字', () => {
    for (let i = 0; i < 50; i++) {
      expect(buildRecallOrder(['a', 'b'], 'b')[0]).toBe('a')
    }
  })

  it('多個字反覆執行：第一題不是最後抄的字，且字不重複不遺漏', () => {
    const ids = ['a', 'b', 'c', 'd', 'e']
    for (let i = 0; i < 200; i++) {
      const order = buildRecallOrder(ids, 'e')
      expect(order[0]).not.toBe('e')
      expect([...order].sort()).toEqual(ids)
    }
  })
})

/** 依序作答直到結束；每題的結果取自 answers（依出題順序） */
function play(order: string[], answers: RecallOutcome[]): { state: RecallQueue; asked: string[] } {
  let state = createRecallQueue(order)
  const asked: string[] = []
  let i = 0
  while (!isRecallDone(state)) {
    asked.push(currentRecallId(state)!)
    state = advanceRecall(answerRecall(state, answers[i++] ?? 'correct'))
  }
  return { state, asked }
}

describe('回想佇列', () => {
  it('全對：不重出，成績全對、全部寫入 known', () => {
    const { state, asked } = play(['a', 'b', 'c'], ['correct', 'correct', 'correct'])
    expect(asked).toEqual(['a', 'b', 'c'])
    const s = summarizeRecall(state, ['a', 'b', 'c'])
    expect(s.correct).toBe(3)
    expect(s.total).toBe(3)
    expect(s.familiarity).toEqual([
      { word_id: 'a', familiarity: 'known' },
      { word_id: 'b', familiarity: 'known' },
      { word_id: 'c', familiarity: 'known' },
    ])
  })

  it('首次答錯後重出答對：成績仍算錯、card_familiarity 為 unknown', () => {
    const { state, asked } = play(['a', 'b'], ['wrong', 'correct', 'correct'])
    expect(asked).toEqual(['a', 'b', 'a'])
    const s = summarizeRecall(state, ['a', 'b'])
    expect(s.correct).toBe(1)
    expect(s.results).toEqual([
      { word_id: 'a', outcome: 'wrong' },
      { word_id: 'b', outcome: 'correct' },
    ])
    expect(s.familiarity).toContainEqual({ word_id: 'a', familiarity: 'unknown' })
  })

  it('重出再錯不會第三次出現', () => {
    const { asked } = play(['a', 'b'], ['wrong', 'correct', 'wrong'])
    expect(asked).toEqual(['a', 'b', 'a'])
  })

  it('「不會」視同答錯（以 wrong 記錄）並重出', () => {
    const { state, asked } = play(['a'], ['wrong', 'correct'])
    expect(asked).toEqual(['a', 'a'])
    expect(summarizeRecall(state, ['a']).familiarity).toEqual([{ word_id: 'a', familiarity: 'unknown' }])
  })

  it('只有第一次回想標記為需寫入', () => {
    let state = createRecallQueue(['a'])
    expect(isFirstRecall(state)).toBe(true)
    state = advanceRecall(answerRecall(state, 'wrong'))
    expect(currentRecallId(state)).toBe('a')
    expect(isFirstRecall(state)).toBe(false)
  })

  it('重出時作答不改變狀態', () => {
    let state = advanceRecall(answerRecall(createRecallQueue(['a']), 'wrong'))
    expect(answerRecall(state, 'correct')).toBe(state)
    state = advanceRecall(state)
    expect(isRecallDone(state)).toBe(true)
  })
})

describe('shouldSubmitOnEnter', () => {
  it('組字中不觸發', () => {
    expect(shouldSubmitOnEnter({ key: 'Enter', isComposing: true, keyCode: 13 })).toBe(false)
  })

  it('keyCode 229 不觸發', () => {
    expect(shouldSubmitOnEnter({ key: 'Enter', isComposing: false, keyCode: 229 })).toBe(false)
  })

  it('一般 Enter 觸發、其他鍵不觸發', () => {
    expect(shouldSubmitOnEnter({ key: 'Enter', isComposing: false, keyCode: 13 })).toBe(true)
    expect(shouldSubmitOnEnter({ key: 'a', isComposing: false, keyCode: 65 })).toBe(false)
  })
})
