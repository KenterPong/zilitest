export const LANGUAGES = ['en', 'ja', 'ko'] as const
export type Language = (typeof LANGUAGES)[number]

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: '英文',
  ja: '日文',
  ko: '韓文',
}

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value)
}

export interface DbWordbook {
  id: string
  user_id: string
  name: string
  /** 建立後不可變更 */
  language: Language
  created_at: string
}

export interface DbWord {
  id: string
  wordbook_id: string
  term: string
  /** 讀音（選填）：日文漢字的假名讀音，填空題輸入讀音也算正確 */
  reading: string | null
  answer: string
  description: string | null
  created_at: string
}

export interface DbTag {
  id: string
  user_id: string
  name: string
}

export interface DbWordStats {
  word_id: string
  user_id: string
  attempt_count: number
  correct_count: number
  last_tested_at: string | null
}

export interface WordbookWithCount extends DbWordbook {
  word_count: number
}

export interface WordWithMeta extends DbWord {
  tags: DbTag[]
  attempt_count: number
  correct_count: number
  accuracy: number | null
}

export interface WordInput {
  term: string
  reading?: string | null
  answer: string
  description?: string | null
  tag_ids?: string[]
}
