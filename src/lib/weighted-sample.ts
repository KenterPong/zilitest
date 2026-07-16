/** Efraimidis–Spirakis 加權隨機抽樣（不放回），取前 n 個 */

export function weightedSampleWithoutReplacement<T>(
  items: T[],
  weightOf: (item: T) => number,
  n: number
): T[] {
  if (items.length === 0 || n <= 0) return []
  const take = Math.min(n, items.length)

  const keyed = items.map((item) => {
    const w = Math.max(weightOf(item), 1e-9)
    const key = Math.pow(Math.random(), 1 / w)
    return { item, key }
  })

  keyed.sort((a, b) => b.key - a.key)
  return keyed.slice(0, take).map((k) => k.item)
}

/** 測驗權重：未測驗視同錯誤率 100%；K 預設 4 */
export function quizWeight(attemptCount: number, correctCount: number, K = 4): number {
  if (attemptCount <= 0) return 1 + K
  const accuracy = correctCount / attemptCount
  return 1 + (1 - accuracy) * K
}

/** 卡牌權重：unknown / 未標記 = 3，known = 1 */
export function cardWeight(familiarity: 'unknown' | 'known' | null): number {
  if (familiarity === 'known') return 1
  return 3
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
