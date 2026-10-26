/**
 * 拼字挑戰（技術規格 v5 第十二節 5.）的純邏輯：切方塊、出題範圍、干擾字、打散、計分檢查。
 * 字元比對一律以填空題的正規化為準（NFKC、忽略大小寫、片假名視同平假名）。
 */
import { normalizeAnswer } from '@/lib/answer-match'
import { shuffled, type GameWord } from '@/lib/games'
import type { Language } from '@/types/vocab'

/** 一局 60 秒 */
export const SPELL_DURATION_MS = 60_000
/** 答對後顯示答案的時間（計時照算） */
export const SPELL_CORRECT_MS = 800
/** 跳過後顯示正確答案的時間（計時照算） */
export const SPELL_SKIP_MS = 1000
/** 答錯時空格標示錯誤的時間 */
export const SPELL_WRONG_FLASH_MS = 500
/** 每題干擾方塊數（日文不足時有幾個算幾個） */
export const SPELL_DISTRACTORS = 3
/** 可出題的字少於此數不開放 */
export const SPELL_MIN_WORDS = 5
export const SPELL_MIN_LENGTH = 2
export const SPELL_MAX_LENGTH = 12
export const SPELL_POOL_LIMIT = 300
/** 成績合理上限：每題答對後至少停 0.8 秒，60 秒內不可能超過 75 題 */
export const SPELL_MAX_SCORE = 75

type CharType = 'latin' | 'hiragana' | 'katakana' | 'kanji' | 'hangul'

const HAN = new RegExp(String.raw`\p{Script=Han}`, 'u')
/** 長音與疊字符號：可出現在 term 中，但不拿來當干擾字 */
const PROLONGED_MARK = 'ー'
const ITERATION_MARK = '々'

function charType(c: string): CharType | null {
  const code = c.codePointAt(0) ?? 0
  if (/^[A-Za-z]$/.test(c)) return 'latin'
  if (code >= 0xac00 && code <= 0xd7a3) return 'hangul'
  if (code >= 0x3041 && code <= 0x3096) return 'hiragana'
  if ((code >= 0x30a1 && code <= 0x30fa) || c === PROLONGED_MARK) return 'katakana'
  if (c === ITERATION_MARK || HAN.test(c)) return 'kanji'
  return null
}

const LANGUAGE_TYPES: Record<Language, CharType[]> = {
  en: ['latin'],
  ja: ['hiragana', 'katakana', 'kanji'],
  ko: ['hangul'],
}

/** 方塊切分：英文逐字母（保留大小寫）、日文逐字元、韓文逐音節；重複字元各自一塊 */
export function splitTiles(term: string): string[] {
  return Array.from(term.trim().normalize('NFC'))
}

/** 能否出題：長度 2–12，且只含該語言的文字（含空格、連字號、撇號、數字或符號者排除） */
export function isSpellable(language: Language, term: string): boolean {
  const chars = splitTiles(term)
  if (chars.length < SPELL_MIN_LENGTH || chars.length > SPELL_MAX_LENGTH) return false
  const allowed = LANGUAGE_TYPES[language]
  return chars.every((c) => {
    const t = charType(c)
    return t !== null && allowed.includes(t)
  })
}

/** 英韓的備用字元表；日文不補（第十二節 5.） */
const FALLBACK_CHARS: Record<Language, string[]> = {
  en: Array.from('abcdefghijklmnopqrstuvwxyz'),
  ja: [],
  ko: Array.from(
    new Set(
      Array.from(
        '가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허고노도로모보소오조초코토포호' +
          '구누두루무부수우주추쿠투푸후그느드르므브스으즈츠크트프흐기니디리미비시이지치키티피히' +
          '개내대래매배새애재채해게네데레메베세에제한국인학교생일름음식간친공방문물말물질날밤'
      )
    )
  ),
}

/** 英文干擾字的大小寫跟著 term：全大寫的字用大寫，其餘用小寫 */
function matchCase(c: string, term: string): string {
  return term === term.toUpperCase() && term !== term.toLowerCase() ? c.toUpperCase() : c.toLowerCase()
}

/**
 * 干擾字元：不可出現在 term 中、彼此不重複（皆以正規化後比對）。
 * 優先取同語言其他單字中與 term 同類型的字元，其次其他類型；英韓不足時以備用表補，日文有幾個算幾個
 */
