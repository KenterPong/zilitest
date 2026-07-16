'use client'

export function ExportWordsButton() {
  return (
    <a
      href="/api/export/words"
      className="inline-block bg-ink text-cream font-semibold text-sm px-4 py-2 rounded hover:bg-stamp-red-deep"
    >
      匯出全部單字本
    </a>
  )
}
