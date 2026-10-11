import { NextResponse } from 'next/server'

import { assertCanMutate, requireUser } from '@/lib/api-auth'
import { getMatchRound } from '@/lib/game-service'
import { MATCH_WORD_COUNT } from '@/lib/games'
import { isLanguage } from '@/types/vocab'

export const runtime = 'nodejs'

/** 配對消除：抽一局的字（第十二節 3.） */
export async function GET(request: Request) {
  const auth = await requireUser()
  if (auth.error) return auth.error

  const blocked = assertCanMutate(auth.user)
  if (blocked) return blocked

  const language = new URL(request.url).searchParams.get('language')
  if (!isLanguage(language)) {
    return NextResponse.json({ error: '無效的語言' }, { status: 400 })
  }

  const round = await getMatchRound(auth.user.id, language)
  if (!round.words) {
    return NextResponse.json(
      {
        error: `這個語言至少需要 ${MATCH_WORD_COUNT} 個意思不同的單字才能玩配對（目前 ${round.available} 個）`,
      },
      { status: 400 }
    )
  }
  return NextResponse.json({ words: round.words })
}
