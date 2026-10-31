/**
 * 例句簽章（技術規格 v5 第三節 2.：例句欄位一律由系統寫入）。
 * AI 產生的例句先送到前端預覽，寫入時以 HMAC 驗證內容未被改動；不符時丟棄例句、單字照常寫入。
 * 金鑰 EXAMPLE_SIGNING_SECRET 僅限伺服器端；未設定時不簽章，例句一律不寫入。
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

import type { ExampleChunk, ExampleSource, WordExample } from '@/types/vocab'

function secret(): string | null {
  return process.env.EXAMPLE_SIGNING_SECRET?.trim() || null
}

/** 固定欄位順序，讓前端來回傳遞後仍能重現同一份內容 */
function canonical(scope: string, e: WordExample): string {
  return JSON.stringify([
    scope,
    e.example,
    e.example_translation,
    e.example_source,
    e.example_target,
    e.example_chunks?.map((c) => [c.text, c.reading ?? null]) ?? null,
    e.example_tts,
  ])
}

function hmac(key: string, data: string): string {
  return createHmac('sha256', key).update(data).digest('base64url')
}

/** 簽章範圍：AI 抽字綁定使用者、語言與 term；補例句綁定使用者、單字 id 與 term（term 改過就失效） */
export function extractScope(userId: string, language: string, term: string): string {
  return `extract:${userId}:${language}:${term.trim()}`
}

export function wordScope(userId: string, wordId: string, term: string): string {
  return `word:${userId}:${wordId}:${term.trim()}`
}

/** 未設定金鑰時回傳 null（例句不會被寫入） */
export function signExample(scope: string, example: WordExample): string | null {
  const key = secret()
  return key ? hmac(key, canonical(scope, example)) : null
}

/**
 * 驗證前端送回的例句；通過時回傳整理過的例句，否則回傳 null。
 * 只取已知欄位，型別不符即視為無效
 */
export function verifyExample(scope: string, raw: unknown, sig: unknown): WordExample | null {
  const key = secret()
  if (!key || typeof sig !== 'string' || !raw || typeof raw !== 'object') return null
  const e = parseExample(raw as Record<string, unknown>)
  if (!e) return null
  const expected = Buffer.from(hmac(key, canonical(scope, e)))
  const given = Buffer.from(sig)
  return expected.length === given.length && timingSafeEqual(expected, given) ? e : null
}

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

function parseExample(r: Record<string, unknown>): WordExample | null {
  const example = str(r.example)
  const target = str(r.example_target)
  const source = r.example_source
  if (!example || !target || (source !== 'original' && source !== 'generated')) return null

  let chunks: ExampleChunk[] | null = null
  if (r.example_chunks !== null && r.example_chunks !== undefined) {
    if (!Array.isArray(r.example_chunks)) return null
    chunks = []
    for (const c of r.example_chunks as Record<string, unknown>[]) {
      const text = str(c?.text)
      if (text === null) return null
      const reading = str(c?.reading)
      chunks.push(reading === null ? { text } : { text, reading })
    }
  }

  return {
    example,
    example_translation: str(r.example_translation),
    example_source: source as ExampleSource,
    example_target: target,
    example_chunks: chunks,
    example_tts: str(r.example_tts),
  }
}

/** 寫入 words 的例句欄位；null 表示清空 */
export function exampleColumns(e: WordExample | null, now: string) {
  return {
    example: e?.example ?? null,
    example_translation: e?.example_translation ?? null,
    example_source: e?.example_source ?? null,
    example_target: e?.example_target ?? null,
    example_chunks: e?.example_chunks ?? null,
    example_tts: e?.example_tts ?? null,
    example_updated_at: e ? now : null,
  }
}
