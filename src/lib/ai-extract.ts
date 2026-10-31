import 'server-only'

import OpenAI from 'openai'

import {
  buildExampleGenerationPrompt,
  buildExtractionPrompt,
  buildTranscriptionPrompt,
  EXAMPLE_GENERATION_SCHEMA,
  EXTRACTION_SCHEMA,
  expandSentenceRefs,
  generatedToRaw,
  monthlyLimit,
  taipeiMonthStartInstant,
  TRANSCRIPTION_SCHEMA,
  type RawExtractedWord,
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
  // 逾時須短於 API route 的 maxDuration（120 秒）；逾時後重試必定超過時限、只會多計費，因此不重試
  if (!_client) _client = new OpenAI({ apiKey, timeout: 110_000, maxRetries: 0 })
  return { client: _client, model }
}

export interface ExtractionQuota {
  limit: number
  used: number
  remaining: number
}

function toAiError(e: unknown): AiExtractError {
  if (e instanceof OpenAI.APIConnectionTimeoutError) {
    return new AiExtractError('AI 處理時間過長，請減少內容後再試', 504)
  }
  if (e instanceof OpenAI.APIError) {
    // 不記錄原文或圖片；只回傳狀態給使用者
    const status = e.status === 429 ? 429 : 502
    return new AiExtractError(
      status === 429 ? 'AI 服務忙碌中，請稍後再試' : 'AI 服務暫時無法使用，請稍後再試',
      status
    )
  }
  return new AiExtractError('AI 服務連線失敗，請稍後再試', 502)
}

/** 本機開發時記錄 token 用量（只記數字，不記原文或結果），用來評估例句增加的成本 */
function logUsage(kind: string, usage: OpenAI.CompletionUsage | undefined) {
  if (process.env.NODE_ENV !== 'development' || !usage) return
  console.info(`[ai-usage] ${kind} prompt=${usage.prompt_tokens} completion=${usage.completion_tokens}`)
}

/** 本月（台北自然月）已用次數與剩餘次數（抽字與圖片轉文字共用） */
export async function getExtractionQuota(user: DbUser): Promise<ExtractionQuota> {
  const limit = monthlyLimit(user.status, user.id)
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
): Promise<RawExtractedWord[]> {
  const { client, model } = getClient()

  let completion
  try {
    completion = await client.chat.completions.create({
      model,
      // 不讓 OpenAI 儲存請求與回應（第十節 6.）
      store: false,
      // 含例句句子表，輸出量較大
      max_completion_tokens: 16000,
      // 預設推理在日文常超過 60 秒時限，改用低推理
      reasoning_effort: 'low',
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
    throw toAiError(e)
  }

  const choice = completion.choices[0]
  if (!choice || choice.message.refusal) {
    throw new AiExtractError('AI 無法處理這段文字，請換一段試試', 422)
  }
  if (choice.finish_reason === 'length') {
    throw new AiExtractError('文字中的單字太多，請分段貼上', 422)
  }
  logUsage('extract', completion.usage)

  try {
    // 句子表展開成每個字各自的例句欄位
    return expandSentenceRefs(JSON.parse(choice.message.content ?? '') as { words?: unknown; sentences?: unknown })
  } catch {
    throw new AiExtractError('AI 回傳格式錯誤，請再試一次', 502)
  }
}

/**
 * AI 補例句（第十節 8.）：依單字與中文意思造句，回傳未清理的原始結果（n 為送出時的索引）
 */
export async function callExampleGeneration(
  language: Language,
  level: string,
  words: { n: number; term: string; reading: string | null; answer: string }[]
): Promise<(RawExtractedWord & { n?: unknown })[]> {
  const { client, model } = getClient()

  let completion
  try {
    completion = await client.chat.completions.create({
      model,
      // 不讓 OpenAI 儲存請求與回應（第十節 6.）
      store: false,
      max_completion_tokens: 16000,
      reasoning_effort: 'low',
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'examples', strict: true, schema: EXAMPLE_GENERATION_SCHEMA },
      },
      messages: [
        { role: 'system', content: buildExampleGenerationPrompt(language, level) },
        { role: 'user', content: JSON.stringify(words) },
      ],
    })
  } catch (e) {
    throw toAiError(e)
  }

  const choice = completion.choices[0]
  if (!choice || choice.message.refusal) {
    throw new AiExtractError('AI 無法處理這些單字，請稍後再試', 422)
  }
  if (choice.finish_reason === 'length') {
    throw new AiExtractError('AI 回應過長，請稍後再試', 422)
  }
  logUsage('generate_examples', completion.usage)

  try {
    const parsed = JSON.parse(choice.message.content ?? '') as { examples?: unknown }
    return Array.isArray(parsed.examples) ? parsed.examples.map(generatedToRaw) : []
  } catch {
    throw new AiExtractError('AI 回傳格式錯誤，請再試一次', 502)
  }
}

/**
 * 圖片轉文字：把圖片中的該語言文字照原文轉錄（第十節 7.）。
 * 圖片只送給 AI，不寫入資料庫、儲存空間或應用程式 log。
 */
export async function callImageTranscription(language: Language, imageDataUrls: string[]): Promise<string> {
  const { client, model } = getClient()

  let completion
  try {
    completion = await client.chat.completions.create({
      model,
      // 不讓 OpenAI 儲存請求與回應（第十節 6.）
      store: false,
      max_completion_tokens: 4000,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'transcription', strict: true, schema: TRANSCRIPTION_SCHEMA },
      },
      messages: [
        { role: 'system', content: buildTranscriptionPrompt(language) },
        {
          role: 'user',
          content: imageDataUrls.map((url) => ({ type: 'image_url' as const, image_url: { url, detail: 'high' as const } })),
        },
      ],
    })
  } catch (e) {
    throw toAiError(e)
  }

  const choice = completion.choices[0]
  if (!choice || choice.message.refusal) {
    throw new AiExtractError('AI 無法處理這張圖片，請換一張試試', 422)
  }
  if (choice.finish_reason === 'length') {
    throw new AiExtractError('圖片中的文字太多，請裁切成小塊再上傳', 422)
  }

  try {
    const parsed = JSON.parse(choice.message.content ?? '') as { text?: unknown }
    return typeof parsed.text === 'string' ? parsed.text.trim() : ''
  } catch {
    throw new AiExtractError('AI 回傳格式錯誤，請再試一次', 502)
  }
}
