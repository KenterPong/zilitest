/**
 * 重組練習（技術規格 v5 第六節 5.）的純邏輯：出題範圍、詞塊打散、填入判定。
 * 默組的出題順序與重出佇列沿用書寫練習（writing.ts 的 buildRecallOrder / RecallQueue）。
 */
import { isChunkReadingValid, isReorderable, isReorderCorrect } from '@/lib/example'
import { shuffleTiles } from '@/lib/spell'
import type { ExampleChunk } from '@/types/vocab'

/** 一輪最多句數 */
export const REORDER_ROUND_SIZE = 10
/** 跟組（與答錯後再排）通過後停留時間 */
export const REORDER_PASS_MS = 500
/** 默組答對後停留時間 */
export const REORDER_CORRECT_MS = 800
/** 排錯時空格標示錯誤的時間，之後詞塊全部退回 */
export const REORDER_WRONG_FLASH_MS = 500

export interface ReorderSource {
  example?: string | null
  example_chunks?: ExampleChunk[] | null
}

/** 有例句且詞塊 3–12 塊才出題 */
export function isReorderUsable(w: ReorderSource): boolean {
  return !!w.example?.trim() && isReorderable(w.example_chunks)
}

/** 依傳入順序（已是熟悉度加權順序）取可用的前 size 句 */
export function pickReorderCards<T extends ReorderSource>(cards: T[], size = REORDER_ROUND_SIZE): T[] {
  return cards.filter(isReorderUsable).slice(0, size)
}

/**
 * 沒有可用句子時的原因：
 * no_example＝範圍內都沒有例句（可用 AI 補例句）；
 * not_reorderable＝有例句但詞塊不符 3–12 塊（AI 補例句不會覆蓋已有例句，引導無效）
 */
export function reorderUnavailableReason(cards: ReorderSource[]): 'no_example' | 'not_reorderable' {
  return cards.some((c) => !!c.example?.trim()) ? 'not_reorderable' : 'no_example'
}

function validReading(c: ExampleChunk): string | undefined {
  return c.reading && isChunkReadingValid(c.text, c.reading) ? c.reading : undefined
}

export interface ReorderTile {
  id: number
  text: string
  reading?: string
}

/**
 * 打散詞塊；剛好排回原順序時重新打散（最多 20 次，同拼字挑戰）。
 * 已存的讀音與詞塊對不上時不顯示（驗證加入前寫入的例句）
 */
export function shuffleChunks(chunks: ExampleChunk[], random: () => number = Math.random): ReorderTile[] {
  const texts = chunks.map((c) => c.text)
  return shuffleTiles(texts, texts, random).map((t) => ({
    id: t.id,
    text: t.char,
    reading: validReading(chunks[t.id]!),
  }))
}

/** 已全部填入時判定：文字序列與原句一致（相同文字的詞塊互換仍算正確） */
export function isReorderFilledCorrect(filled: ReorderTile[], chunks: ExampleChunk[]): boolean {
  return isReorderCorrect(
    chunks.map((c) => c.text),
    filled.map((t) => t.text)
  )
}
