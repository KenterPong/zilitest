/**
 * Supabase（PostgREST）查詢的兩個限制：
 * 1. 單次回傳最多 1000 筆（max-rows），超過會默默截斷 → fetchAllRows 以 range 分頁
 * 2. `.in()` 的值放在網址上，大量 UUID 會超過網址長度 → chunk 後分批查詢
 */

const PAGE_SIZE = 1000
export const IN_CHUNK_SIZE = 100

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

/** build 須帶穩定排序（例如 order('id')），否則分頁可能重複或遺漏 */
export async function fetchAllRows<T>(build: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    const page = data ?? []
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}

export function chunk<T>(items: T[], size = IN_CHUNK_SIZE): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** 對 ids 分批執行查詢並合併結果 */
export async function fetchByIds<T>(ids: string[], build: (chunkIds: string[]) => PageResult<T>): Promise<T[]> {
  if (ids.length === 0) return []
  const results = await Promise.all(
    chunk(ids).map(async (part) => {
      const { data, error } = await build(part)
      if (error) throw new Error(error.message)
      return data ?? []
    })
  )
  return results.flat()
}
