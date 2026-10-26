import { describe, expect, it } from 'vitest'

import {
  buildListenPool,
  canStartListen,
  firstMeaning,
  formatMatchTime,
  isGameKey,
  isNewBest,
  isValidListenResult,
  LISTEN_CHOICES,
  listenKeys,
  makeListenQuestion,
  matchScore,
  nextListenQuestion,
  pickGameWords,
  reshuffleListenPool,
  seededRandom,
  type GameWord,
  type ListenWord,
} from '@/lib/games'

let n = 0
function w(term: string, answer: string, stage: number): GameWord {
  n += 1
  return { id: `w${n}`, term, reading: null, answer, stage }
}

describe('firstMeaning', () => {
  it('取第一個譯義', () => {
    expect(firstMeaning('償還、退款、報銷')).toBe('償還')
    expect(firstMeaning('旅程')).toBe('旅程')
    expect(firstMeaning('、繼續')).toBe('繼續')
  })
})

describe('pickGameWords', () => {
  it('優先抽學過的字，不足以未學的字補足', () => {
    const words = [
      w('a', '一', 1),
      w('b', '二', 2),
      w('c', '三', 5),
      w('d', '四', 0),
      w('e', '五', 0),
      w('f', '六', 0),
      w('g', '七', 0),
    ]
    const picked = pickGameWords(words, 6, () => 0.5)!
    expect(picked).toHaveLength(6)
    const ids = picked.map((p) => p.id)
    for (const learned of words.filter((x) => x.stage >= 1)) expect(ids).toContain(learned.id)
  })

  it('第一個譯義相同的字不同時入選', () => {
    const words = [
      w('repay', '償還、還款', 2),
      w('reimburse', '償還、報銷', 2),
      w('b', '二', 1),
      w('c', '三', 1),
      w('d', '四', 1),
      w('e', '五', 1),
      w('f', '六', 1),
    ]
    const picked = pickGameWords(words, 6)!
    expect(picked.filter((p) => p.meaning === '償還')).toHaveLength(1)
  })

  it('外文相同（大小寫不同）也不重複', () => {
    const words = [w('Apple', '蘋果', 1), w('apple', '蘋果樹', 1), w('b', '二', 1), w('c', '三', 1), w('d', '四', 1), w('e', '五', 1)]
    expect(pickGameWords(words, 6)).toBeNull()
  })

  it('字數不足回傳 null', () => {
    expect(pickGameWords([w('a', '一', 1), w('b', '二', 1)], 6)).toBeNull()
  })

  it('中文只保留第一個譯義', () => {
    const words = Array.from({ length: 6 }, (_, i) => w(`t${i}`, `意思${i}、其他`, 1))
    expect(pickGameWords(words, 6)!.every((p) => !p.meaning.includes('、'))).toBe(true)
  })
})

describe('計分與最佳', () => {
  it('配對成績含罰秒', () => {
    expect(matchScore(12_345.6, 2)).toBe(18_346)
  })

  it('配對越快越好；其他遊戲越多越好', () => {
    expect(isNewBest('match', 15_000, null)).toBe(true)
    expect(isNewBest('match', 15_000, 16_000)).toBe(true)
    expect(isNewBest('match', 16_000, 15_000)).toBe(false)
    expect(isNewBest('listen', 12, 10)).toBe(true)
    expect(isNewBest('listen', 10, 10)).toBe(false)
  })

  it('格式與遊戲代碼', () => {
    expect(formatMatchTime(12_340)).toBe('12.3 秒')
    expect(isGameKey('match')).toBe(true)
    expect(isGameKey('listen')).toBe(true)
    expect(isGameKey('spell')).toBe(true)
    expect(isGameKey('poker')).toBe(false)
  })
})

describe('seededRandom', () => {
  it('同一個種子產生相同序列，範圍在 [0, 1)', () => {
    const a = seededRandom(42)
    const b = seededRandom(42)
    const seqA = Array.from({ length: 5 }, a)
    const seqB = Array.from({ length: 5 }, b)
    expect(seqA).toEqual(seqB)
    expect(seqA.every((x) => x >= 0 && x < 1)).toBe(true)
  })

  it('不同種子產生不同序列', () => {
    expect(seededRandom(1)()).not.toBe(seededRandom(2)())
  })
})

// ---------- 聽音辨字 ----------

let ln = 0
function lw(term: string, reading: string | null = null, meaning = '意思'): ListenWord {
  ln += 1
  return { id: `l${ln}`, term, reading, pronunciation: null, meaning, learned: true }
}

