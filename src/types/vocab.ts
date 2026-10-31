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
  /** 系統產生的發音標註：英文 IPA、韓文羅馬拼音；日文一律 null（第十三節） */
  pronunciation: string | null
  /** 例句欄位（第三節 2.）；一律由系統寫入，查詢未帶出時為 undefined */
  example?: string | null
  example_translation?: string | null
  example_source?: ExampleSource | null
  example_target?: string | null
  example_chunks?: ExampleChunk[] | null
  example_tts?: string | null
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

/** 例句詞塊（重組用）；reading 僅日文含漢字的詞塊才有 */
export interface ExampleChunk {
  text: string
  reading?: string
}

export type ExampleSource = 'original' | 'generated'

/** words 的例句欄位（第三節 2.）；一律由系統寫入 */
export interface WordExample {
  example: string
  example_translation: string | null
  example_source: ExampleSource
  /** 單字在例句中的實際形態，為 example 的子字串 */
  example_target: string
  /** 詞塊；不可用於重組時為 null */
  example_chunks: ExampleChunk[] | null
  /** 僅日文：整句朗讀用假名 */
  example_tts: string | null
}
