import 'server-only'

import { getLanguageWords } from '@/lib/daily-service'
import {
  buildListenPool,
  canStartListen,
  lowerIsBetter,
  MATCH_WORD_COUNT,
  pickGameWords,
  type GameKey,
  type ListenWord,
  type MatchCardWord,
} from '@/lib/games'
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

/** 聽音辨字題庫；湊不出 4 個彼此不衝突的字時回傳 null 與該語言字數 */
export async function getListenPool(
  userId: string,
  language: Language
): Promise<{ pool: ListenWord[] } | { pool: null; available: number }> {
  const all = await getLanguageWords(userId, language)
  const pool = buildListenPool(all)
  return canStartListen(pool, language) ? { pool } : { pool: null, available: all.length }
}

/** 個人最佳：同遊戲、同語言（配對另需同字數；聽音不看字數） */
export async function getPersonalBest(
  userId: string,
  game: GameKey,
  language: Language,
  wordCount?: number
): Promise<number | null> {
  let query = supabaseAdmin
    .from('game_scores')
    .select('score')
    .eq('user_id', userId)
    .eq('game', game)
    .eq('language', language)
  if (game === 'match') query = query.eq('word_count', wordCount ?? MATCH_WORD_COUNT)
  const { data, error } = await query
    .order('score', { ascending: lowerIsBetter(game) })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data?.score ?? null
}

/** 各語言的個人最佳（遊戲首頁用） */
export async function getGameBests(userId: string, game: GameKey): Promise<Partial<Record<Language, number>>> {
  let query = supabaseAdmin.from('game_scores').select('language, score').eq('user_id', userId).eq('game', game)
  if (game === 'match') query = query.eq('word_count', MATCH_WORD_COUNT)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  const lower = lowerIsBetter(game)
  const best: Partial<Record<Language, number>> = {}
  for (const row of data ?? []) {
    const lang = row.language as Language
    const prev = best[lang]
    if (prev === undefined || (lower ? row.score < prev : row.score > prev)) best[lang] = row.score
  }
  return best
}