export function pickDistractors(
  language: Language,
  term: string,
  sameLanguageTerms: string[],
  random: () => number = Math.random
): string[] {
  const tiles = splitTiles(term)
  const taken = new Set(tiles.map(normalizeAnswer))
  const termTypes = new Set(tiles.map(charType))
  const allowed = LANGUAGE_TYPES[language]

  const seen = new Set<string>()
  const same: string[] = []
  const other: string[] = []
  for (const t of sameLanguageTerms) {
    for (const raw of splitTiles(t)) {
      if (raw === PROLONGED_MARK || raw === ITERATION_MARK) continue
      const type = charType(raw)
      if (!type || !allowed.includes(type)) continue
      const c = language === 'en' ? matchCase(raw, term) : raw
      const key = normalizeAnswer(c)
      if (taken.has(key) || seen.has(key)) continue
      seen.add(key)
      ;(termTypes.has(type) ? same : other).push(c)
    }
  }

  const picks: string[] = []
  const add = (list: string[]) => {
    for (const c of list) {
      if (picks.length >= SPELL_DISTRACTORS) return
      const key = normalizeAnswer(c)
      if (taken.has(key)) continue
      taken.add(key)
      picks.push(c)
    }
  }
  add(shuffled(same, random))
  add(shuffled(other, random))
  add(
    shuffled(
      FALLBACK_CHARS[language].map((c) => (language === 'en' ? matchCase(c, term) : c)),
      random
    )
  )
  return picks
}

export interface SpellTile {
  id: number
  char: string
}

/** 打散後的方塊是否剛好有一段依原順序排出 term（重複字元視為相同） */
function revealsTerm(tiles: SpellTile[], term: string[]): boolean {
  for (let start = 0; start + term.length <= tiles.length; start++) {
    if (term.every((c, i) => tiles[start + i]!.char === c)) return true
  }
  return false
}

/** 打散全部方塊；剛好依原順序連續排出正確單字時重新打散（最多試 20 次，避免極短單字卡住） */
export function shuffleTiles(
  chars: string[],
  term: string[],
  random: () => number = Math.random
): SpellTile[] {
  const tiles = chars.map((char, id) => ({ id, char }))
  let result = shuffled(tiles, random)
  for (let i = 0; i < 20 && revealsTerm(result, term); i++) result = shuffled(tiles, random)
  return result
}

export interface SpellWord {
  id: string
  term: string
  reading: string | null
  pronunciation: string | null
  /** 完整譯義（題目） */
  answer: string
  /** stage ≥ 1（學過的字），再玩一局重新洗牌時仍排在前面 */
  learned: boolean
}

export interface SpellQuestion {
  word: SpellWord
  /** term 切出的方塊（作答比對用） */
  answerTiles: string[]
  tiles: SpellTile[]
}

/** 題庫：可出題的字中，學過的字在前、新字在後，各自打散（上限 300 字） */
export function buildSpellPool(
  words: GameWord[],
  language: Language,
  random: () => number = Math.random,
  limit = SPELL_POOL_LIMIT
): SpellWord[] {
  const spellable = words.filter((w) => isSpellable(language, w.term))
  const toSpell = (w: GameWord): SpellWord => ({
    id: w.id,
    term: w.term.trim(),
    reading: w.reading,
    pronunciation: w.pronunciation ?? null,
    answer: w.answer,
    learned: w.stage >= 1,
  })
  return [
    ...shuffled(
      spellable.filter((w) => w.stage >= 1),
      random
    ),
    ...shuffled(
      spellable.filter((w) => w.stage < 1),
      random
    ),
  ]
    .slice(0, limit)
    .map(toSpell)
}

/** 再玩一局或題庫用完：學過的字與新字各自重新打散，學過的字仍在前 */
export function reshuffleSpellPool(pool: SpellWord[], random: () => number = Math.random): SpellWord[] {
  return [
    ...shuffled(
      pool.filter((w) => w.learned),
      random
    ),
    ...shuffled(
      pool.filter((w) => !w.learned),
      random
    ),
  ]
}

/** 出一題：term 的方塊 + 干擾方塊，全部打散 */
export function makeSpellQuestion(
  word: SpellWord,
  language: Language,
  sameLanguageTerms: string[],
  random: () => number = Math.random
): SpellQuestion {
  const answerTiles = splitTiles(word.term)
  const distractors = pickDistractors(language, word.term, sameLanguageTerms, random)
  return { word, answerTiles, tiles: shuffleTiles([...answerTiles, ...distractors], answerTiles, random) }
}

/** 填滿後判定：正規化後與 term 完全一致（不接受 reading） */
export function isSpellCorrect(filled: string[], term: string): boolean {
  return normalizeAnswer(filled.join('')) === normalizeAnswer(term)
}

/**
 * 英文鍵盤：輸入字母選取第一個相符（不分大小寫）且未使用的方塊；沒有相符時回傳 null
 */
export function tileForKey(tiles: SpellTile[], used: Set<number>, key: string): SpellTile | null {
  if (!/^[A-Za-z]$/.test(key)) return null
  const k = key.toLowerCase()
  return tiles.find((t) => !used.has(t.id) && t.char.toLowerCase() === k) ?? null
}

export function isValidSpellResult(score: number, wordCount: number, mistakes: number): boolean {
  return (
    Number.isInteger(score) &&
    Number.isInteger(wordCount) &&
    Number.isInteger(mistakes) &&
    score >= 0 &&
    score <= SPELL_MAX_SCORE &&
    wordCount >= 1 &&
    wordCount >= score &&
    wordCount <= score + mistakes + 1 &&
    mistakes >= 0
  )
}
