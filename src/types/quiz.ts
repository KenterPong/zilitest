export type QuestionType = '是非題' | '選擇題' | '輸入題'

export interface QuizQuestion {
  word_id: string
  term: string
  display_answer?: string
  options?: string[]
}
