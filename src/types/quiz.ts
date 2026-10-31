import type { Language } from '@/types/vocab'

/** 自由練習題型（quiz_sessions.question_type 的英文代碼，2026/10/31 由中文值統一） */
export type QuestionType = 'tf' | 'choice' | 'input'

export const QUESTION_TYPES: QuestionType[] = ['tf', 'choice', 'input']

/** 畫面顯示名稱；不直接顯示資料庫值 */
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  tf: '是非題',
  choice: '選擇題',
  input: '填空題',
}

export function isQuestionType(value: unknown): value is QuestionType {
  return typeof value === 'string' && (QUESTION_TYPES as string[]).includes(value)
}

export interface QuizQuestion {
  word_id: string
  /** 是非／選擇：顯示的外文單字；填空題不回傳（避免洩漏答案） */
  term?: string
  /** 是非／選擇：第二層顯示用 */
  language?: Language
  reading?: string | null
  pronunciation?: string | null
  /** 填空題：顯示的中文提示 */
  prompt?: string
  display_answer?: string
  options?: string[]
}
