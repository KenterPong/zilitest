'use client'

import { useEffect, useRef, useState } from 'react'

import type { DbLanguageSettings } from '@/types/daily'
import type { Language } from '@/types/vocab'

/** 設定頁開關文案（技術規格 v5 第十三節 3.） */
const TOGGLE_LABELS: Record<Language, { title: string; desc: string }> = {
  en: { title: '顯示音標', desc: '英文單字下方顯示 IPA 音標（美式），由系統自動產生' },
  ja: { title: '顯示假名讀音', desc: '日文單字下方顯示你填的讀音；關閉不影響填空題輸入讀音算對' },
  ko: { title: '顯示羅馬拼音', desc: '韓文單字下方顯示羅馬拼音，由系統自動產生' },
}

function ToggleRow({ initial, disabled }: { initial: DbLanguageSettings; disabled: boolean }) {
  const [on, setOn] = useState(initial.show_pronunciation !== false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** 勾選即自動儲存，沒有儲存按鈕；成功後短暫顯示「已儲存」讓使用者知道已生效 */
  const [saved, setSaved] = useState(false)
  const savedTimer = useRef<number | null>(null)
  const label = TOGGLE_LABELS[initial.language]

  useEffect(() => () => {
    if (savedTimer.current) window.clearTimeout(savedTimer.current)
  }, [])

  async function toggle(next: boolean) {
    setOn(next)
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await fetch('/api/language-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: initial.language, show_pronunciation: next }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setOn(!next)
        setError(data.error ?? '儲存失敗')
      } else {
        setSaved(true)
        if (savedTimer.current) window.clearTimeout(savedTimer.current)
        savedTimer.current = window.setTimeout(() => setSaved(false), 2000)
      }
    } catch {
      setOn(!next)
      setError('網路錯誤')
    } finally {
      setSaving(false)
    }
  }

  return (
    <li>
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={on}
          disabled={disabled || saving}
          onChange={(e) => void toggle(e.target.checked)}
          className="mt-1 w-4 h-4 accent-[var(--ink)]"
        />
        <span className="text-sm">
          <span className="font-semibold text-ink">{label.title}</span>
          <span className="ml-2 text-[12px] text-good" aria-live="polite">
            {saving ? <span className="text-ink-soft">儲存中…</span> : saved ? '✓ 已儲存' : ''}
          </span>
          <span className="block text-ink-soft text-[12.5px]">{label.desc}</span>
        </span>
      </label>
      {error && <p className="text-[12.5px] text-stamp-red mt-1 ml-7">{error}</p>}
    </li>
  )
}

/** 設定頁：各語言第二層（音標／讀音／羅馬拼音）顯示開關，存入 user_language_settings */
export function PronunciationToggles({
  settings,
  disabled,
}: {
  settings: DbLanguageSettings[]
  disabled: boolean
}) {
  if (settings.length === 0) return null
  return (
    <ul className="space-y-3 mt-4 pt-4 border-t border-dashed border-line">
      {settings.map((s) => (
        <ToggleRow key={s.language} initial={s} disabled={disabled} />
      ))}
    </ul>
  )
}
