import { describe, expect, it } from 'vitest'

import {
  affectsProgress,
  buildExampleQuestion,
  countExampleWordsByLanguage,
  isExampleQuestionWord,
  joinSentence,
  judgeExampleAnswer,
  pickDistinctTerms,
  type ExampleQuizWord,
} from '@/lib/example-quiz'
import type { Language } from '@/types/vocab'

function word(id: string, term: string, opts: Partial<ExampleQuizWord> = {}): ExampleQuizWord {
  return {
    id,
    term,
    reading: null,
    pronunciation: null,
    language: 'en',
    example: null,
    example_translation: null,
    example_source: null,
    example_target: null,
    example_chunks: null,
    example_tts: null,
    ...opts,
  }
}

const hesitate = word('w1', 'hesitate', {
  example: 'At first I hesitated, then I agreed.',
  example_translation: '一開始我猶豫了，後來同意了。',
  example_source: 'generated',
  example_target: 'hesitated',
  example_chunks: ['At', 'first', 'I', 'hesitated,', 'then', 'I', 'agreed.'].map((text) => ({ text })),
})
const others = ['recipe', 'burn', 'sauce', 'Recipe'].map((t, i) => word(`o${i}`, t))
const ja = word('j1', 'レシピ', { language: 'ja' as Language })
const pool = [hesitate, ...others, ja]

/** 固定序列的亂數（循環使用） */
function seq(...values: number[]) {
  let i = 0
  return () => values[i++ % values.length]!
}

describe('affectsProgress', () => {
  it('例句題型不更新熟練度，一般題型照常', () => {
    expect(affectsProgress('example_choice')).toBe(false)
    expect(affectsProgress('example_tf')).toBe(false)
    expect(affectsProgress('example_reorder')).toBe(false)
    expect(affectsProgress('tf')).toBe(true)
    expect(affectsProgress('choice')).toBe(true)
    expect(affectsProgress('input')).toBe(true)
  })
})

describe('isExampleQuestionWord', () => {
  it('沒有例句或例句中找不到目標字的字不出選擇／是非題', () => {
    expect(isExampleQuestionWord('example_choice', hesitate)).toBe(true)
    expect(isExampleQuestionWord('example_tf', others[0]!)).toBe(false)
    expect(isExampleQuestionWord('example_choice', { ...hesitate, example_target: 'hesitates' })).toBe(false)
  })

  it('重組需詞塊 3–12 塊', () => {
    expect(isExampleQuestionWord('example_reorder', hesitate)).toBe(true)
    expect(isExampleQuestionWord('example_reorder', { ...hesitate, example_chunks: null })).toBe(false)
  })
})

describe('pickDistinctTerms', () => {
  it('只取同語言、term 正規化後不重複且不同於正解的字', () => {
    const picked = pickDistinctTerms(pool, hesitate, 10)
    const terms = picked.map((w) => w.term.toLowerCase())
    expect(terms).not.toContain('hesitate')
    expect(new Set(terms).size).toBe(terms.length)
    expect(picked.every((w) => w.language === 'en')).toBe(true)
    expect(picked).toHaveLength(3)
  })
})

describe('buildExampleQuestion', () => {
  it('例句選擇：挖空第一次出現處、選項為原形 term、含正解', () => {
    const q = buildExampleQuestion('example_choice', hesitate, pool)
    expect(q.sentence).toEqual({ before: 'At first I ', mark: '', after: ', then I agreed.' })
    expect(q.example_options).toHaveLength(4)
    expect(q.example_options!.map((o) => o.term)).toContain('hesitate')
    expect(q.correct_term).toBe('hesitate')
    expect(q.reveal?.example_translation).toBe('一開始我猶豫了，後來同意了。')
  })

  it('例句是非：相符時為原句', () => {
    const q = buildExampleQuestion('example_tf', hesitate, pool, seq(0.1))
    expect(joinSentence(q.sentence!)).toBe(hesitate.example)
    expect(q.sentence!.mark).toBe('hesitated')
  })

  it('例句是非：不相符時目標字換成另一個字的原形', () => {
    const q = buildExampleQuestion('example_tf', hesitate, pool, seq(0.9, 0))
    expect(joinSentence(q.sentence!)).not.toBe(hesitate.example)
    expect(['recipe', 'burn', 'sauce', 'Recipe']).toContain(q.sentence!.mark)
  })

  it('例句是非：沒有可替換的字時改出相符', () => {
    const q = buildExampleQuestion('example_tf', hesitate, [hesitate], seq(0.9))
    expect(joinSentence(q.sentence!)).toBe(hesitate.example)
  })

  it('例句重組：回傳打散的詞塊與原句序列', () => {
    const q = buildExampleQuestion('example_reorder', hesitate, pool)
    expect(q.chunks).toHaveLength(7)
    expect(q.correct_chunks).toEqual(hesitate.example_chunks!.map((c) => c.text))
  })
})

describe('judgeExampleAnswer', () => {
  it('例句選擇：選項與 term 正規化後一致即正確', () => {
    expect(judgeExampleAnswer('example_choice', hesitate, { selected_answer: 'Hesitate ' })).toBe(true)
    expect(judgeExampleAnswer('example_choice', hesitate, { selected_answer: 'burn' })).toBe(false)
  })

  it('例句是非：依顯示句子是否為原句判定', () => {
    const replaced = 'At first I burn, then I agreed.'
    expect(judgeExampleAnswer('example_tf', hesitate, { display_sentence: hesitate.example!, user_says_true: true })).toBe(true)
    expect(judgeExampleAnswer('example_tf', hesitate, { display_sentence: replaced, user_says_true: false })).toBe(true)
    expect(judgeExampleAnswer('example_tf', hesitate, { display_sentence: replaced, user_says_true: true })).toBe(false)
    expect(judgeExampleAnswer('example_tf', hesitate, { display_sentence: replaced })).toBe(false)
  })

  it('例句重組：依詞塊文字序列判定，相同文字的詞塊互換仍正確', () => {
    const texts = hesitate.example_chunks!.map((c) => c.text)
    expect(judgeExampleAnswer('example_reorder', hesitate, { chunk_texts: texts })).toBe(true)
    expect(judgeExampleAnswer('example_reorder', hesitate, { chunk_texts: [...texts].reverse() })).toBe(false)
    expect(judgeExampleAnswer('example_reorder', hesitate, { chunk_texts: texts.slice(1) })).toBe(false)
  })
})

describe('countExampleWordsByLanguage', () => {
  it('分別計算有可用例句與可重組的字', () => {
    const noChunks = { ...hesitate, id: 'w2', example_chunks: null }
    expect(countExampleWordsByLanguage([hesitate, noChunks, ...others, ja])).toEqual({
      example: { en: 2 },
      reorder: { en: 1 },
    })
  })
})
