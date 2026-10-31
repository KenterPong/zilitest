'use client'

import { useRef, useState } from 'react'

import { ExtractingIndicator } from '@/components/AiExtractButton'
import { useAppDialog } from '@/components/AppDialog'
import { MAX_EXAMPLE_WORDS } from '@/lib/extraction'
import type { Language, WordExample } from '@/types/vocab'

interface AiExamplesButtonProps {
  wordbookId: string
  language: Language
  /** 該語言的抽字等級；未設定時不能使用 */
  level: string | null
  /** 本月 AI 剩餘次數（抽字與補例句共用，由單字本頁統一保存） */
  remaining: number
  onRemainingChange: (remaining: number) => void
  limit: number
  canMutate: boolean
  /** 單字本中沒有例句的字數 */
  missingCount: number
  /** 單字本是否有單字（空的單字本不顯示「都已有例句」） */
  hasWords: boolean
  onApplied: () => Promise<void> | void
}

interface PreviewItem {
  word_id: string
  term: string
  reading: string | null
  answer: string
  example: WordExample
  example_sig: string
}

type Phase = 'confirm' | 'preview'

/** AI 補例句（技術規格 v5 第十節 8.）：為沒有例句的字產生例句，預覽勾選後寫入 */
export function AiExamplesButton({
  wordbookId,
  language,
  level,
  remaining,
  onRemainingChange,
  limit,
  canMutate,
  missingCount,
  hasWords,
  onApplied,
}: AiExamplesButtonProps) {
  const { alert } = useAppDialog()
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('confirm')
  const [extractionId, setExtractionId] = useState<string | null>(null)
  const [requested, setRequested] = useState(0)
  const [items, setItems] = useState<PreviewItem[]>([])
  const [checked, setChecked] = useState<boolean[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** 同步送出鎖，避免連點重複扣次 */
  const inFlight = useRef(false)

  function lock(): boolean {
    if (inFlight.current) return false
    inFlight.current = true
    setBusy(true)
    return true
  }

  function unlock() {
    inFlight.current = false
    setBusy(false)
  }

  const batchSize = Math.min(missingCount, MAX_EXAMPLE_WORDS)
  const selectedCount = checked.filter(Boolean).length

  function openDialog() {
    setError(null)
    setPhase('confirm')
    setOpen(true)
  }

  function close() {
    if (busy) return
    setOpen(false)
    setItems([])
    setChecked([])
  }

  async function generate() {
    if (!lock()) return
    setError(null)
    try {
      const res = await fetch(`/api/wordbooks/${wordbookId}/ai-examples`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '產生例句失敗，請稍後再試')
        return
      }
      onRemainingChange(data.remaining)
      setExtractionId(data.extraction_id)
      setRequested(data.requested)
      setItems(data.items)
      setChecked(data.items.map(() => true))
      setPhase('preview')
    } catch {
      setError('網路錯誤，請再試一次')
    } finally {
      unlock()
    }
  }

  async function apply() {
    const selected = items.filter((_, i) => checked[i])
    if (selected.length === 0 || !lock()) return
    setError(null)
    try {
      const res = await fetch(`/api/wordbooks/${wordbookId}/ai-examples/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extraction_id: extractionId,
          items: selected.map(({ word_id, example, example_sig }) => ({ word_id, example, example_sig })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '寫入失敗')
        return
      }
      await onApplied()
      setOpen(false)
      setItems([])
      setChecked([])
      await alert(`已為 ${data.written} 個字加上例句`, 'AI 補例句完成')
    } catch {
      setError('網路錯誤，請再試一次')
    } finally {
      unlock()
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={!canMutate || missingCount === 0}
        title={missingCount === 0 ? (hasWords ? '所有單字都已有例句' : '單字本還沒有單字') : undefined}
        onClick={openDialog}
        className="border border-line bg-cream text-sm font-medium px-4 py-2 rounded-sm hover:border-ink disabled:opacity-60 disabled:cursor-not-allowed"
      >
        AI 補例句
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div className="bg-cream border border-line rounded-lg p-6 w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="font-serif font-bold text-lg">AI 補例句</h2>
                <p className="text-xs text-ink-soft mt-0.5">
                  本月 AI 次數剩 {remaining} / {limit} 次（與 AI 抽字共用）
                </p>
              </div>
              <button type="button" onClick={close} className="text-ink-soft hover:text-ink text-xl leading-none" aria-label="關閉">
                ×
              </button>
            </div>

            {phase === 'confirm' &&
              (!level ? (
                <p className="text-sm py-2">請先用「AI 抽字」設定這個語言的等級，AI 會依等級造句。</p>
              ) : busy ? (
                <ExtractingIndicator
                  label="AI 造句中"
                  steps={['正在讀取單字…', '依你的等級造句…', '翻譯例句、切分詞塊…']}
                />
              ) : (
                <div>
                  <p className="text-sm mb-4">
                    這本單字本有 <b>{missingCount}</b> 個字還沒有例句。AI 會依你的等級為最早加入的
                    <b> {batchSize} </b>個字各造一個例句（一次最多 {MAX_EXAMPLE_WORDS} 個），預覽後再決定要寫入哪些；已有例句的字不會被覆蓋。
                  </p>
                  <button
                    type="button"
                    disabled={remaining <= 0}
                    onClick={() => void generate()}
                    className="w-full bg-stamp-red text-cream font-bold py-3 rounded-[5px] text-sm disabled:opacity-60"
                  >
                    {remaining <= 0 ? '本月次數已用完' : '產生例句（使用 1 次）'}
                  </button>
                </div>
              ))}

            {phase === 'preview' && (
              <div className="flex flex-col min-h-0">
                {items.length === 0 ? (
                  <p className="text-sm text-ink-soft py-6 text-center">AI 這次沒有產生可用的例句，請稍後再試。</p>
                ) : (
                  <>
                    <p className="text-xs text-ink-soft mb-2">
                      產生 {items.length} 個例句
                      {items.length < requested && `（${requested - items.length} 個字的例句格式不符，已略過）`}
                      ，不想要的請取消勾選。
                    </p>
                    <div className="overflow-auto border border-line rounded-sm mb-3 flex-1 min-h-0">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-paper-deep font-mono text-[11px] text-ink-soft">
                            <th className="px-3 py-2 w-8">
                              <input
                                type="checkbox"
                                aria-label="全選"
                                checked={selectedCount === items.length}
                                onChange={(e) => setChecked(items.map(() => e.target.checked))}
                              />
                            </th>
                            <th className="text-left px-3 py-2">單字</th>
                            <th className="text-left px-3 py-2">例句</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((it, i) => (
                            <tr key={it.word_id} className={`border-t border-line align-top ${checked[i] ? '' : 'opacity-50'}`}>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="checkbox"
                                  aria-label={`寫入「${it.term}」的例句`}
                                  checked={checked[i] ?? false}
                                  onChange={(e) =>
                                    setChecked((prev) => prev.map((c, j) => (j === i ? e.target.checked : c)))
                                  }
                                />
                              </td>
                              <td className="px-3 py-2">
                                <span lang={language} className="font-serif font-bold">
                                  {it.term}
                                </span>
                                <span className="block text-xs text-ink-soft">{it.answer}</span>
                              </td>
                              <td className="px-3 py-2 text-[13px]">
                                <div lang={language}>{it.example.example}</div>
                                {it.example.example_translation && (
                                  <div className="text-xs text-ink-soft mt-0.5">{it.example.example_translation}</div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={close}
                    disabled={busy}
                    className="border border-line bg-white text-sm px-4 py-2 rounded-sm"
                  >
                    {items.length === 0 ? '關閉' : '不寫入'}
                  </button>
                  {items.length > 0 && (
                    <button
                      type="button"
                      disabled={busy || selectedCount === 0}
                      onClick={() => void apply()}
                      className="bg-stamp-red text-cream font-bold text-sm px-4 py-2 rounded-sm disabled:opacity-60"
                    >
                      {busy ? '寫入中…' : `寫入 ${selectedCount} 個例句`}
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
