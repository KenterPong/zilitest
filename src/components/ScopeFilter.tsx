'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import type { DbTag, WordbookWithCount } from '@/types/vocab'

interface ScopeFilterProps {
  wordbooks: WordbookWithCount[]
  tags: DbTag[]
  initialWordbookIds?: string[]
  onChange: (wordbookIds: string[], tagIds: string[], poolSize: number) => void
}

export function ScopeFilter({
  wordbooks,
  tags,
  initialWordbookIds = [],
  onChange,
}: ScopeFilterProps) {
  const [wordbookIds, setWordbookIds] = useState<string[]>(initialWordbookIds)
  const [tagIds, setTagIds] = useState<string[]>([])
  const [poolSize, setPoolSize] = useState(0)

  const refreshPool = useCallback(
    async (wbIds: string[], tIds: string[]) => {
      if (wbIds.length === 0) {
        setPoolSize(0)
        onChange(wbIds, tIds, 0)
        return
      }
      try {
        const res = await fetch('/api/words/pool-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wordbook_ids: wbIds, tag_ids: tIds }),
        })
        const data = await res.json()
        const size = data.pool_size ?? 0
        setPoolSize(size)
        onChange(wbIds, tIds, size)
      } catch {
        setPoolSize(0)
        onChange(wbIds, tIds, 0)
      }
    },
    [onChange]
  )

  useEffect(() => {
    void refreshPool(wordbookIds, tagIds)
    // 僅初值與選取變更時；onChange 由父層穩定或接受重複呼叫
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordbookIds, tagIds])

  function toggleWb(id: string) {
    setWordbookIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function toggleTag(id: string) {
    setTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  return (
    <div>
      <div className="mb-6">
        <div className="font-mono text-[11.5px] tracking-wide text-ink-soft mb-2.5">
          單字本（可複選）
        </div>
        <div className="flex gap-2 flex-wrap">
          {wordbooks.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => toggleWb(b.id)}
              className={`font-mono text-xs px-3.5 py-1.5 rounded-full border ${
                wordbookIds.includes(b.id)
                  ? 'bg-ink text-cream border-ink'
                  : 'bg-cream text-ink-soft border-line'
              }`}
            >
              {b.name}
            </button>
          ))}
          {wordbooks.length === 0 && (
            <p className="text-sm text-ink-soft">
              尚無單字本，請先{' '}
              <Link href="/app" className="underline">
                建立單字本
              </Link>
            </p>
          )}
        </div>
      </div>

      <div className="mb-6">
        <div className="font-mono text-[11.5px] tracking-wide text-ink-soft mb-2.5">
          標籤篩選（可複選，不選則不篩選；多選為 AND）
        </div>
        <div className="flex gap-2 flex-wrap">
          {tags.length === 0 && (
            <span className="text-sm text-ink-soft">尚無標籤</span>
          )}
          {tags.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => toggleTag(t.id)}
              className={`font-mono text-xs px-3.5 py-1.5 rounded-full border ${
                tagIds.includes(t.id)
                  ? 'bg-ink text-cream border-ink'
                  : 'bg-cream text-ink-soft border-line'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[12.5px] text-ink-soft mb-2">
        目前篩選條件下符合的單字池共{' '}
        <b className="text-ink font-mono">{poolSize}</b> 個
      </p>
    </div>
  )
}
