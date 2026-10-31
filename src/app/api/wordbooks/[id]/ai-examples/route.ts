import { NextResponse } from 'next/server'

import { AiExtractError, callExampleGeneration, getExtractionQuota } from '@/lib/ai-extract'
import { assertCanMutate, requireUser } from '@/lib/api-auth'
import { validateExample } from '@/lib/example'
import { signExample, wordScope } from '@/lib/example-sign'
import { isValidLevel, MAX_EXAMPLE_WORDS } from '@/lib/extraction'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { Language, WordExample } from '@/types/vocab'

export const runtime = 'nodejs'
/** AI 回應可能需要十幾秒 */
export const maxDuration = 60

type Ctx = { params: Promise<{ id: string }> }

/**
 * AI 補例句（技術規格 v5 第十節 8.）：為單字本中沒有例句的字（依建立時間，最多 30 個）產生例句預覽。
 * AI 成功回傳即計 1 次（與抽字共用每月次數）；錯誤或逾時不計次。確認後由 apply 寫入。
 */
export async function POST(_request: Request, context: Ctx) {
  const auth = await requireUser()
  if (auth.error) return auth.error

  const blocked = assertCanMutate(auth.user)
  if (blocked) return blocked

  const { id: wordbookId } = await context.params
  const { data: book } = await supabaseAdmin
    .from('wordbooks')
    .select('id, language')
    .eq('id', wordbookId)
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

  const { data: words, error: wordsError } = await supabaseAdmin
    .from('words')
    .select('id, term, reading, answer')
    .eq('wordbook_id', wordbookId)
    .is('example', null)
    .order('created_at', { ascending: true })
    .limit(MAX_EXAMPLE_WORDS)
  if (wordsError) {
    return NextResponse.json({ error: wordsError.message }, { status: 500 })
  }
  if (!words || words.length === 0) {
    return NextResponse.json({ error: '這本單字本的字都已經有例句了' }, { status: 400 })
  }

  try {
    const quota = await getExtractionQuota(auth.user)
    if (quota.remaining <= 0) {
      return NextResponse.json(
        { error: `本月 AI 次數已用完（${quota.limit} 次），下個月 1 日重置` },
        { status: 429 }
      )
    }

    const raw = await callExampleGeneration(
      language,
      level,
      words.map((w, n) => ({ n, term: w.term, reading: w.reading, answer: w.answer }))
    )

    const items: {
      word_id: string
      term: string
      reading: string | null
      answer: string
      example: WordExample
      example_sig: string
    }[] = []
    const done = new Set<number>()
    for (const r of raw) {
      const n = typeof r.n === 'number' ? r.n : -1
      const word = words[n]
      if (!word || done.has(n)) continue
      done.add(n)
      const validated = validateExample(language, r)
      if (!validated) continue
      // 補例句一律為 AI 造句
      const example: WordExample = { ...validated, example_source: 'generated' }
      const sig = signExample(wordScope(auth.user.id, word.id, word.term), example)
      if (!sig) continue
      items.push({ word_id: word.id, term: word.term, reading: word.reading, answer: word.answer, example, example_sig: sig })
    }

    // result_count 先記有效例句數，確認寫入後更新為實際寫入數
    const { data: log, error: logError } = await supabaseAdmin
      .from('ai_extractions')
      .insert({
        user_id: auth.user.id,
        wordbook_id: wordbookId,
        kind: 'generate_examples',
        language,
        level,
        input_length: words.length,
        result_count: items.length,
      })
      .select('id')
      .single()
    if (logError || !log) throw new Error(logError?.message ?? '計次失敗')

    return NextResponse.json({
      extraction_id: log.id,
      requested: words.length,
      items,
      remaining: Math.max(0, quota.remaining - 1),
      limit: quota.limit,
    })
  } catch (e) {
    if (e instanceof AiExtractError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    const msg = e instanceof Error ? e.message : '產生例句失敗'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
