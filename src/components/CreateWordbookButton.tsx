'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface CreateWordbookButtonProps {
  disabled?: boolean
  variant?: 'primary' | 'dashed'
}

export function CreateWordbookButton({
  disabled,
  variant = 'primary',
}: CreateWordbookButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/wordbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '建立失敗')
        return
      }
      setOpen(false)
      setName('')
      router.push(`/app/wordbooks/${data.wordbook.id}`)
      router.refresh()
    } catch {
      setError('網路錯誤，請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  const triggerClass =
    variant === 'dashed'
      ? 'min-h-[150px] w-full border border-dashed border-line rounded-md flex items-center justify-center text-ink-soft text-sm font-medium hover:border-ink hover:text-ink transition-colors disabled:opacity-60'
      : 'bg-ink text-cream text-sm font-medium px-4 py-2 rounded-sm hover:bg-stamp-red-deep disabled:opacity-60 disabled:cursor-not-allowed transition-colors'

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={triggerClass}
      >
        {variant === 'dashed' ? '+ 建立新的單字本' : '+ 新增單字本'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <form
            onSubmit={submit}
            className="bg-cream border border-line rounded-lg p-6 w-full max-w-md shadow-xl"
          >
            <h2 className="font-serif font-bold text-lg mb-4">新增單字本</h2>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：TOEIC 核心 2000"
              className="w-full border border-line rounded-sm px-3 py-2 text-sm bg-white mb-3 focus:outline-none focus:border-ink"
              maxLength={80}
            />
            {error && <p className="text-sm text-stamp-red mb-3">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  setError(null)
                }}
                className="border border-line bg-white text-sm px-4 py-2 rounded-sm"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="bg-ink text-cream text-sm font-medium px-4 py-2 rounded-sm disabled:opacity-60"
              >
                {loading ? '建立中…' : '建立'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
