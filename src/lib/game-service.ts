import 'server-only'

import { getLanguageWords } from '@/lib/daily-service'
import { lowerIsBetter, MATCH_WORD_COUNT, pickGameWords, type GameKey, type MatchCardWord } from '@/lib/games'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { Language } from '@/types/vocab'

/** 抽一局配對的字；不足時回傳該語言字數供提示 */
export async function getMatchRound(
  userId: string,
  language: Language
): Promise<{ words: MatchCardWord[] } | { words: null; available: number }> {
  const all = await getLanguageWords(userId, language)
  const words = pickGameWords(all, MATCH_WORD_COUNT)
  return words ? { words } : { words: null, available: all.length }
}

/** 個人最佳：同遊戲、同語言（配對另需同字數） */
export async function getPersonalBest(
  userId: string,
  game: GameKey,
  language: Language,
  wordCount: number
): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from('game_scores')
    .select('score')
    .eq('user_id', userId)
    .eq('game', game)
    .eq('language', language)
    .eq('word_count', wordCount)
    .order('score', { ascending: lowerIsBetter(game) })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data?.score ?? null
}

/** 各語言的配對個人最佳（遊戲首頁用） */
export async function getMatchBests(userId: string): Promise<Partial<Record<Language, number>>> {
  const { data, error } = await supabaseAdmin
    .from('game_scores')
    .select('language, score')
    .eq('user_id', userId)
    .eq('game', 'match')
    .eq('word_count', MATCH_WORD_COUNT)
  if (error) throw new Error(error.message)
  const best: Partial<Record<Language, number>> = {}
  for (const row of data ?? []) {
    const lang = row.language as Language
    if (best[lang] === undefined || row.score < best[lang]!) best[lang] = row.score
  }
  return best
}
