export type QuestionType = '是非題' | '選擇題' | '輸入題'

export interface QuizQuestion {
  word_id: string
  /** 是非／選擇：顯示的外文單字；填空題不回傳（避免洩漏答案） */
  term?: string
  /** 填空題：顯示的中文提示 */
  prompt?: string
  display_answer?: string
  options?: string[]
}

