/**
 * 自由練習例句題型（技術規格 v5 第五節 9.）的純邏輯：出題範圍、出題、伺服器判定、是否更新熟練度。
 * 干擾項與替換字只取同語言的字（第五節 6.、7.），並以同詞性優先，避免靠文法刪去；重組判定與打散沿用 example.ts / reorder.ts。
 */
import { normalizeAnswer } from '@/lib/answer-match'
import { isReorderCorrect } from '@/lib/example'
import { shuffled } from '@/lib/games'
import { isReorderUsable, shuffleChunks } from '@/lib/reorder'
import type { ExampleQuestionType, QuestionType, QuizQuestion, SentenceParts } from '@/types/quiz'
import type { ExampleChunk, ExampleSource, Language } from '@/types/vocab'

export interface ExampleQuizWord {
  id: string
  term: string
  reading: string | null
  pronunciation: string | null
  language: Language
  /** AI 抽字寫入詞性（如「動詞」「名詞・約束」）；手動新增可能是任意說明或 null */
  description: string | null
  example: string | null
  example_translation: string | null
  example_source: ExampleSource | null
  example_target: string | null
  example_chunks: ExampleChunk[] | null
  example_tts: string | null
}

/** 例句題型不升級也不降級 word_progress；一般題型照常（第五節 9.） */
export function affectsProgress(questionType: QuestionType): boolean {
  return !questionType.startsWith('example_')
}

/** 例句中找得到目標字（第一次出現處挖空或替換）時回傳拆開的三段 */
function splitTarget(example: string, target: string | null): { before: string; after: string } | null {
  const i = target ? example.indexOf(target) : -1
  if (!target || i < 0) return null
  return { before: example.slice(0, i), after: example.slice(i + target.length) }
}

/** 可當出題字：例句選擇／是非需例句中找得到目標字；重組需詞塊 3–12 塊 */
export function isExampleQuestionWord(type: ExampleQuestionType, w: ExampleQuizWord): boolean {
  if (!w.example?.trim()) return false
  if (type === 'example_reorder') return isReorderUsable(w)
  return splitTarget(w.example, w.example_target) !== null
}

/** description 的第一段視為詞性（「名詞・約束」→「名詞」）；沒有內容時回傳 null */
export function partOfSpeech(description: string | null | undefined): string | null {
  const first = description?.trim().split(/[・、,，/／;；\s]/)[0]?.trim()
  return first ? first.toLowerCase() : null
}

type TermWord = { id: string; term: string; language: Language; description?: string | null }

/**
 * 同語言、term 正規化後與該字不同的其他字，取 n 個。
 * 該字有詞性時先從同詞性的字隨機取，不夠再從其餘的字隨機補
 */
export function pickDistinctTerms<T extends TermWord>(
  pool: T[],
  word: TermWord,
  n: number,
  random: () => number = Math.random
): T[] {
  const own = normalizeAnswer(word.term)
  const pos = partOfSpeech(word.description)
  const samePos = pos ? pool.filter((w) => partOfSpeech(w.description) === pos) : []
  const rest = pos ? pool.filter((w) => partOfSpeech(w.description) !== pos) : pool
  const seen = new Set([own])
  const picked: T[] = []
  for (const w of [...shuffled(samePos, random), ...shuffled(rest, random)]) {
    if (picked.length >= n) break
    if (w.id === word.id || w.language !== word.language) continue
    const key = normalizeAnswer(w.term)
    if (seen.has(key)) continue
    seen.add(key)
    picked.push(w)
  }
  return picked
}

/**
 * 出一題。word 須已通過 isExampleQuestionWord；pool 為干擾項來源（篩選範圍內達門檻語言的全部字）。
 * 例句是非沒有可替換的字時改出「相符」
 */
export function buildExampleQuestion(
  type: ExampleQuestionType,
  word: ExampleQuizWord,
  pool: ExampleQuizWord[],
  random: () => number = Math.random
): QuizQuestion {
  const example = word.example!
  const question: QuizQuestion = {
    word_id: word.id,
    language: word.language,
    reveal: {
      example,
      example_target: word.example_target,
      example_translation: word.example_translation,
      example_source: word.example_source,
      example_tts: word.example_tts,
    },
  }

  if (type === 'example_reorder') {
    const chunks = word.example_chunks!
    question.chunks = shuffleChunks(chunks, random)
    question.correct_chunks = chunks.map((c) => c.text)
    return question
  }

  const parts = splitTarget(example, word.example_target)!
  if (type === 'example_choice') {
    const options = [word, ...pickDistinctTerms(pool, word, 3, random)].map((w) => ({
      term: w.term,
      reading: w.reading,
      pronunciation: w.pronunciation,
    }))
    question.sentence = { ...parts, mark: '' }
    question.example_options = shuffled(options, random)
    question.correct_term = word.term
    return question
  }

  // 例句是非：各半機率；不相符時目標字換成另一個同語言字（同詞性優先）的原形，翻譯不變
  const replacement = random() < 0.5 ? null : pickDistinctTerms(pool, word, 1, random)[0]
  question.sentence = { ...parts, mark: replacement ? replacement.term : word.example_target! }
  return question
}

export function joinSentence(parts: SentenceParts): string {
  return parts.before + parts.mark + parts.after
}

export interface ExampleAnswer {
  /** 例句是非：使用者是否認為相符 */
  user_says_true?: boolean
  /** 例句是非：畫面上顯示的句子 */
  display_sentence?: string
  /** 例句選擇：選到的 term */
  selected_answer?: string
  /** 例句重組：依序填入的詞塊文字 */
  chunk_texts?: string[]
}

/** 伺服器判定（依資料庫的字重新比對，不採信前端的對錯） */
export function judgeExampleAnswer(
  type: ExampleQuestionType,
  word: Pick<ExampleQuizWord, 'term' | 'example' | 'example_chunks'>,
  ans: ExampleAnswer
): boolean {
  if (type === 'example_choice') {
    return normalizeAnswer(ans.selected_answer ?? '') === normalizeAnswer(word.term)
  }
  if (type === 'example_tf') {
    const isMatch = (ans.display_sentence ?? '') === (word.example ?? '')
    return typeof ans.user_says_true === 'boolean' && ans.user_says_true === isMatch
  }
  const chunks = word.example_chunks ?? []
  const texts = Array.isArray(ans.chunk_texts) ? ans.chunk_texts.map(String) : []
  return chunks.length > 0 && isReorderCorrect(chunks.map((c) => c.text), texts)
}

/** 各語言可出例句題的字數（設定頁計算最多題數；重組另計） */
export function countExampleWordsByLanguage(
  words: ExampleQuizWord[]
): { example: Partial<Record<Language, number>>; reorder: Partial<Record<Language, number>> } {
  const example: Partial<Record<Language, number>> = {}
  const reorder: Partial<Record<Language, number>> = {}
  for (const w of words) {
    if (isExampleQuestionWord('example_choice', w)) example[w.language] = (example[w.language] ?? 0) + 1
    if (isExampleQuestionWord('example_reorder', w)) reorder[w.language] = (reorder[w.language] ?? 0) + 1
  }
  return { example, reorder }
}
