import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { exampleColumns, extractScope, signExample, verifyExample, wordScope } from '@/lib/example-sign'
import type { WordExample } from '@/types/vocab'

const example: WordExample = {
  example: '昨日、試験を受けた。',
  example_translation: '昨天參加了考試。',
  example_source: 'generated',
  example_target: '受けた',
  example_chunks: [{ text: '昨日、', reading: 'きのう' }, { text: '試験を', reading: 'しけん' }, { text: '受けた。', reading: 'うけた' }],
  example_tts: 'きのう、 しけんを うけた。',
}

const scope = extractScope('u1', 'ja', '受ける')

/** 模擬送到前端再送回（JSON 來回） */
function roundTrip<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

describe('例句簽章', () => {
  beforeEach(() => {
    process.env.EXAMPLE_SIGNING_SECRET = 'test-secret'
  })
  afterEach(() => {
    delete process.env.EXAMPLE_SIGNING_SECRET
  })

  it('原樣送回可通過驗證', () => {
    const sig = signExample(scope, example)!
    expect(verifyExample(scope, roundTrip(example), sig)).toEqual(example)
  })

  it('改動例句內容 → 不通過', () => {
    const sig = signExample(scope, example)!
    expect(verifyExample(scope, { ...example, example: '自分で書いた文。' }, sig)).toBeNull()
    expect(verifyExample(scope, { ...example, example_source: 'original' }, sig)).toBeNull()
    expect(
      verifyExample(scope, { ...example, example_chunks: [{ text: '昨日、試験を受けた。' }] }, sig)
    ).toBeNull()
  })

  it('換了使用者、語言或 term → 不通過', () => {
    const sig = signExample(scope, example)!
    expect(verifyExample(extractScope('u2', 'ja', '受ける'), example, sig)).toBeNull()
    expect(verifyExample(extractScope('u1', 'ja', '受け'), example, sig)).toBeNull()
  })

  it('補例句綁定單字 id 與 term', () => {
    const sig = signExample(wordScope('u1', 'w1', '受ける'), example)!
    expect(verifyExample(wordScope('u1', 'w1', '受ける'), example, sig)).toEqual(example)
    expect(verifyExample(wordScope('u1', 'w2', '受ける'), example, sig)).toBeNull()
    expect(verifyExample(wordScope('u1', 'w1', '受けた'), example, sig)).toBeNull()
  })

  it('沒有簽章或格式錯誤 → 不通過', () => {
    expect(verifyExample(scope, example, undefined)).toBeNull()
    expect(verifyExample(scope, example, 'abc')).toBeNull()
    expect(verifyExample(scope, 'not an object', signExample(scope, example))).toBeNull()
  })

  it('未設定金鑰時不簽章、也不接受例句', () => {
    const sig = signExample(scope, example)!
    delete process.env.EXAMPLE_SIGNING_SECRET
    expect(signExample(scope, example)).toBeNull()
    expect(verifyExample(scope, example, sig)).toBeNull()
  })
})

describe('exampleColumns', () => {
  it('寫入例句與時間；null 時全部清空', () => {
    expect(exampleColumns(example, '2026-10-31T00:00:00.000Z')).toMatchObject({
      example: example.example,
      example_updated_at: '2026-10-31T00:00:00.000Z',
    })
    expect(Object.values(exampleColumns(null, 'x')).every((v) => v === null)).toBe(true)
  })
})
