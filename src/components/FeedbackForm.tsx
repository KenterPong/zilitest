'use client'

import { useState } from 'react'

import { useAppDialog } from '@/components/AppDialog'
import { FEEDBACK_MAX_LENGTH } from '@/types/user'

export function FeedbackForm() {
  const { alert } = useAppDialog()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = content.trim()
    if (!trimmed) {
      await alert('請輸入改善建議', '無法送出')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        await alert(data.error ?? '送出失敗', '無法送出')
        return
      }
      setContent('')
      await alert('感謝你的建議，我們會認真參考。', '已送出')
    } catch {
      await alert('網路錯誤，請稍後再試', '無法送出')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value.slice(0, FEEDBACK_MAX_LENGTH))}
        placeholder="使用心得、想要的功能、遇到的問題…"
        className="w-full border border-line rounded-sm px-3 py-2 text-sm bg-white min-h-[100px] mb-2 focus:outline-none focus:border-ink"
        maxLength={FEEDBACK_MAX_LENGTH}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] text-ink-soft">
          {content.length} / {FEEDBACK_MAX_LENGTH}
        </span>
        <button
          type="submit"
          disabled={loading || !content.trim()}
          className="bg-ink text-cream font-semibold text-sm px-4 py-2 rounded-sm disabled:opacity-60"
        >
          {loading ? '送出中…' : '送出建議'}
        </button>
      </div>
    </form>
  )
}
