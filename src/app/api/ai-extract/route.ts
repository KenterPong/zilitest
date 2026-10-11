import { NextResponse } from 'next/server'

import { AiExtractError, callExtraction, getExtractionQuota } from '@/lib/ai-extract'
import { assertCanMutate, requireUser } from '@/lib/api-auth'
import { getLanguageWords } from '@/lib/daily-service'
import { cleanExtracted, isValidLevel, MAX_INPUT_CHARS } from '@/lib/extraction'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { Language } from '@/types/vocab'

export const runtime = 'nodejs'
/** AI 回應可能需要十幾秒 */
export const maxDuration = 60

/**
 * AI 抽字：貼上原文 → 依該語言設定的等級抽出單字 → 回傳預覽（尚未寫入單字本）。
 * AI 成功回傳即計 1 次（含 0 個字）；錯誤或逾時不計次。
 */
export async function POST(request: Request) {
  const auth = await requireUser()
  if (auth.error) return auth.error

  const blocked = assertCanMutate(auth.user)
  if (blocked) return blocked

  let body: { wordbook_id?: unknown; text?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '無效的 JSON' }, { status: 400 })
  }

  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text) {
    return NextResponse.json({ error: '請貼上要抽字的文字' }, { status: 400 })
  }
  if (text.length > MAX_INPUT_CHARS) {
    return NextResponse.json(
      { error: `文字長度上限 ${MAX_INPUT_CHARS} 字元，目前 ${text.length} 字元` },
      { status: 400 }
    )
  }

  const { data: book } = await supabaseAdmin
    .from('wordbooks')
    .select('id, language')
    .eq('id', typeof body.wordbook_id === 'string' ? body.wordbook_id : '')
    .eq('user_id', auth.user.id)
    .maybeSingle()
  if (!book) {
    return NextResponse.json({ error: '找不到單字本' }, { status: 404 })
  }
  const language = book.language as Language

  const { data: settings } = await supabaseAdmin
    .from('user_language_settings')
    .select('extract_level')
    .eq('user_id', auth.user.id)
    .eq('language', language)
    .maybeSingle()
  const level = settings?.extract_level
  if (!isValidLevel(language, level)) {
    return NextResponse.json({ error: '請先設定這個語言的抽字等級' }, { status: 400 })
  }

  try {
    const quota = await getExtractionQuota(auth.user)
    if (quota.remaining <= 0) {
      return NextResponse.json(
        { error: `本月 AI 抽字次數已用完（${quota.limit} 次），下個月 1 日重置` },
        { status: 429 }
      )
    }

    const raw = await callExtraction(language, level, text)
    const existing = await getLanguageWords(auth.user.id, language)
    const words = cleanExtracted(
      raw,
      existing.map((w) => w.term)
    )

    const { error: logError } = await supabaseAdmin.from('ai_extractions').insert({
      user_id: auth.user.id,
      wordbook_id: book.id,
      language,
      level,
      input_length: text.length,
      result_count: words.length,
    })
    if (logError) throw new Error(logError.message)

    return NextResponse.json({
      level,
      words,
      remaining: Math.max(0, quota.remaining - 1),
      limit: quota.limit,
    })
  } catch (e) {
    if (e instanceof AiExtractError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    const msg = e instanceof Error ? e.message : '抽字失敗'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
