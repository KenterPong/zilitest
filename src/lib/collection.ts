/**
 * 單字卡冊：把各語言的單字依熟練度整理成收藏卡。
 * 已掌握（stage ≥ 4）為收藏卡，依 stage 分四個等級；學習中（stage 1–3）另列；未學習只計數。
 */

import { MASTERED_STAGE } from '@/lib/progress'

export interface CollectionTier {
  stage: number
  name: string
}

/** 已掌握卡的等級：stage 4–7 */
export const COLLECTION_TIERS: CollectionTier[] = [
  { stage: 4, name: '掌握' },
  { stage: 5, name: '熟練' },
  { stage: 6, name: '精通' },
  { stage: 7, name: '滿級' },
]

export function tierFor(stage: number): CollectionTier | null {
  if (stage < MASTERED_STAGE) return null
  return COLLECTION_TIERS.find((t) => t.stage === Math.min(stage, 7)) ?? null
}

export interface CollectionWord {
  id: string
  term: string
  reading: string | null
  pronunciation?: string | null
  answer: string
  stage: number
  mastered_at: string | null
  created_at: string
}

export interface Collection {
  /** 已掌握：stage 高的在前，同 stage 依最近掌握在前 */
  mastered: CollectionWord[]
  /** 學習中：stage 高的在前（最接近掌握），同 stage 依建立順序 */
  learning: CollectionWord[]
  unlearnedCount: number
  total: number
  /** 各等級張數（stage 4–7） */
  tierCounts: Record<number, number>
}

export function buildCollection(words: CollectionWord[]): Collection {
  const mastered: CollectionWord[] = []
  const learning: CollectionWord[] = []
  let unlearnedCount = 0
  const tierCounts: Record<number, number> = { 4: 0, 5: 0, 6: 0, 7: 0 }

  for (const w of words) {
    if (w.stage >= MASTERED_STAGE) {
      mastered.push(w)
      tierCounts[Math.min(w.stage, 7)] += 1
    } else if (w.stage >= 1) {
      learning.push(w)
    } else {
      unlearnedCount += 1
    }
  }

  mastered.sort((a, b) => {
    if (a.stage !== b.stage) return b.stage - a.stage
    return (b.mastered_at ?? '').localeCompare(a.mastered_at ?? '')
  })
  learning.sort((a, b) => {
    if (a.stage !== b.stage) return b.stage - a.stage
    return a.created_at.localeCompare(b.created_at)
  })

  return { mastered, learning, unlearnedCount, total: words.length, tierCounts }
}
