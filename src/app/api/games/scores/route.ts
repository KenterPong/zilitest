import { NextResponse } from 'next/server'

import { assertCanMutate, requireUser } from '@/lib/api-auth'
import { getPersonalBest } from '@/lib/game-service'
import { isGameKey, isNewBest, MATCH_WORD_COUNT } from '@/lib/games'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isLanguage } from '@/types/vocab'

export const runtime = 'nodejs'

/** 配對合理範圍：至少 1 秒、最多 1 小時（排除異常值） */
const MATCH_MIN_MS = 1000
const MATCH_MAX_MS = 60 * 60 * 1000

/** 記錄一局遊戲成績；不寫入熟練度、正確率或連續天數（第十二節 1.） */
export async function POST(request: Request) {
  const auth = await requireUser()
  if (auth.error) return auth.error

  const blocked = assertCanMutate(auth.user)
  if (blocked) return blocked

  let body: { game?: unknown; language?: unknown; word_count?: unknown; score?: unknown; mistakes?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '無效的 JSON' }, { status: 400 })
  }

  const { game, language } = body
  const wordCount = Number(body.word_count)
  const score = Number(body.score)
  const mistakes = Number(body.mistakes ?? 0)
  if (!isGameKey(game) || !isLanguage(language)) {
    return NextResponse.json({ error: '無效的遊戲或語言' }, { status: 400 })
  }
  if (game !== 'match') {
    return NextResponse.json({ error: '這個遊戲尚未開放' }, { status: 400 })
  }
  if (
    wordCount !== MATCH_WORD_COUNT ||
    !Number.isInteger(score) ||
    score < MATCH_MIN_MS ||
    score > MATCH_MAX_MS ||
    !Number.isInteger(mistakes) ||
    mistakes < 0
  ) {
    return NextResponse.json({ error: '成績格式不正確' }, { status: 400 })
  }

  try {
    const previousBest = await getPersonalBest(auth.user.id, game, language, wordCount)
    const { error } = await supabaseAdmin.from('game_scores').insert({
      user_id: auth.user.id,
      game,
      language,
      word_count: wordCount,
      score,
      mistakes,
    })
    if (error) throw new Error(error.message)

    const newBest = isNewBest(game, score, previousBest)
    return NextResponse.json({
      is_new_best: newBest,
      best: newBest ? score : previousBest,
      previous_best: previousBest,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '儲存成績失敗'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
