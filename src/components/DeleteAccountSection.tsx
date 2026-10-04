'use client'

import { useState } from 'react'

const CONFIRM_TEXT = '刪除'

interface DeleteAccountSectionProps {
  /** 付費中使用者提醒：刪除不會退還本期費用 */
  isPaid: boolean
}

export function DeleteAccountSection({ isPaid }: DeleteAccountSectionProps) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function remove() {
    if (typed.trim() !== CONFIRM_TEXT || deleting) return
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch('/api/users/me', { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? '刪除失敗，請稍後再試')
        setDeleting(false)
        return
      }
      // cookie 已清除，整頁導回首頁
      window.location.href = '/'
    } catch {
      setError('網路錯誤，請稍後再試')
      setDeleting(false)
    }
  }

  return (
    <div className="bg-cream border border-warn-line rounded-lg p-6">
      <h2 className="font-serif font-bold mb-2 text-stamp-red-deep">刪除帳號</h2>
      <ul className="text-sm text-ink-soft list-disc pl-5 space-y-1 mb-4">
        <li>立即清空所有資料：單字本、單字、標籤、學習紀錄、熟練度、成就、連續天數、改善建議與 Email。</li>
        <li>刪除後無法復原；需要的話請先用上方「匯出全部單字本」備份單字。</li>
        <li>
          {isPaid
            ? '剩餘的付費天數不退款、不遞延，刪除後立即失效。'
            : '剩餘的試用天數不保留，刪除後立即失效。'}
        </li>
        <li>之後以同一個 LINE 帳號登入，會視為全新帳號，僅提供一般 30 天試用。</li>
      </ul>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="border border-stamp-red text-stamp-red-deep font-semibold text-sm px-4 py-2 rounded-[5px] hover:bg-warn-bg"
        >
          我要刪除帳號
        </button>
      ) : (
        <div className="border-t border-dashed border-line pt-4">
          <label className="block text-sm mb-2">
            請輸入「<b>{CONFIRM_TEXT}</b>」確認刪除帳號
          </label>
          <div className="flex gap-2 flex-wrap">
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="border border-line rounded-[5px] px-3 py-2 text-sm bg-white w-32 focus:outline-none focus:border-stamp-red"
              aria-label="輸入刪除以確認"
            />
            <button
              type="button"
              disabled={typed.trim() !== CONFIRM_TEXT || deleting}
              onClick={() => void remove()}
              className="bg-stamp-red-deep text-cream font-bold text-sm px-4 py-2 rounded-[5px] disabled:opacity-50"
            >
              {deleting ? '刪除中…' : '永久刪除帳號'}
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => {
                setOpen(false)
                setTyped('')
                setError(null)
              }}
              className="text-sm text-ink-soft underline px-2"
            >
              取消
            </button>
          </div>
          {error && <p className="text-sm text-stamp-red mt-2">{error}</p>}
        </div>
      )}
    </div>
  )
}
