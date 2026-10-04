import 'server-only'

import {
  buildAnswerDiff,
  fillDiffTarget,
  formatTermWithReading,
  isFillAnswerCorrect,
} from '@/lib/answer-match'
import {
  pickDistractors,
  planDailyTask,
  questionKindFor,
  taskCompletion,
  type DailyTaskPlan,
} from '@/lib/daily-task'
import { fetchByIds } from '@/lib/db-paging'
import { getLanguageSettings, refreshPeakMastered, unlockAchievements } from '@/lib/growth-service'
import { applyAnswer, type ProgressState } from '@/lib/progress'
import { applyNoTaskDay, applyTaskCompleted, checkStreakBreak, type StreakState } from '@/lib/streak'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { taipeiToday, type TaipeiDate } from '@/lib/taipei-date'
import { shuffle } from '@/lib/weighted-sample'
import type {
  DailyAnswerResult,
  DailyQuestion,
  DailyTaskPayload,
  TaskQuestionKind,
  TaskSummary,
} from '@/types/daily'
import type { DbUser } from '@/types/user'
import type { Language } from '@/types/vocab'

export interface LanguageWord {
  id: string
  term: string
  reading: string | null
  answer: string
  description: string | null
  created_at: string
  wordbook_created_at: string
  stage: number
  due_date: TaipeiDate | null
  lapse_count: number
  introduced_at: string | null
  last_reviewed_date: TaipeiDate | null
  mastered_at: string | null
}

interface DbDailyTask {
  id: string
  user_id: string
  task_date: TaipeiDate
  language: Language
  review_word_ids: string[]
  new_word_ids: string[]
  completed_at: string | null
}

export class DailyTaskError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message)
  }
}

