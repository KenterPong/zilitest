/**
 * 單字例句（技術規格 v5 第三節 2.、第五節 9.、第六節 5.、第十節 3.）的純邏輯：
 * AI 回傳的伺服器端驗證、英韓依空格切詞塊、挖空與替換、重組判定。
 */
import { katakanaToHiragana } from '@/lib/answer-match'
import type { ExampleChunk, ExampleSource, Language, WordExample } from '@/types/vocab'

/** 例句長度上限（字元），超過時例句欄位全部為 NULL */
export const EXAMPLE_MAX_LENGTH = 200
/** 可用於重組的詞塊數 */
export const REORDER_MIN_CHUNKS = 3
export const REORDER_MAX_CHUNKS = 12
/** 例句選擇題的空格 */
export const CLOZE_BLANK = '＿＿'

// tsconfig 未指定 target，正規表示式的 u 旗標須以建構子寫法
const HAN = new RegExp(String.raw`\p{Script=Han}`, 'u')
/** 只含標點的詞塊（英韓切分時附到前一塊） */
const PUNCT_ONLY = new RegExp(String.raw`^\p{P}+$`, 'u')
/** example_tts 只能有平假名、片假名、長音、空格與標點 */
const TTS_ALLOWED = new RegExp(String.raw`^[\p{Script=Hiragana}\p{Script=Katakana}ー\p{P} 　]+$`, 'u')

/** 詞塊讀音比對時只看漢字與假名（標點、符號、英數字略過） */
const READING_IGNORED = new RegExp(String.raw`[^\p{Script=Han}々\p{Script=Hiragana}\p{Script=Katakana}ー]`, 'gu')
const HAN_OR_ITERATION = new RegExp(String.raw`[\p{Script=Han}々]`, 'u')

/**
 * 日文詞塊讀音是否與詞塊相符：詞塊中的假名（片假名視同平假名）須原樣出現在讀音的對應位置，
 * 每段漢字對應至少一個假名。例如「来ましたか」的讀音「きました」少了「か」→ 不相符。
 * 標點與英數字不比對（讀音省略句末「。」「、」視為相符）
 */
export function isChunkReadingValid(text: string, reading: string): boolean {
  const t = katakanaToHiragana(text.replace(READING_IGNORED, ''))
  const r = katakanaToHiragana(reading.replace(READING_IGNORED, ''))
  if (!t || !r || !/^[ぁ-ゖー]+$/.test(r)) return false
  let pattern = ''
  let inHan = false
  for (const ch of Array.from(t)) {
    if (HAN_OR_ITERATION.test(ch)) {
      if (!inHan) pattern += '[ぁ-ゖー]+'
      inHan = true
    } else {
      pattern += ch === 'ー' ? 'ー' : ch
      inHan = false
    }
  }
  return new RegExp(`^${pattern}$`).test(r)
}

function charLength(s: string): number {
  return Array.from(s).length
}

function normalizeSpaces(s: string): string {
  return s.trim().replace(/\s+/g, ' ')
}

