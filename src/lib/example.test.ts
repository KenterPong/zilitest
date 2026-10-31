import { describe, expect, it } from 'vitest'

import {
  buildClozeSentence,
  buildTfSentence,
  isChunkReadingValid,
  isReorderable,
  isReorderCorrect,
  resolveExampleSource,
  splitAtTarget,
  splitBySpaces,
  validateExample,
} from '@/lib/example'

const enRaw = {
  example: 'The company reimbursed my travel expenses.',
  example_translation: '公司報銷了我的差旅費。',
  example_source: 'original',
  example_target: 'reimbursed',
  example_chunks: [
    { text: 'The' },
    { text: 'company' },
    { text: 'reimbursed' },
    { text: 'my' },
    { text: 'travel' },
    { text: 'expenses.' },
  ],
}

const jaRaw = {
  example: '昨日、試験を受けた。',
  example_translation: '昨天參加了考試。',
  example_source: 'generated',
  example_target: '受けた',
  example_chunks: [
    { text: '昨日、', reading: 'きのう' },
    { text: '試験を', reading: 'しけんを' },
    { text: '受けた。', reading: 'うけた' },
  ],
  example_tts: 'きのう、 しけんを うけた。',
}

describe('validateExample', () => {
  it('英文：詞塊正確時照原樣保留', () => {
    const r = validateExample('en', enRaw)!
    expect(r.example).toBe(enRaw.example)
    expect(r.example_source).toBe('original')
    expect(r.example_target).toBe('reimbursed')
    expect(r.example_chunks!.map((c) => c.text)).toEqual(enRaw.example_chunks.map((c) => c.text))
    expect(r.example_tts).toBeNull()
  })

  it('target 不是例句的子字串 → 整組為 null', () => {
    expect(validateExample('en', { ...enRaw, example_target: 'reimburse it' })).toBeNull()
    expect(validateExample('en', { ...enRaw, example_target: '' })).toBeNull()
  })

  it('例句為空或超過 200 字元 → null', () => {
    expect(validateExample('en', { ...enRaw, example: '  ' })).toBeNull()
    const long = `${'a '.repeat(100)}reimbursed`
    expect(validateExample('en', { ...enRaw, example: long })).toBeNull()
  })

  it('英文詞塊不符 → 依空格重新切分', () => {
    const r = validateExample('en', {
      ...enRaw,
      example_chunks: [{ text: 'The company' }, { text: 'reimbursed me' }],
    })!
    expect(r.example_chunks!.map((c) => c.text)).toEqual([
      'The',
      'company',
      'reimbursed',
      'my',
      'travel',
      'expenses.',
    ])
  })

  it('英文詞塊缺少或格式錯誤 → 依空格重新切分', () => {
    expect(validateExample('en', { ...enRaw, example_chunks: undefined })!.example_chunks).toHaveLength(6)
    expect(validateExample('en', { ...enRaw, example_chunks: [{ text: 3 }] })!.example_chunks).toHaveLength(6)
  })

  it('英文詞塊不帶讀音', () => {
    const r = validateExample('en', {
      ...enRaw,
      example_chunks: enRaw.example_chunks.map((c) => ({ ...c, reading: 'x' })),
    })!
    expect(r.example_chunks!.every((c) => c.reading === undefined)).toBe(true)
  })

  it('日文：詞塊直接串接一致時保留，含漢字的詞塊保留讀音', () => {
    const r = validateExample('ja', jaRaw)!
    expect(r.example_chunks).toEqual(jaRaw.example_chunks)
    expect(r.example_tts).toBe(jaRaw.example_tts)
  })

  it('日文：不含漢字的詞塊不留讀音', () => {
    const r = validateExample('ja', {
      ...jaRaw,
      example: 'それを受けた。',
      example_chunks: [{ text: 'それを', reading: 'それを' }, { text: '受けた。', reading: 'うけた' }],
    })!
    expect(r.example_chunks).toEqual([{ text: 'それを' }, { text: '受けた。', reading: 'うけた' }])
  })

  it('日文詞塊串接不符 → chunks 為 null，例句保留', () => {
    const r = validateExample('ja', {
      ...jaRaw,
      example_chunks: [{ text: '昨日' }, { text: '試験を受けた。' }],
    })!
    expect(r.example).toBe(jaRaw.example)
    expect(r.example_chunks).toBeNull()
  })

  it('日文 tts 含漢字或英文 → null', () => {
    expect(validateExample('ja', { ...jaRaw, example_tts: '昨日 しけんを うけた。' })!.example_tts).toBeNull()
    expect(validateExample('ja', { ...jaRaw, example_tts: 'kinou' })!.example_tts).toBeNull()
  })

  it('日文 tts 允許片假名與長音', () => {
    expect(validateExample('ja', { ...jaRaw, example_tts: 'コーヒーを のんだ。' })!.example_tts).toBe(
      'コーヒーを のんだ。'
    )
  })

  it('非日文的 tts 一律為 null', () => {
    expect(validateExample('ko', { ...enRaw, example_tts: 'abc' })!.example_tts).toBeNull()
  })

  it('來源不是 original 時視為 generated', () => {
    expect(validateExample('en', { ...enRaw, example_source: 'foo' })!.example_source).toBe('generated')
  })

  it('沒有翻譯時為 null', () => {
    expect(validateExample('en', { ...enRaw, example_translation: ' ' })!.example_translation).toBeNull()
  })
})

