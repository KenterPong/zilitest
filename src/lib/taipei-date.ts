/**
 * 台北日期工具（Asia/Taipei，UTC+8，無日光節約）
 * 每日任務、熟練度、連續天數等「日期」一律經由此檔計算，不直接依伺服器時區。
 * 日期以 `YYYY-MM-DD` 字串表示，與 Postgres DATE 欄位經 Supabase 回傳的格式一致。
 */

export type TaipeiDate = string

const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function parseDate(date: TaipeiDate): number {
  if (!DATE_RE.test(date)) throw new Error(`無效的日期格式：${date}`)
  const ms = Date.parse(`${date}T00:00:00.000Z`)
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== date) {
    throw new Error(`無效的日期：${date}`)
  }
  return ms
}

/** 某個時間點對應的台北日期 */
export function toTaipeiDate(instant: Date | string): TaipeiDate {
  const ms = typeof instant === 'string' ? Date.parse(instant) : instant.getTime()
  if (Number.isNaN(ms)) throw new Error(`無效的時間：${String(instant)}`)
  return new Date(ms + TAIPEI_OFFSET_MS).toISOString().slice(0, 10)
}

/** 今天的台北日期 */
export function taipeiToday(now: Date = new Date()): TaipeiDate {
  return toTaipeiDate(now)
}

/** 日期加減天數（n 可為負數） */
export function addDays(date: TaipeiDate, n: number): TaipeiDate {
  return new Date(parseDate(date) + n * DAY_MS).toISOString().slice(0, 10)
}

/** a − b 相差的天數 */
export function diffDays(a: TaipeiDate, b: TaipeiDate): number {
  return Math.round((parseDate(a) - parseDate(b)) / DAY_MS)
}
