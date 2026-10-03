'use client'

import { useState } from 'react'

import type { DbLanguageSettings } from '@/types/daily'
import { LANGUAGE_LABELS } from '@/types/vocab'

interface LanguageSettingsFormProps {
  settings: DbLanguageSettings[]
  disabled: boolean
}

function LanguageRow({ initial, disabled }: { initial: DbLanguageSettings; disabled: boolean }) {
  const [enabled, setEnabled] = useState(initial.enabled)
  const [review, setReview] = useState(String(initial.daily_review_limit))
  const [fresh, setFresh] = useState(String(initial.daily_new_limit))
  const [saved, setSaved] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const dirty =
    enabled !== saved.enabled ||
    review !== String(saved.daily_review_limit) ||
    fresh !== String(saved.daily_new_limit)

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/language-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: initial.language,
          enabled,
          daily_review_limit: Number(review),
          daily_new_limit: Number(fresh),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? '儲存失敗' })
        return
      }
      setSaved(data.settings)
      setMessage({ ok: true, text: '已儲存，自明天的任務起生效' })
    } catch {
      setMessage({ ok: false, text: '網路錯誤' })
    } finally {
      setSaving(false)
    }
  }

  const numberInput =
    'w-20 font-mono border border-line rounded-[5px] px-2.5 py-1.5 bg-white text-sm focus:outline-none focus:border-ink disabled:opacity-60'

  return (
    <li className="py-4 border-b border-dashed border-line last:border-0">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            disabled={disabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-4 h-4 accent-[var(--ink)]"
          />
          <span className="font-serif font-bold">{LANGUAGE_LABELS[initial.language]}</span>
          <span className="text-[12.5px] text-ink-soft">產生每日任務</span>
        </label>
        <div className="flex items-center gap-4 flex-wrap text-[12.5px] text-ink-soft">
          <label className="flex items-center gap-2">
            每日複習上限
            <input
              type="number"
              min={0}
              max={200}
              inputMode="numeric"
              value={review}
              disabled={disabled || !enabled}
              onChange={(e) => setReview(e.target.value)}
              className={numberInput}
            />
          </label>
          <label className="flex items-center gap-2">
            每日新字
            <input
              type="number"
              min={0}
              max={200}
              inputMode="numeric"
              value={fresh}
              disabled={disabled || !enabled}
              onChange={(e) => setFresh(e.target.value)}
              className={numberInput}
            />
          </label>
          <button
            type="button"
            disabled={disabled || !dirty || saving}
            onClick={() => void save()}
            className="bg-ink text-cream font-semibold text-sm px-4 py-1.5 rounded-[5px] disabled:opacity-50"
          >
            {saving ? '儲存中…' : '儲存'}
          </button>
        </div>
      </div>
      {message && (
        <p className={`text-[12.5px] mt-2 ${message.ok ? 'text-good' : 'text-stamp-red'}`}>
          {message.text}
        </p>
      )}
    </li>
  )
}

export function LanguageSettingsForm({ settings, disabled }: LanguageSettingsFormProps) {
  if (settings.length === 0) {
    return <p className="text-sm text-ink-soft">建立單字本後，即可設定該語言的每日任務量。</p>
  }
  return (
    <ul>
      {settings.map((s) => (
        <LanguageRow key={s.language} initial={s} disabled={disabled} />
      ))}
    </ul>
  )
}
