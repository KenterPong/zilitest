export interface DbWordbook {
  id: string
  user_id: string
  name: string
  created_at: string
}

export interface DbWord {
  id: string
  wordbook_id: string
  term: string
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
  answer: string
  description?: string | null
  tag_ids?: string[]
}