describe('splitBySpaces', () => {
  it('英文：標點附在前一塊、縮寫不拆', () => {
    expect(splitBySpaces("I don't know , really !")).toEqual(['I', "don't", 'know ,', 'really !'])
  })

  it('多餘空白正規化', () => {
    expect(splitBySpaces('  Hello   world.  ')).toEqual(['Hello', 'world.'])
  })

  it('句首的獨立標點附在後一塊', () => {
    expect(splitBySpaces('“ Hello world')).toEqual(['“ Hello', 'world'])
  })

  it('韓文依語節切分', () => {
    expect(splitBySpaces('저는 학교에 갑니다.')).toEqual(['저는', '학교에', '갑니다.'])
  })
})

describe('buildClozeSentence', () => {
  it('只挖第一次出現處', () => {
    expect(buildClozeSentence('run, run, run', 'run')).toBe('＿＿, run, run')
  })

  it('找不到時回傳 null', () => {
    expect(buildClozeSentence('hello', 'bye')).toBeNull()
  })

  it('日文', () => {
    expect(buildClozeSentence('昨日、試験を受けた。', '受けた')).toBe('昨日、試験を＿＿。')
  })
})

describe('buildTfSentence', () => {
  it('只替換第一次出現處', () => {
    expect(buildTfSentence('run, run', 'run', 'walk')).toBe('walk, run')
  })

  it('找不到時回傳 null', () => {
    expect(buildTfSentence('hello', 'bye', 'x')).toBeNull()
  })
})

describe('isReorderable', () => {
  const chunks = (n: number) => Array.from({ length: n }, (_, i) => ({ text: String(i) }))
  it('3–12 塊', () => {
    expect(isReorderable(chunks(2))).toBe(false)
    expect(isReorderable(chunks(3))).toBe(true)
    expect(isReorderable(chunks(12))).toBe(true)
    expect(isReorderable(chunks(13))).toBe(false)
    expect(isReorderable(null)).toBe(false)
  })
})

describe('isReorderCorrect', () => {
  it('文字序列一致即正確', () => {
    expect(isReorderCorrect(['I', 'like', 'it'], ['I', 'like', 'it'])).toBe(true)
    expect(isReorderCorrect(['like', 'I', 'it'], ['I', 'like', 'it'])).toBe(false)
  })

  it('相同文字的詞塊互換仍正確（以文字比對，不看詞塊是哪一塊）', () => {
    const answer = ['the', 'cat', 'saw', 'the', 'dog']
    // 使用者把兩個 the 的方塊順序對調，文字序列仍相同
    expect(isReorderCorrect(['the', 'cat', 'saw', 'the', 'dog'], answer)).toBe(true)
  })

  it('塊數不同 → 錯誤', () => {
    expect(isReorderCorrect(['I', 'like'], ['I', 'like', 'it'])).toBe(false)
  })
})

describe('resolveExampleSource', () => {
  const e = validateExample('en', enRaw)!
  it('原文含這句（空白差異不計）→ original', () => {
    expect(resolveExampleSource(e, 'Hello.\nThe  company reimbursed my\ntravel expenses. Bye.')).toBe('original')
  })
  it('原文沒有這句 → generated', () => {
    expect(resolveExampleSource(e, 'Something else.')).toBe('generated')
  })
  it('本來就是 generated → generated', () => {
    expect(resolveExampleSource({ ...e, example_source: 'generated' }, enRaw.example)).toBe('generated')
  })
})

describe('splitAtTarget', () => {
  it('以第一次出現處切分', () => {
    expect(splitAtTarget('run, run', 'run')).toEqual({ before: '', target: 'run', after: ', run' })
  })
  it('找不到或沒有 target → 整句放在 before', () => {
    expect(splitAtTarget('hello', 'bye')).toEqual({ before: 'hello', target: '', after: '' })
    expect(splitAtTarget('hello', null)).toEqual({ before: 'hello', target: '', after: '' })
  })
})

describe('isChunkReadingValid', () => {
  it('假名對得上即相符，讀音省略句末標點也算', () => {
    expect(isChunkReadingValid('学校は', 'がっこうは')).toBe(true)
    expect(isChunkReadingValid('明日、', 'あした')).toBe(true)
    expect(isChunkReadingValid('便利です。', 'べんりです')).toBe(true)
    expect(isChunkReadingValid('お願いしても', 'おねがいしても')).toBe(true)
    expect(isChunkReadingValid('人々', 'ひとびと')).toBe(true)
    expect(isChunkReadingValid('ケーキ屋', 'けーきや')).toBe(true)
  })

  it('讀音少了或多了假名、漢字沒有對應讀音、讀音含漢字 → 不相符', () => {
    expect(isChunkReadingValid('来ましたか。', 'きました')).toBe(false)
    expect(isChunkReadingValid('駅で', 'えき')).toBe(false)
    expect(isChunkReadingValid('駅で', 'えきでした')).toBe(false)
    expect(isChunkReadingValid('駅で', '駅で')).toBe(false)
  })
})

describe('validateExample 日文詞塊讀音', () => {
  it('讀音與詞塊對不上時只去掉讀音，詞塊照常保留', () => {
    const v = validateExample('ja', {
      example: 'いつ日本に来ましたか。',
      example_target: '日本',
      example_chunks: [
        { text: 'いつ' },
        { text: '日本に', reading: 'にほんに' },
        { text: '来ましたか。', reading: 'きました' },
      ],
    })
    expect(v?.example_chunks).toEqual([{ text: 'いつ' }, { text: '日本に', reading: 'にほんに' }, { text: '来ましたか。' }])
  })
})
