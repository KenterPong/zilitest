/**
 * 背誦、自由練習記住上次的篩選與模式（只存在這台裝置，localStorage）。
 * 純函式負責解析與過濾；讀寫 localStorage 失敗（無痕模式等）時視為沒有記錄。
 */

export const CARDS_SCOPE_KEY = 'zilitest:scope:cards'
export const QUIZ_SCOPE_KEY = 'zilitest:scope:quiz'

export interface ScopeMemory {
  wordbookIds: string[]
  tagIds: string[]
  /** 頁面自己的設定（背誦方式、題型、題數）；未驗證，由各頁自行檢查 */
  extra: Record<string, unknown>
}

function stringList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

/**
 * 解析記錄並去掉已不存在的單字本與標籤。
 * 網址帶入單字本（從單字本頁點進來）時以網址為準，不套用記住的範圍，只沿用頁面設定
 */
export function parseScopeMemory(
  raw: string | null,
  valid: { wordbookIds: Iterable<string>; tagIds: Iterable<string> },
  urlWordbookId?: string
): ScopeMemory {
  let data: Record<string, unknown> = {}
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed as Record<string, unknown>
    } catch {
      // 格式損壞時視為沒有記錄
    }
  }
  const { wordbookIds: rawWb, tagIds: rawTags, ...extra } = data
  if (urlWordbookId) return { wordbookIds: [urlWordbookId], tagIds: [], extra }

  const wbSet = new Set(valid.wordbookIds)
  const tagSet = new Set(valid.tagIds)
  return {
    wordbookIds: stringList(rawWb).filter((id) => wbSet.has(id)),
    tagIds: stringList(rawTags).filter((id) => tagSet.has(id)),
    extra,
  }
}

export function serializeScopeMemory(m: ScopeMemory): string {
  return JSON.stringify({ ...m.extra, wordbookIds: m.wordbookIds, tagIds: m.tagIds })
}

export function readScopeMemory(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeScopeMemory(key: string, m: ScopeMemory): void {
  try {
    window.localStorage.setItem(key, serializeScopeMemory(m))
  } catch {
    // 無痕模式等情況無法儲存，只影響下次進來
  }
}
