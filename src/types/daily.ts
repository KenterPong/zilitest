import type { TaskQuestionKind } from '@/lib/daily-task'
import type { DiffPart } from '@/lib/answer-match'
import type { Language } from '@/types/vocab'

export type { TaskQuestionKind }

export interface DbLanguageSettings {
  user_id: string
  language: Language
  enabled: boolean
  daily_review_limit: number
  daily_new_limit: number
  peak_mastered_count: number
  updated_at: string
}

export type TaskSummaryStatus = 'ok' | 'too_few_words' | 'nothing_to_do'

export interface TaskSummary {
  language: Language
  status: TaskSummaryStatus
  task_id: string | null
  total: number
  answered: number
  completed: boolean
  /** too_few_words 時該語言的單字數 */
  word_count?: number
}

export interface DailyQuestion {
  word_id: string
  kind: TaskQuestionKind
  /** new / mcq：外文單字；fill 不回傳（避免洩漏答案） */
  term?: string
  /** new：卡片上的中文意思；fill：題目提示（中文） */
  answer?: string
  description?: string | null
  /** new / mcq 的四個選項 */
  options?: string[]
}

export interface DailyTaskPayload {
  task_id: string
  language: Language
  total: number
  answered: number
  completed: boolean
  questions: DailyQuestion[]
}

export interface DailyAnswerResult {
  is_correct: boolean
  /** fill：term；new / mcq：answer */
  correct_answer: string
  diff: DiffPart[] | null
  became_mastered: boolean
  task_completed: boolean
  answered: number
  total: number
  current_streak: number
  new_achievements: string[]
}