function optionalText(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/** 英韓：依空格切分，只含標點的片段附在前一塊（句首則附在後一塊） */
export function splitBySpaces(example: string): string[] {
  const tokens = normalizeSpaces(example).split(' ').filter(Boolean)
  const chunks: string[] = []
  let pending = ''
  for (const tok of tokens) {
    if (PUNCT_ONLY.test(tok)) {
      if (chunks.length > 0) chunks[chunks.length - 1] += ` ${tok}`
      else pending = pending ? `${pending} ${tok}` : tok
      continue
    }
    chunks.push(pending ? `${pending} ${tok}` : tok)
    pending = ''
  }
  if (pending) chunks.push(pending)
  return chunks
}

function parseChunks(raw: unknown, language: Language): ExampleChunk[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const chunks: ExampleChunk[] = []
  for (const item of raw) {
    const text = typeof item === 'string' ? item : (item as { text?: unknown } | null)?.text
    if (typeof text !== 'string' || !text.trim()) return null
    const chunk: ExampleChunk = { text: language === 'ja' ? text : text.trim() }
    // 讀音只留給日文含漢字的詞塊
    const reading = (item as { reading?: unknown } | null)?.reading
    // 讀音與詞塊的假名對不上時不保留讀音（只影響顯示，詞塊照常使用）
    if (
      language === 'ja' &&
      HAN.test(text) &&
      typeof reading === 'string' &&
      reading.trim() &&
      isChunkReadingValid(text, reading)
    ) {
      chunk.reading = reading.trim()
    }
    chunks.push(chunk)
  }
  return chunks
}

/**
 * AI 回傳例句的伺服器端驗證（第十節 3.）；整組例句不可用時回傳 null（單字本身照常匯入）。
 * - 例句為空、超過 200 字元、example_target 不是例句的子字串 → null
 * - 英韓：詞塊以單一空格串接須與例句（空白正規化後）一致，否則依空格重新切分
 * - 日文：詞塊直接串接須與例句一致，否則 example_chunks 為 null（例句保留）
 * - example_tts 僅日文，含假名、長音、空格、標點以外的字元 → null
 * - example_source 不是 original 時一律視為 generated（標示「AI 例句」）
 */
export function validateExample(
  language: Language,
  raw: {
    example?: unknown
    example_translation?: unknown
    example_source?: unknown
    example_target?: unknown
    example_chunks?: unknown
    example_tts?: unknown
  }
): WordExample | null {
  const example = optionalText(raw.example)
  if (!example || charLength(example) > EXAMPLE_MAX_LENGTH) return null

  const target = typeof raw.example_target === 'string' ? raw.example_target.trim() : ''
  if (!target || !example.includes(target)) return null

  const source: ExampleSource = raw.example_source === 'original' ? 'original' : 'generated'

  let chunks = parseChunks(raw.example_chunks, language)
  if (language === 'ja') {
    if (chunks && chunks.map((c) => c.text).join('') !== example) chunks = null
  } else if (!chunks || chunks.map((c) => c.text).join(' ') !== normalizeSpaces(example)) {
    chunks = splitBySpaces(example).map((text) => ({ text }))
  }

  let tts: string | null = null
  if (language === 'ja') {
    const t = optionalText(raw.example_tts)
    tts = t && TTS_ALLOWED.test(t) ? t : null
  }

  return {
    example,
    example_translation: optionalText(raw.example_translation),
    example_source: source,
    example_target: target,
    example_chunks: chunks,
    example_tts: tts,
  }
}

/** 例句選擇：第一次出現的目標字換成空格；找不到時回傳 null */
export function buildClozeSentence(example: string, target: string): string | null {
  const i = target ? example.indexOf(target) : -1
  if (i < 0) return null
  return example.slice(0, i) + CLOZE_BLANK + example.slice(i + target.length)
}

/** 例句是非（不相符）：第一次出現的目標字換成另一個字的原形；找不到時回傳 null */
export function buildTfSentence(example: string, target: string, replacementTerm: string): string | null {
  const i = target ? example.indexOf(target) : -1
  if (i < 0) return null
  return example.slice(0, i) + replacementTerm + example.slice(i + target.length)
}

/** 詞塊 3–12 塊才可用於重組 */
export function isReorderable(chunks: ExampleChunk[] | null | undefined): chunks is ExampleChunk[] {
  return Array.isArray(chunks) && chunks.length >= REORDER_MIN_CHUNKS && chunks.length <= REORDER_MAX_CHUNKS
}

/** 重組判定：以詞塊文字序列比對，相同文字的詞塊互換仍算正確 */
export function isReorderCorrect(chunkTexts: string[], answerTexts: string[]): boolean {
  return chunkTexts.length === answerTexts.length && chunkTexts.every((t, i) => t === answerTexts[i])
}

/** 標示為原句的例句必須真的出現在使用者原文中（空白正規化後比對），否則改標為 AI 造句 */
export function resolveExampleSource(example: WordExample, sourceText: string): ExampleSource {
  if (example.example_source !== 'original') return 'generated'
  return normalizeSpaces(sourceText).includes(normalizeSpaces(example.example)) ? 'original' : 'generated'
}

/** 顯示用：把例句切成目標字前、目標字（第一次出現）、目標字後；找不到時整句放在 before */
export function splitAtTarget(
  example: string,
  target: string | null | undefined
): { before: string; target: string; after: string } {
  const i = target ? example.indexOf(target) : -1
  if (!target || i < 0) return { before: example, target: '', after: '' }
  return { before: example.slice(0, i), target, after: example.slice(i + target.length) }
}
