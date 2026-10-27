import { NextResponse } from 'next/server'

import { AiExtractError, callImageTranscription, getExtractionQuota } from '@/lib/ai-extract'
import { assertCanMutate, requireUser } from '@/lib/api-auth'
import { isValidLevel, validateImages } from '@/lib/extraction'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { Language } from '@/types/vocab'

export const runtime = 'nodejs'
/** AI 回應可能需要十幾秒 */
export const maxDuration = 60

/**
 * 圖片轉文字：一次上傳 1–2 張圖片 → 依序轉錄成該單字本語言的文字，回傳給前端填入抽字文字框。
 * 與 AI 抽字共用每月次數，AI 成功回傳即計 1 次（含沒有辨識到文字）；錯誤或逾時不計次。
 * 圖片不寫入資料庫、儲存空間或 log。
 */
export async function POST(request: Request) {
  const auth = await requireUser()
  if (auth.error) return auth.error

  const blocked = assertCanMutate(auth.user)
  if (blocked) return blocked

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: '無效的上傳資料' }, { status: 400 })
  }

  const images = form.getAll('image').filter((v): v is File => v instanceof File)
  const invalid = validateImages(images)
  if (invalid) {
    return NextResponse.json({ error: invalid }, { status: 400 })
  }

  const wordbookId = form.get('wordbook_id')
  const { data: book } = await supabaseAdmin
    .from('wordbooks')
    .select('id, language')
    .eq('id', typeof wordbookId === 'string' ? wordbookId : '')
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

    const dataUrls = await Promise.all(
      images.map(async (img) => `data:${img.type};base64,${Buffer.from(await img.arrayBuffer()).toString('base64')}`)
    )
    const text = await callImageTranscription(language, dataUrls)

    const { error: logError } = await supabaseAdmin.from('ai_extractions').insert({
      user_id: auth.user.id,
      wordbook_id: book.id,
      kind: 'transcribe_image',
      language,
      level,
      input_length: images.reduce((sum, img) => sum + img.size, 0),
      result_count: text.length,
    })
    if (logError) throw new Error(logError.message)

    return NextResponse.json({
      text,
      remaining: Math.max(0, quota.remaining - 1),
      limit: quota.limit,
    })
  } catch (e) {
    if (e instanceof AiExtractError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    const msg = e instanceof Error ? e.message : '圖片轉文字失敗'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