export async function getLanguageWords(userId: string, language: Language): Promise<LanguageWord[]> {
  const { data, error } = await supabaseAdmin.rpc('get_language_words', {
    p_user_id: userId,
    p_language: language,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as LanguageWord[]
}

export function toProgressState(row: {
  stage: number
  due_date: TaipeiDate | null
  introduced_at: string | null
  last_reviewed_date: TaipeiDate | null
  lapse_count: number
  mastered_at: string | null
}): ProgressState {
  return {
    stage: row.stage,
    due_date: row.due_date,
    introduced_at: row.introduced_at,
    last_reviewed_date: row.last_reviewed_date,
    lapse_count: row.lapse_count,
    mastered_at: row.mastered_at,
  }
}

function streakOf(user: DbUser): StreakState {
  return {
    current_streak: user.current_streak,
    longest_streak: user.longest_streak,
    last_streak_date: user.last_streak_date,
  }
}

async function saveStreak(userId: string, next: StreakState): Promise<void> {
  const { error } = await supabaseAdmin.from('users').update(next).eq('id', userId)
  if (error) throw new Error(error.message)
}

function taskWordIds(task: DbDailyTask): string[] {
  return [...task.review_word_ids, ...task.new_word_ids]
}

async function createTask(
  userId: string,
  today: TaipeiDate,
  language: Language,
  plan: Extract<DailyTaskPlan, { status: 'ok' }>
): Promise<DbDailyTask> {
  // 併發時以 UNIQUE (user_id, task_date, language) 確保同一天只產生一次
  const { error } = await supabaseAdmin.from('daily_tasks').upsert(
    {
      user_id: userId,
      task_date: today,
      language,
      review_word_ids: plan.review_word_ids,
      new_word_ids: plan.new_word_ids,
    },
    { onConflict: 'user_id,task_date,language', ignoreDuplicates: true }
  )
  if (error) throw new Error(error.message)

  const { data, error: selErr } = await supabaseAdmin
    .from('daily_tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('task_date', today)
    .eq('language', language)
    .single()
  if (selErr || !data) throw new Error(selErr?.message ?? '建立每日任務失敗')
  return data as DbDailyTask
}

async function ensureTaskSession(userId: string, task: DbDailyTask): Promise<string> {
  const find = () =>
    supabaseAdmin.from('quiz_sessions').select('id').eq('daily_task_id', task.id).maybeSingle()

  const { data: existing } = await find()
  if (existing) return existing.id

  const { data, error } = await supabaseAdmin
    .from('quiz_sessions')
    .insert({
      user_id: userId,
      mode: 'daily_task',
      daily_task_id: task.id,
      question_type: 'mixed',
      word_count_requested: taskWordIds(task).length,
    })
    .select('id')
    .single()
  if (data) return data.id

  // 併發建立：UNIQUE (daily_task_id) 衝突時改讀已存在者
  if (error?.code === '23505') {
    const { data: again } = await find()
    if (again) return again.id
  }
  throw new Error(error?.message ?? '建立任務場次失敗')
}

/** 本任務已作答的字 → 是否答對 */
async function answeredWords(sessionId: string): Promise<Map<string, boolean>> {
  const { data, error } = await supabaseAdmin
    .from('quiz_answers')
    .select('word_id, is_correct')
    .eq('session_id', sessionId)
  if (error) throw new Error(error.message)
  return new Map((data ?? []).map((r) => [r.word_id, r.is_correct as boolean]))
}

/** 任務中仍存在的單字（建立任務後使用者可能刪字） */
async function existingTaskWordIds(task: DbDailyTask): Promise<Set<string>> {
  const rows = await fetchByIds(taskWordIds(task), (ids) =>
    supabaseAdmin.from('words').select('id').in('id', ids)
  )
  return new Set(rows.map((r) => r.id))
}

/** 只計仍存在的單字（第八節 6.） */
async function taskProgress(task: DbDailyTask, sessionId: string) {
  const [existing, answered] = await Promise.all([
    existingTaskWordIds(task),
    answeredWords(sessionId),
  ])
  let answeredCount = 0
  let correctCount = 0
  existing.forEach((id) => {
    if (!answered.has(id)) return
    answeredCount += 1
    if (answered.get(id)) correctCount += 1
  })
  return { existing, answered, total: existing.size, answeredCount, correctCount }
}

/**
 * 剩餘單字都已作答 → 寫入 completed_at 並更新連續天數。
 * 呼叫端只能傳入 task_date = 今天的任務，不可回溯補完過去日期的任務。
 * 只有第一個把 completed_at 從 NULL 改掉的請求會更新連續天數。
 */
async function completeTaskIfDone(
  userId: string,
  task: DbDailyTask,
  progress: { total: number; answeredCount: number },
  today: TaipeiDate,
  streak: StreakState
): Promise<{ completedNow: boolean; streak: StreakState }> {
  if (task.task_date !== today) return { completedNow: false, streak }
  if (task.completed_at !== null) return { completedNow: false, streak }
  if (taskCompletion(progress.total, progress.answeredCount) !== 'done') {
    return { completedNow: false, streak }
  }

  const { data: done, error } = await supabaseAdmin
    .from('daily_tasks')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', task.id)
    .is('completed_at', null)
    .select('id')
  if (error) throw new Error(error.message)
  if (!done || done.length === 0) return { completedNow: false, streak }

  const next = applyTaskCompleted(streak, today)
  if (next !== streak) await saveStreak(userId, next)
  return { completedNow: true, streak: next }
}

export interface TodayOverview {
  today: TaipeiDate
  tasks: TaskSummary[]
  streak: StreakState
}

/**
 * 使用者當日進入 App 時呼叫（lazy，不需 cron）：
 * 連續天數中斷判定 → 為每個啟用語言產生當日任務 → 無任務可做時保持連續天數
 */
export async function ensureToday(user: DbUser): Promise<TodayOverview> {
  const today = taipeiToday()
  let streak = streakOf(user)

  const checked = checkStreakBreak(streak, today, user.streak_frozen_at !== null)
  if (checked !== streak) {
    await saveStreak(user.id, checked)
    streak = checked
  }

  // 暫停中不產生任務，成長資料凍結
  if (user.status === 'suspended') return { today, tasks: [], streak }

  const settings = (await getLanguageSettings(user.id)).filter((s) => s.enabled)

  const { data: existingTasks, error } = await supabaseAdmin
    .from('daily_tasks')
    .select('*')
    .eq('user_id', user.id)
    .eq('task_date', today)
  if (error) throw new Error(error.message)
  const taskByLanguage = new Map(
    ((existingTasks ?? []) as DbDailyTask[]).map((t) => [t.language, t])
  )

  const tasks: TaskSummary[] = []
  let completedNow = false
  for (const s of settings) {
    let task = taskByLanguage.get(s.language)
    if (!task) {
      const words = await getLanguageWords(user.id, s.language)
      const plan = planDailyTask(words, s, today)
      if (plan.status !== 'ok') {
        tasks.push({
          language: s.language,
          status: plan.status,
          task_id: null,
          total: 0,
          answered: 0,
          completed: false,
          word_count: plan.status === 'too_few_words' ? plan.word_count : undefined,
        })
        continue
      }
      task = await createTask(user.id, today, s.language, plan)
    }

    const sessionId = await ensureTaskSession(user.id, task)
    const progress = await taskProgress(task, sessionId)

    // 任務中的字已全部刪除：不算完成、不重新產生，視同當日該語言沒有任務
    if (taskCompletion(progress.total, progress.answeredCount) === 'empty') {
      tasks.push({
        language: s.language,
        status: 'words_deleted',
        task_id: task.id,
        total: 0,
        answered: 0,
        completed: false,
      })
      continue
    }

    // 未答的字被刪光時，作答 API 不會再被呼叫，於進入 App 時補做完成判定（僅限今天）
    const result = await completeTaskIfDone(user.id, task, progress, today, streak)
    if (result.completedNow) {
      streak = result.streak
      completedNow = true
    }

    tasks.push({
      language: s.language,
      status: 'ok',
      task_id: task.id,
      total: progress.total,
      answered: progress.answeredCount,
      completed: task.completed_at !== null || result.completedNow,
    })
  }

  if (completedNow) await unlockAchievements(user.id, streak.current_streak)

  // 所有啟用語言都沒有任務可做：視為保持，不中斷
  if (settings.length > 0 && tasks.every((t) => t.status !== 'ok')) {
    const kept = applyNoTaskDay(streak, today)
    if (kept !== streak) {
      await saveStreak(user.id, kept)
      streak = kept
    }
  }

  return { today, tasks, streak }
}

async function getTodayTask(userId: string, language: Language): Promise<DbDailyTask | null> {
  const { data, error } = await supabaseAdmin
    .from('daily_tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('task_date', taipeiToday())
    .eq('language', language)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as DbDailyTask | null) ?? null
}

/** 今日某語言任務的剩餘題目（中途離開可續作） */
export async function getDailyTaskPayload(
  user: DbUser,
  language: Language
): Promise<DailyTaskPayload | null> {
  const task = await getTodayTask(user.id, language)
  if (!task) return null

  const sessionId = await ensureTaskSession(user.id, task)
  const [answered, words] = await Promise.all([
    answeredWords(sessionId),
    getLanguageWords(user.id, language),
  ])
  const wordById = new Map(words.map((w) => [w.id, w]))
  const newIds = new Set(task.new_word_ids)
  const allAnswers = words.map((w) => w.answer)

  const ids = taskWordIds(task).filter((id) => wordById.has(id))
  const questions: DailyQuestion[] = ids
    .filter((id) => !answered.has(id))
    .map((id) => {
      const w = wordById.get(id)!
      const kind = questionKindFor(w.stage, newIds.has(id))
      if (kind === 'fill') {
        return { word_id: id, kind, answer: w.answer }
      }
      const options = shuffle([w.answer, ...pickDistractors(w.answer, allAnswers)])
      if (kind === 'new') {
        return {
          word_id: id,
          kind,
          term: w.term,
          reading: w.reading,
          answer: w.answer,
          description: w.description,
          options,
        }
      }
      return { word_id: id, kind, term: w.term, options }
    })

  return {
    task_id: task.id,
    language,
    total: ids.length,
    answered: ids.length - questions.length,
    correct: ids.filter((id) => answered.get(id) === true).length,
    completed: task.completed_at !== null,
    questions: shuffle(questions),
  }
}

export interface DailyAnswerInput {
  task_id: string
  word_id: string
  kind: TaskQuestionKind
  selected_answer?: string
  user_input?: string
}

export async function submitDailyAnswer(
  user: DbUser,
  input: DailyAnswerInput
): Promise<DailyAnswerResult> {
  const today = taipeiToday()
  const now = new Date().toISOString()

  const { data: taskRow } = await supabaseAdmin
    .from('daily_tasks')
    .select('*')
    .eq('id', input.task_id)
    .eq('user_id', user.id)
    .maybeSingle()
  const task = taskRow as DbDailyTask | null
  if (!task) throw new DailyTaskError('找不到每日任務', 404)
  if (task.task_date !== today) throw new DailyTaskError('這是之前的任務，請回首頁開始今天的任務', 409)

  const isNew = task.new_word_ids.includes(input.word_id)
  if (!isNew && !task.review_word_ids.includes(input.word_id)) {
    throw new DailyTaskError('此單字不在今日任務中', 400)
  }
  if (isNew !== (input.kind === 'new')) throw new DailyTaskError('題型不符', 400)

  const [{ data: word }, { data: progressRow }] = await Promise.all([
    supabaseAdmin
      .from('words')
      .select('id, term, reading, answer, wordbooks!inner(user_id)')
      .eq('id', input.word_id)
      .eq('wordbooks.user_id', user.id)
      .maybeSingle(),
    supabaseAdmin.from('word_progress').select('*').eq('word_id', input.word_id).maybeSingle(),
  ])
  if (!word) throw new DailyTaskError('找不到單字', 404)

  const isFill = input.kind === 'fill'
  const isCorrect = isFill
    ? isFillAnswerCorrect(input.user_input ?? '', word.term, word.reading)
    : (input.selected_answer ?? '').trim() === word.answer.trim()

  const outcome = applyAnswer(progressRow ? toProgressState(progressRow) : null, {
    isCorrect,
    isNewIntroduction: isNew,
    today,
    now,
  })

  const sessionId = await ensureTaskSession(user.id, task)
  const { error: recErr } = await supabaseAdmin.rpc('record_answers', {
    p_user_id: user.id,
    p_session_id: sessionId,
    p_answers: [
      { word_id: word.id, is_correct: isCorrect, progress: outcome.changed ? outcome.next : null },
    ],
  })
  if (recErr) throw new Error(recErr.message)

  const progress = await taskProgress(task, sessionId)
  const { total, answeredCount, correctCount } = progress
  const completion = await completeTaskIfDone(user.id, task, progress, today, streakOf(user))
  const streak = completion.streak
  const taskCompleted = completion.completedNow

  if (outcome.becameMastered) await refreshPeakMastered(user.id)
  const newAchievements =
    outcome.becameMastered || taskCompleted
      ? await unlockAchievements(user.id, streak.current_streak)
      : []

  return {
    is_correct: isCorrect,
    correct_answer: isFill ? formatTermWithReading(word.term, word.reading) : word.answer,
    diff:
      isFill && !isCorrect
        ? buildAnswerDiff(
            input.user_input ?? '',
            fillDiffTarget(input.user_input ?? '', word.term, word.reading)
          )
        : null,
    became_mastered: outcome.becameMastered,
    task_completed: taskCompleted,
    answered: answeredCount,
    total,
    task_correct: correctCount,
    current_streak: streak.current_streak,
    new_achievements: newAchievements,
  }
}
