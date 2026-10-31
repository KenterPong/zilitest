import type { ExampleSource, Language } from '@/types/vocab'

/** 例句題型（第五節 9.，2026/10/31）：只在自由練習，不影響 word_progress */
export type ExampleQuestionType = 'example_choice' | 'example_tf' | 'example_reorder'

/** 自由練習題型（quiz_sessions.question_type 的英文代碼，2026/10/31 由中文值統一） */
export type QuestionType = 'tf' | 'choice' | 'input' | ExampleQuestionType

export const EXAMPLE_QUESTION_TYPES: ExampleQuestionType[] = ['example_choice', 'example_tf', 'example_reorder']

export const QUESTION_TYPES: QuestionType[] = ['tf', 'choice', 'input', ...EXAMPLE_QUESTION_TYPES]

/** 畫面顯示名稱；不直接顯示資料庫值 */
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  tf: '是非題',
  choice: '選擇題',
  input: '填空題',
  example_choice: '例句選擇',
  example_tf: '例句是非',
  example_reorder: '例句重組',
}

export function isQuestionType(value: unknown): value is QuestionType {
  return typeof value === 'string' && (QUESTION_TYPES as string[]).includes(value)
}

export function isExampleQuestionType(value: unknown): value is ExampleQuestionType {
  return typeof value === 'string' && (EXAMPLE_QUESTION_TYPES as string[]).includes(value)
}

/** 例句題作答後顯示的完整例句（目標字粗體、翻譯、整句播放） */
export interface ExampleReveal {
  example: string
  example_target: string | null
  example_translation: string | null
  example_source: ExampleSource | null
  example_tts: string | null
}

/** 例句句子拆成三段：mark 為挖空（例句選擇，空字串）或粗體標示的字（例句是非） */
export interface SentenceParts {
  before: string
  mark: string
  after: string
}

export interface ExampleOption {
  term: string
  reading: string | null
  pronunciation: string | null
}

export interface QuizChunkTile {
  id: number
  text: string
  reading?: string
}

export interface QuizQuestion {
  word_id: string
  /** 是非／選擇：顯示的外文單字；填空題不回傳（避免洩漏答案） */
  term?: string
  /** 單字的語言：是非／選擇的第二層顯示，填空題的提示文字與輸入法提示 */
  language?: Language
  reading?: string | null
  pronunciation?: string | null
  /** 填空題：顯示的中文提示 */
  prompt?: string
  display_answer?: string
  options?: string[]

  /** 例句選擇（挖空）／例句是非（替換位置粗體）的題目句子 */
  sentence?: SentenceParts
  /** 例句選擇：選項皆為原形 term */
  example_options?: ExampleOption[]
  /** 例句重組：打散的詞塊 */
  chunks?: QuizChunkTile[]
  /** 例句題作答後顯示；例句是非、例句重組作答中也顯示其中的翻譯 */
  reveal?: ExampleReveal
  /**
   * 例句題的正解，供作答後立即顯示對錯（2026/10/31 定案）；送出後伺服器仍依資料庫重新判定。
   * 例句選擇為正解 term，例句重組為原句詞塊文字序列；例句是非以 sentence 是否等於原句判斷
   */
  correct_term?: string
  correct_chunks?: string[]
}
