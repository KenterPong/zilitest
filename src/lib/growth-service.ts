import 'server-only'

import { satisfiedAchievements } from '@/lib/growth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { DbLanguageSettings } from '@/types/daily'
import { isLanguage, type Language } from '@/types/vocab'

export interface LanguageProgressCounts {
  language: Language
  total: number
  mastered: number
  learning: number
  unlearned: number
}

export async function getProgressSummary(userId: string): Promise<LanguageProgressCounts[]> {
  const { data, error } = await supabaseAdmin.rpc('progress_summary', { p_user_id: userId })
  if (error) throw new Error(error.message)
  return ((data ?? []) as LanguageProgressCounts[]).filter((r) => isLanguage(r.language))
}

export async function getLanguageSettings(userId: string): Promise<DbLanguageSettings[]> {
  const { data, error } = await supabaseAdmin
    .from('user_language_settings')
    .select('*')
    .eq('user_id', userId)
    .order('language')
  if (error) throw new Error(error.message)
  return (data ?? []) as DbLanguageSettings[]
}

export async function getUnlockedAchievements(
  userId: string
): Promise<{ achievement_key: string; unlocked_at: string }[]> {
  const { data, error } = await supabaseAdmin
    .from('user_achievements')
    .select('achievement_key, unlocked_at')
    .eq('user_id', userId)
    .order('unlocked_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

/** 單字達到已掌握後：更新歷史最高掌握數（只升不降） */
export async function refreshPeakMastered(userId: string): Promise<void> {
  const { error } = await supabaseAdmin.rpc('refresh_peak_mastered', { p_user_id: userId })
  if (error) throw new Error(error.message)
}

/** 檢查並解鎖成就；回傳本次新解鎖的代碼 */
export async function unlockAchievements(userId: string, currentStreak: number): Promise<string[]> {
  const [summary, unlocked] = await Promise.all([
    getProgressSummary(userId),
    getUnlockedAchievements(userId),
  ])
  const masteredByLanguage: Partial<Record<Language, number>> = {}
  for (const row of summary) masteredByLanguage[row.language] = row.mastered

  const have = new Set(unlocked.map((a) => a.achievement_key))
  const fresh = satisfiedAchievements({ masteredByLanguage, currentStreak }).filter(
    (key) => !have.has(key)
  )
  if (fresh.length === 0) return []

  const { data, error } = await supabaseAdmin
    .from('user_achievements')
    .upsert(
      fresh.map((achievement_key) => ({ user_id: userId, achievement_key })),
      { onConflict: 'user_id,achievement_key', ignoreDuplicates: true }
    )
    .select('achievement_key')
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => r.achievement_key)
}
