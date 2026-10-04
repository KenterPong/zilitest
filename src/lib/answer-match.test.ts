import { describe, expect, it } from 'vitest'

import {
  buildAnswerDiff,
  fillDiffTarget,
  formatTermWithReading,
  isExactAnswerMatch,
  isFillAnswerCorrect,
  levenshtein,
} from '@/lib/answer-match'

describe('isExactAnswerMatch', () => {
  it('忽略大小寫與頭尾空白', () => {
    expect(isExactAnswerMatch('  Journey ', 'journey')).toBe(true)
    expect(isExactAnswerMatch('journy', 'journey')).toBe(false)
  })

  it('全形與半形視為相同', () => {
    expect(isExactAnswerMatch('ｊｏｕｒｎｅｙ', 'journey')).toBe(true)
    expect(isExactAnswerMatch('ｶﾀｶﾅ', 'カタカナ')).toBe(true)
  })

  it('片假名與平假名視為相同', () => {
    expect(isExactAnswerMatch('てすと', 'テスト')).toBe(true)
    expect(isExactAnswerMatch('コーヒー', 'こーひー')).toBe(true)
  })

  it('韓文完全一致', () => {
    expect(isExactAnswerMatch('꾸준히', '꾸준히')).toBe(true)
    expect(isExactAnswerMatch('꾸준이', '꾸준히')).toBe(false)
  })
})

describe('isFillAnswerCorrect', () => {
  it('漢字寫法或讀音都算對', () => {
    expect(isFillAnswerCorrect('受ける', '受ける', 'うける')).toBe(true)
    expect(isFillAnswerCorrect('うける', '受ける', 'うける')).toBe(true)
    expect(isFillAnswerCorrect('ウケル', '受ける', 'うける')).toBe(true)
  })

  it('沒有讀音時只接受單字寫法', () => {
    expect(isFillAnswerCorrect('うける', '受ける', null)).toBe(false)
    expect(isFillAnswerCorrect('うける', '受ける', '  ')).toBe(false)
  })

  it('空白輸入不算對', () => {
    expect(isFillAnswerCorrect('  ', '受ける', 'うける')).toBe(false)
  })

  it('讀音錯誤不算對', () => {
    expect(isFillAnswerCorrect('うけた', '受ける', 'うける')).toBe(false)
  })
})

describe('fillDiffTarget', () => {
  it('輸入假名時以讀音標紅字', () => {
    expect(fillDiffTarget('うけた', '受ける', 'うける')).toBe('うける')
  })

  it('輸入漢字時以單字寫法標紅字', () => {
    expect(fillDiffTarget('受けた', '受ける', 'うける')).toBe('受ける')
  })

  it('沒有讀音時一律用單字寫法', () => {
    expect(fillDiffTarget('うけた', '受ける', null)).toBe('受ける')
  })
})

describe('levenshtein / buildAnswerDiff', () => {
  it('編輯距離', () => {
    expect(levenshtein('journey', 'journy')).toBe(1)
    expect(levenshtein('', 'abc')).toBe(3)
  })

  it('拼錯一個字母標出位置', () => {
    const diff = buildAnswerDiff('jurney', 'journey')
    expect(diff).not.toBeNull()
    expect(diff!.some((p) => p.type === 'missing')).toBe(true)
  })

  it('差異過大不標紅字', () => {
    expect(buildAnswerDiff('xyz', '受ける')).toBeNull()
  })
})

describe('formatTermWithReading', () => {
  it('有讀音時附在後面', () => {
    expect(formatTermWithReading('受ける', 'うける')).toBe('受ける（うける）')
  })

  it('沒有讀音或讀音與單字相同時只顯示單字', () => {
    expect(formatTermWithReading('journey', null)).toBe('journey')
    expect(formatTermWithReading('うける', 'うける')).toBe('うける')
  })
})
