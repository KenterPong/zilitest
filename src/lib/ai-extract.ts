import 'server-only'

import OpenAI from 'openai'

import {
  buildExtractionPrompt,
  EXTRACTION_SCHEMA,
  monthlyLimit,
  taipeiMonthStartInstant,
} from '@/lib/extraction'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { DbUser } from '@/types/user'
import type { Language } from '@/types/vocab'

export class AiExtractError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message)
  }
}

let _client: OpenAI | null = null

/** OPENAI_API_KEY / OPENAI_MODEL 僅限伺服器端；未設定時功能關閉 */
function getClient(): { client: OpenAI; model: string } {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  const model = process.env.OPENAI_MODEL?.trim()
  if (!apiKey || !model) {
    throw new AiExtractError('AI 抽字尚未開放（伺服器未設定 AI 服務）', 503)
  }
  if (!_client) _client = new OpenAI({ apiKey, timeout: 50_000, maxRetries: 1 })
  return { client: _client, model }
}

export interface ExtractionQuota {
  limit: number
  used: number
  remaining: number
}

/** 本月（台北自然月）已用次數與剩餘次數 */
export async function getExtractionQuota(user: DbUser): Promise<ExtractionQuota> {
  const limit = monthlyLimit(user.status)
  const { count, error } = await supabaseAdmin
    .from('ai_extractions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', taipeiMonthStartInstant(new Date()))
  if (error) throw new Error(error.message)
  const used = count ?? 0
  return { limit, used, remaining: Math.max(0, limit - used) }
}

/**
 * 呼叫 AI 抽字，回傳未清理的原始結果。
 * 原文只送給 AI，不寫入資料庫或應用程式 log（第十節 6.）。
 */
export async function callExtraction(
  language: Language,
  level: string,
  text: string
): Promise<{ term?: unknown; answer?: unknown; description?: unknown; reading?: unknown }[]> {
  const { client, model } = getClient()

  let completion
  try {
    completion = await client.chat.completions.create({
      model,
      max_completion_tokens: 8000,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'vocabulary', strict: true, schema: EXTRACTION_SCHEMA },
      },
      messages: [
        { role: 'system', content: buildExtractionPrompt(language, level) },
        { role: 'user', content: text },
      ],
    })
  } catch (e) {
    if (e instanceof OpenAI.APIError) {
      // 不記錄原文；只回傳狀態給使用者
      const status = e.status === 429 ? 429 : 502
      throw new AiExtractError(
        status === 429 ? 'AI 服務忙碌中，請稍後再試' : 'AI 服務暫時無法使用，請稍後再試',
        status
      )
    }
    throw new AiExtractError('AI 服務連線失敗，請稍後再試', 502)
  }

  const choice = completion.choices[0]
  if (!choice || choice.message.refusal) {
    throw new AiExtractError('AI 無法處理這段文字，請換一段試試', 422)
  }
  if (choice.finish_reason === 'length') {
    throw new AiExtractError('文字中的單字太多，請分段貼上', 422)
  }

  try {
    const parsed = JSON.parse(choice.message.content ?? '') as { words?: unknown }
    return Array.isArray(parsed.words) ? parsed.words : []
  } catch {
    throw new AiExtractError('AI 回傳格式錯誤，請再試一次', 502)
  }
}