describe('listenKeys', () => {
  it('日文以讀音比對，沒填讀音時用單字本身，片假名與平假名視為相同', () => {
    const chopsticks = listenKeys(lw('箸', 'はし'), 'ja')
    const kanaOnly = listenKeys(lw('ハシ'), 'ja')
    expect(chopsticks.some((k) => kanaOnly.includes(k))).toBe(true)
  })

  it('英文只比對外文（同音字不另外排除）', () => {
    expect(listenKeys(lw('Right'), 'en')).toEqual(['right'])
    expect(listenKeys(lw('write'), 'en')).toEqual(['write'])
  })
})

describe('buildListenPool', () => {
  it('學過的字在前、新字在後，只取第一個譯義', () => {
    const pool = buildListenPool(
      [w('new', '新、新的', 0), w('old', '舊', 2), w('big', '大', 1)],
      seededRandom(1)
    )
    expect(pool.slice(0, 2).map((p) => p.term).sort()).toEqual(['big', 'old'])
    expect(pool[2]).toMatchObject({ term: 'new', meaning: '新' })
  })

  it('超過上限時截斷', () => {
    const words = Array.from({ length: 10 }, (_, i) => w(`t${i}`, `m${i}`, 1))
    expect(buildListenPool(words, Math.random, 5)).toHaveLength(5)
  })
})

describe('reshuffleListenPool', () => {
  it('學過的字仍排在新字前面', () => {
    const pool = [lw('a'), lw('b'), { ...lw('c'), learned: false }, { ...lw('d'), learned: false }]
    for (let seed = 1; seed <= 10; seed++) {
      const r = reshuffleListenPool(pool, seededRandom(seed))
      expect(r.slice(0, 2).every((x) => x.learned)).toBe(true)
      expect(r.map((x) => x.term).sort()).toEqual(['a', 'b', 'c', 'd'])
    }
  })
})

describe('canStartListen', () => {
  it('需要 4 個彼此不衝突的字', () => {
    expect(canStartListen([lw('a'), lw('b'), lw('c')], 'en')).toBe(false)
    expect(canStartListen([lw('a'), lw('b'), lw('c'), lw('A')], 'en')).toBe(false)
    expect(canStartListen([lw('a'), lw('b'), lw('c'), lw('d')], 'en')).toBe(true)
  })

  it('日文同音字只算一個', () => {
    const pool = [lw('橋', 'はし'), lw('箸', 'はし'), lw('はし'), lw('雨', 'あめ'), lw('飴', 'あめ'), lw('空', 'そら')]
    expect(canStartListen(pool, 'ja')).toBe(false)
    expect(canStartListen([...pool, lw('海', 'うみ')], 'ja')).toBe(true)
  })
})

describe('makeListenQuestion', () => {
  it('4 個選項含正解，且沒有同音或同外文的字', () => {
    const target = lw('橋', 'はし')
    const pool = [target, lw('箸', 'はし'), lw('ハシ'), lw('雨', 'あめ'), lw('空', 'そら'), lw('海', 'うみ')]
    for (let seed = 1; seed <= 20; seed++) {
      const q = makeListenQuestion(pool, target, 'ja', seededRandom(seed))!
      expect(q.choices).toHaveLength(LISTEN_CHOICES)
      expect(q.choices).toContain(target)
      expect(q.choices.map((c) => c.term).sort()).toEqual(['橋', '海', '空', '雨'].sort())
    }
  })

  it('湊不滿 3 個干擾選項時回傳 null', () => {
    const target = lw('a')
    expect(makeListenQuestion([target, lw('b'), lw('c'), lw('A')], target, 'en')).toBeNull()
  })
})

describe('nextListenQuestion', () => {
  it('依序輪流當正解，跳過湊不出選項的字', () => {
    // 'x' 與 'X' 衝突，但其他字夠多，所有字都能出題
    const pool = [lw('x'), lw('X'), lw('b'), lw('c'), lw('d')]
    const first = nextListenQuestion(pool, 0, 'en')!
    expect(first.question.answer.term).toBe('x')
    expect(first.next).toBe(1)
    const wrapped = nextListenQuestion(pool, 5, 'en')!
    expect(wrapped.question.answer.term).toBe('x')
  })

  it('整個題庫都湊不出時回傳 null', () => {
    expect(nextListenQuestion([lw('a'), lw('b')], 0, 'en')).toBeNull()
  })
})

describe('isValidListenResult', () => {
  it('答對 0–60 題，出題數介於答對數與答對＋答錯＋1 之間', () => {
    expect(isValidListenResult(12, 15, 2)).toBe(true)
    expect(isValidListenResult(0, 1, 0)).toBe(true)
    expect(isValidListenResult(61, 61, 0)).toBe(false)
    expect(isValidListenResult(5, 4, 0)).toBe(false)
    expect(isValidListenResult(5, 9, 2)).toBe(false)
    expect(isValidListenResult(1.5, 3, 0)).toBe(false)
    expect(isValidListenResult(3, 0, 0)).toBe(false)
  })
})
