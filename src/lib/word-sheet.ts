/**
 * Excel 匯入／匯出共用的欄位格式：單字、答案、描述、讀音（第四節）。
 * 匯出檔的前 4 欄與匯入相同，可原樣再匯入；第 5 欄發音標註、第 6–7 欄例句與例句翻譯僅供參考，
 * 匯入不讀取（第十三節 2.、5.）。
 */

export const WORD_SHEET_HEADER = ['單字', '答案', '描述', '讀音'] as const

/** 匯出檔：匯入的 4 欄 + 發音標註、例句、例句翻譯（唯讀） */
export const WORD_EXPORT_HEADER = [...WORD_SHEET_HEADER, '發音標註', '例句', '例句翻譯'] as const

export interface SheetWord {
  term: string
  answer: string
  description: string | null
  reading: string | null
}

/** 匯出：一個字 → 一列（前 4 欄） */
export function wordToRow(w: SheetWord): string[] {
  return [w.term, w.answer, w.description ?? '', w.reading ?? '']
}

/** 匯出：前 4 欄同匯入，第 5 欄發音標註，第 6、7 欄例句與例句翻譯 */
export function wordToExportRow(
  w: SheetWord & {
    pronunciation: string | null
    example?: string | null
    example_translation?: string | null
  }
): string[] {
  return [...wordToRow(w), w.pronunciation ?? '', w.example ?? '', w.example_translation ?? '']
}

/** 匯入：sheet_to_json(header: 1) 的列 → 單字；略過表頭與缺少單字或答案的列 */
export function parseWordRows(rows: unknown[]): SheetWord[] {
  const parsed: SheetWord[] = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!Array.isArray(row)) continue
    const [c0, c1, c2, c3] = [0, 1, 2, 3].map((j) => String(row[j] ?? '').trim())
    if (i === 0 && (c0 === WORD_SHEET_HEADER[0] || c0.toLowerCase() === 'term')) continue
    if (!c0 || !c1) continue
    parsed.push({ term: c0, answer: c1, description: c2 || null, reading: c3 || null })
  }
  return parsed
}

/** Excel 工作表名稱最多 31 字，不可含 : \ / ? * [ ]，且不分大小寫不可重複 */
const SHEET_NAME_MAX = 31

/**
 * 依序為每個單字本取不重複的工作表名稱（不同語言可有同名單字本）。
 * 撞名時加上語言，仍撞名再加編號；`taken` 先放入已使用的名稱（如「全部單字」）
 */
export function uniqueSheetNames(
  books: { name: string; languageLabel: string }[],
  taken: string[] = []
): string[] {
  const used = new Set(taken.map((n) => n.toLowerCase()))
  const fit = (base: string, suffix = '') => base.slice(0, SHEET_NAME_MAX - suffix.length) + suffix
  return books.map(({ name, languageLabel }) => {
    const base = name.replace(/[:\/?*[\]]/g, '_').trim() || '單字本'
    let candidate = fit(base)
    if (used.has(candidate.toLowerCase())) candidate = fit(base, ` ${languageLabel}`)
    for (let i = 2; used.has(candidate.toLowerCase()); i++) candidate = fit(base, ` ${languageLabel} ${i}`)
    used.add(candidate.toLowerCase())
    return candidate
  })
}
