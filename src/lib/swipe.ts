/**
 * 卡牌背誦滑卡判定：右滑「認得」、左滑「不認得」。
 * 拖曳距離超過門檻才算數，否則卡片彈回；幾乎沒移動視為點擊（翻面）。
 */

export type SwipeChoice = 'known' | 'unknown'

/** 判定門檻：卡片寬度的 25%，至少 80px */
export function swipeThreshold(cardWidth: number): number {
  return Math.max(80, cardWidth * 0.25)
}

/** 放開時的結果：超過門檻回傳方向，否則 null（彈回） */
export function swipeDecision(dx: number, cardWidth: number): SwipeChoice | null {
  const t = swipeThreshold(cardWidth)
  if (dx >= t) return 'known'
  if (dx <= -t) return 'unknown'
  return null
}

/** 移動不到這個距離視為點擊 */
export const TAP_SLOP_PX = 6

export function isTap(dx: number, dy: number): boolean {
  return Math.abs(dx) < TAP_SLOP_PX && Math.abs(dy) < TAP_SLOP_PX
}

/** 拖曳中提示標籤的透明度（0–1），達門檻時為 1 */
export function swipeHintOpacity(dx: number, cardWidth: number): number {
  return Math.min(1, Math.abs(dx) / swipeThreshold(cardWidth))
}
