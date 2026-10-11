'use client'

import { useState } from 'react'

import { useAppDialog } from '@/components/AppDialog'
import {
  EXTRACT_LEVELS,
  LEVEL_SYSTEM_NAME,
  levelLabel,
  MAX_INPUT_CHARS,
  type ExtractedWord,
} from '@/lib/extraction'
import { LANGUAGE_LABELS, type Language } from '@/types/vocab'

interface AiExtractButtonProps {
  wordbookId: string
  language: Language
  initialLevel: string | null
  remaining: number
  limit: number
  canMutate: boolean
  /** 試用期剩餘可新增字數；付費為 null */
  remainingSlots: number | null
  onImported: () => Promise<void> | void
}

type Phase = 'level' | 'input' | 'preview'

export function AiExtractButton({
  wordbookId,
  language,
  initialLevel,
  remaining: initialRemaining,
  limit,
  canMutate,
  remainingSlots,
  onImported,
}: AiExtractButtonProps) {
  const { alert } = useAppDialog()
  const [open, setOpen] = useState(false)
  const [level, setLevel] = useState<string | null>(initialLevel)
  const [pickedLevel, setPickedLevel] = useState<string | null>(initialLevel)
  const [phase, setPhase] = useState<Phase>(initialLevel ? 'input' : 'level')
  const [text, setText] = useState('')
  const [words, setWords] = useState<ExtractedWord[]>([])
  const [checked, setChecked] = useState<boolean[]>([])
  const [remaining, setRemaining] = useState(initialRemaining)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const label = LANGUAGE_LABELS[language]
  const selectedCount = checked.filter(Boolean).length

  function openDialog() {
    setError(null)
    setPhase(level ? 'input' : 'level')
    setOpen(true)
  }

  function close() {
    if (busy) return
    setOpen(false)
    setWords([])
    setChecked([])
    setError(null)
  }

  async function saveLevel() {
    if (!pickedLevel) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/language-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, extract_level: pickedLevel }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '儲存失敗')
        return
      }
      setLevel(pickedLevel)
      setPhase('input')
    } catch {
      setError('網路錯誤，請再試一次')
    } finally {
      setBusy(false)
    }
  }

  async function extract() {
    if (!text.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/ai-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordbook_id: wordbookId, text }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '抽字失敗，請稍後再試')
        return
      }
      setRemaining(data.remaining)
      setWords(data.words)
      setChecked(data.words.map(() => true))
      setPhase('preview')
    } catch {
      setError('網路錯誤，請再試一次')
    } finally {
      setBusy(false)
    }
  }

  async function importSelected() {
    const selected = words.filter((_, i) => checked[i])
    if (selected.length === 0 || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/words/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordbook_id: wordbookId, words: selected, truncate_to_limit: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '匯入失敗')
        return
      }
      await onImported()
      setOpen(false)
      setText('')
      setWords([])
      setChecked([])
      await alert(
        `已匯入 ${data.inserted} 個字` + (data.skipped ? `（略過 ${data.skipped} 個，因試用上限）` : ''),
        'AI 抽字完成'
      )
    } catch {
      setError('網路錯誤，請再試一次')
    } finally {
      setBusy(false)
    }
  }

  const overLimit = remainingSlots !== null && selectedCount > remainingSlots

  return (
    <>
      <button
        type="button"
        disabled={!canMutate}
        onClick={openDialog}
        className="border border-line bg-cream text-sm font-medium px-4 py-2 rounded-sm hover:border-ink disabled:opacity-60 disabled:cursor-not-allowed"
      >
        AI 抽字
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div className="bg-cream border border-line rounded-lg p-6 w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="font-serif font-bold text-lg">AI 抽字</h2>
                <p className="text-xs text-ink-soft mt-0.5">
                  {label}
                  {level && ` ・ 等級 ${levelLabel(language, level)}`} ・ 本月剩 {remaining} / {limit} 次
                </p>
              </div>
              <button type="button" onClick={close} className="text-ink-soft hover:text-ink text-xl leading-none" aria-label="關閉">
                ×
              </button>
            </div>

            {phase === 'level' && (
              <div>
                <p className="text-sm mb-3">
                  先選擇你目前的{label}程度（{LEVEL_SYSTEM_NAME[language]}）。AI 只會抽出<b>這個等級</b>
                  的單字，太簡單和太難的都不收；之後每次沿用，可在設定頁修改。
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
                  {EXTRACT_LEVELS[language].map((lv) => (
                    <button
                      key={lv}
                      type="button"
                      onClick={() => setPickedLevel(lv)}
                      className={`py-2 rounded-[5px] border-[1.5px] text-sm bg-white ${
                        pickedLevel === lv ? 'border-stamp-red font-semibold' : 'border-line hover:border-ink'
                      }`}
                    >
                      {levelLabel(language, lv)}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={!pickedLevel || busy}
                  onClick={() => void saveLevel()}
                  className="w-full bg-stamp-red text-cream font-bold py-3 rounded-[5px] text-sm disabled:opacity-60"
                >
                  {busy ? '儲存中…' : '使用這個等級'}
                </button>
              </div>
            )}

            {phase === 'input' && (
              <div className="flex flex-col min-h-0">
                <textarea
                  lang={language}
                  value={text}
                  disabled={busy}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={`貼上一段${label}文章、歌詞或對話…`}
                  className="w-full min-h-[200px] border border-line rounded-[5px] px-3 py-2 text-sm bg-white focus:outline-none focus:border-ink disabled:opacity-60"
                />
                <div className="flex justify-between text-[11.5px] font-mono mt-1 mb-3">
                  <span className="text-ink-soft">原文只送給 AI 分析，處理完即捨棄，不會儲存</span>
                  <span className={text.length > MAX_INPUT_CHARS ? 'text-stamp-red' : 'text-ink-soft'}>
                    {text.length} / {MAX_INPUT_CHARS}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={busy || !text.trim() || text.length > MAX_INPUT_CHARS || remaining <= 0}
                  onClick={() => void extract()}
                  className="w-full bg-stamp-red text-cream font-bold py-3 rounded-[5px] text-sm disabled:opacity-60"
                >
                  {busy ? 'AI 抽字中…（約 10–30 秒）' : remaining <= 0 ? '本月次數已用完' : '開始抽字（使用 1 次）'}
                </button>
              </div>
            )}

            {phase === 'preview' && (
              <div className="flex flex-col min-h-0">
                {words.length === 0 ? (
                  <p className="text-sm text-ink-soft py-6 text-center">
                    這段文字中沒有符合 {level && levelLabel(language, level)} 的新單字。
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-ink-soft mb-2">
                      抽出 {words.length} 個字（已排除你單字本裡已有的字）。等級由 AI 判斷，不需要的字請取消勾選。
                    </p>
                    <div className="overflow-auto border border-line rounded-sm mb-3 flex-1 min-h-0">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-paper-deep font-mono text-[11px] text-ink-soft">
                            <th className="px-3 py-2 w-8">
                              <input
                                type="checkbox"
                                aria-label="全選"
                                checked={selectedCount === words.length}
                                onChange={(e) => setChecked(words.map(() => e.target.checked))}
                              />
                            </th>
                            <th className="text-left px-3 py-2">單字</th>
                            <th className="text-left px-3 py-2">中文</th>
                            <th className="text-left px-3 py-2">說明</th>
                          </tr>
                        </thead>
                        <tbody>
                          {words.map((w, i) => (
                            <tr key={`${w.term}-${i}`} className={`border-t border-line ${checked[i] ? '' : 'opacity-50'}`}>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="checkbox"
                                  aria-label={`匯入 ${w.term}`}
                                  checked={checked[i] ?? false}
                                  onChange={(e) =>
                                    setChecked((prev) => prev.map((c, j) => (j === i ? e.target.checked : c)))
                                  }
                                />
                              </td>
                              <td className="px-3 py-2">
                                <span className="font-serif font-bold">{w.term}</span>
                                {w.reading && <span className="block text-xs text-ink-soft">{w.reading}</span>}
                              </td>
                              <td className="px-3 py-2">{w.answer}</td>
                              <td className="px-3 py-2 text-xs text-ink-soft">{w.description ?? ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {overLimit && (
                      <p className="text-[12.5px] text-stamp-red-deep mb-2">
                        試用期單字上限剩 {remainingSlots} 個，只會匯入前 {remainingSlots} 個勾選的字。
                      </p>
                    )}
                  </>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPhase('input')}
                    disabled={busy}
                    className="border border-line bg-white text-sm px-4 py-2 rounded-sm"
                  >
                    再貼一段
                  </button>
                  {words.length > 0 && (
                    <button
                      type="button"
                      disabled={busy || selectedCount === 0}
                      onClick={() => void importSelected()}
                      className="bg-stamp-red text-cream font-bold text-sm px-4 py-2 rounded-sm disabled:opacity-60"
                    >
                      {busy ? '匯入中…' : `匯入 ${selectedCount} 個字`}
                    </button>
                  )}
                </div>
              </div>
            )}

            {error && <p className="text-sm text-stamp-red mt-3">{error}</p>}
          </div>
        </div>
      )}
    </>
  )
}
