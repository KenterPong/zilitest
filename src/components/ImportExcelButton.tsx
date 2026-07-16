'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import * as XLSX from 'xlsx'

interface ImportExcelButtonProps {
  wordbookId: string
  canMutate: boolean
  remainingSlots: number | null
  onImported?: () => void
}

interface PreviewRow {
  term: string
  answer: string
  description: string | null
}

export function ImportExcelButton({
  wordbookId,
  canMutate,
  remainingSlots,
  onImported,
}: ImportExcelButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [truncate, setTruncate] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  function parseFile(file: File) {
    setError(null)
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const wb = XLSX.read(data, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
          header: 1,
          defval: '',
        })

        const parsed: PreviewRow[] = []
        for (let i = 0; i < json.length; i++) {
          const row = json[i]
          if (!Array.isArray(row)) continue
          const c0 = String(row[0] ?? '').trim()
          const c1 = String(row[1] ?? '').trim()
          const c2 = String(row[2] ?? '').trim()
          // 略過表頭
          if (i === 0 && (c0 === '單字' || c0.toLowerCase() === 'term')) continue
          if (!c0 || !c1) continue
          parsed.push({
            term: c0,
            answer: c1,
            description: c2 || null,
          })
        }
        if (parsed.length === 0) {
          setError('檔案中沒有有效資料（需至少「單字」「答案」兩欄）')
          setRows([])
          return
        }
        setRows(parsed)
        setOpen(true)
      } catch {
        setError('無法解析檔案，請上傳 Excel（.xlsx）或 CSV')
        setRows([])
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function submit() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/words/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wordbook_id: wordbookId,
          words: rows,
          truncate_to_limit: truncate,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '匯入失敗')
        return
      }
      setOpen(false)
      setRows([])
      setFileName(null)
      onImported?.()
      router.refresh()
      alert(
        `已匯入 ${data.inserted} 筆` +
          (data.skipped ? `（略過 ${data.skipped} 筆，因試用上限）` : '')
      )
    } catch {
      setError('網路錯誤')
    } finally {
      setLoading(false)
    }
  }

  const overLimit =
    remainingSlots !== null && rows.length > remainingSlots

  return (
    <>
      <label
        className={`border border-line bg-cream text-sm font-medium px-4 py-2 rounded-sm cursor-pointer ${
          !canMutate ? 'opacity-60 cursor-not-allowed' : 'hover:border-ink'
        }`}
      >
        Excel 匯入
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          disabled={!canMutate}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) parseFile(f)
            e.target.value = ''
          }}
        />
      </label>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div className="bg-cream border border-line rounded-lg p-6 w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col">
            <h2 className="font-serif font-bold text-lg mb-1">匯入預覽</h2>
            <p className="text-xs text-ink-soft mb-3">
              {fileName} ・ 共 {rows.length} 筆
              {remainingSlots !== null && ` ・ 試用剩餘可新增 ${remainingSlots} 字`}
            </p>

            <div className="overflow-auto border border-line rounded-sm mb-3 flex-1 min-h-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-paper-deep font-mono text-[11px] text-ink-soft">
                    <th className="text-left px-3 py-2">單字</th>
                    <th className="text-left px-3 py-2">答案</th>
                    <th className="text-left px-3 py-2">描述</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="px-3 py-2 font-serif font-bold">{r.term}</td>
                      <td className="px-3 py-2">{r.answer}</td>
                      <td className="px-3 py-2 text-ink-soft text-xs">
                        {r.description ?? ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 50 && (
                <p className="text-xs text-ink-soft px-3 py-2">
                  …尚有 {rows.length - 50} 筆未顯示於預覽
                </p>
              )}
            </div>

            {overLimit && (
              <label className="flex items-start gap-2 text-sm mb-3 text-stamp-red-deep">
                <input
                  type="checkbox"
                  checked={truncate}
                  onChange={(e) => setTruncate(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  已超過試用上限。勾選後僅匯入前 {remainingSlots} 筆；取消勾選則整批擋下。
                </span>
              </label>
            )}

            {error && <p className="text-sm text-stamp-red mb-3">{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  setRows([])
                }}
                className="border border-line bg-white text-sm px-4 py-2 rounded-sm"
              >
                取消
              </button>
              <button
                type="button"
                disabled={loading || (overLimit && !truncate)}
                onClick={submit}
                className="bg-ink text-cream text-sm font-medium px-4 py-2 rounded-sm disabled:opacity-60"
              >
                {loading ? '匯入中…' : '確認匯入'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
