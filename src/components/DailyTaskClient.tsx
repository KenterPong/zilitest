'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { Stamp } from '@/components/Stamp'
import { ACHIEVEMENT_BY_KEY } from '@/lib/growth'
import type { DailyAnswerResult, DailyQuestion, DailyTaskPayload } from '@/types/daily'
import { LANGUAGE_LABELS } from '@/types/vocab'

interface DailyTaskClientProps {
  payload: DailyTaskPayload
  currentStreak: number
}

type Step = 'card' | 'answer' | 'feedback'

const KIND_LABEL: Record<DailyQuestion['kind'], string> = {
  new: '新字',
  mcq: '選擇題',
  fill: '填空題',
}

function DiffView({ diff }: { diff: NonNullable<DailyAnswerResult['diff']> }) {
  return (
    <span className="font-mono">
      {diff.map((p, i) => {
        if (p.type === 'ok') return <span key={i}>{p.text}</span>
        if (p.type === 'bad' || p.type === 'extra')
          return (
            <span key={i} className="text-stamp-red font-bold underline decoration-wavy">
              {p.text}
            </span>
          )
        return (
          <span key={i} className="text-stamp-red font-bold">
            {p.text}
          </span>
        )
      })}
    </span>
  )
}

export function DailyTaskClient({ payload, currentStreak }: DailyTaskClientProps) {
  const label = LANGUAGE_LABELS[payload.language]
  const [questions] = useState(payload.questions)
  const [idx, setIdx] = useState(0)
  const [answered, setAnswered] = useState(payload.answered)
  const [step, setStep] = useState<Step>(questions[0]?.kind === 'new' ? 'card' : 'answer')
  const [selected, setSelected] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<DailyAnswerResult | null>(null)
  const [streak, setStreak] = useState(currentStreak)
  const [achievements, setAchievements] = useState<string[]>([])
  const [masteredCount, setMasteredCount] = useState(0)
  /** 整個任務的答對數（含續作前已答的題目） */
  const [taskCorrect, setTaskCorrect] = useState(payload.correct)
  const [finished, setFinished] = useState(questions.length === 0)
  const inputRef = useRef<HTMLInputElement>(null)

  const q = questions[idx]

  useEffect(() => {
    if (step !== 'answer' || q?.kind !== 'fill') return
    const id = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [step, q])

  async function submit() {
    if (!q || submitting) return
    if (q.kind === 'fill' ? !input.trim() : !selected) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/daily/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: payload.task_id,
          word_id: q.word_id,
          kind: q.kind,
          selected_answer: q.kind === 'fill' ? undefined : selected,
          user_input: q.kind === 'fill' ? input : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '送出失敗，請再試一次')
        return
      }
      const result = data as DailyAnswerResult
      setFeedback(result)
      setAnswered(result.answered)
      setStreak(result.current_streak)
      setTaskCorrect(result.task_correct)
      if (result.became_mastered) setMasteredCount((n) => n + 1)
      if (result.new_achievements.length > 0) {
        setAchievements((prev) => [...prev, ...result.new_achievements])
      }
      setStep('feedback')
    } catch {
      setError('網路錯誤，請再試一次')
    } finally {
      setSubmitting(false)
    }
  }

  function next() {
    const nextIdx = idx + 1
    setFeedback(null)
    setSelected(null)
    setInput('')
    if (nextIdx >= questions.length) {
      setFinished(true)
      return
    }
    setIdx(nextIdx)
    setStep(questions[nextIdx].kind === 'new' ? 'card' : 'answer')
  }

  if (finished && payload.total === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-10">
        <p className="text-ink-soft mb-4">今日{label}任務的單字已全部刪除，明天會依新的單字重新安排。</p>
        <Link href="/app" className="border-b border-current text-sm">
          回今日任務
        </Link>
      </div>
    )
  }

  if (finished) {
    const doneAll = answered >= payload.total
    return (
      <div className="max-w-md mx-auto text-center py-6">
        <div className="bg-cream border border-line rounded-lg p-8 shadow-[0_18px_40px_rgba(30,42,64,0.14)]">
          <div className="flex justify-center mb-5">
            <Stamp label={doneAll ? '完成' : '暫停'} size="lg" animate={doneAll} />
          </div>
          <h1 className="font-serif font-black text-2xl mb-2">
            {doneAll ? `今日${label}任務完成` : `${label}任務尚未完成`}
          </h1>
          <p className="text-sm text-ink-soft mb-6">
            {doneAll
              ? '明天會依熟練度安排新的複習。'
              : '有些單字已被刪除或無法出題，回首頁看看今日進度。'}
          </p>

          <div className="flex justify-center gap-8 mb-6">
            <div>
              <div className="font-mono text-[11px] tracking-[0.06em] text-ink-soft">連續天數</div>
              <div className="font-serif font-black text-2xl">{streak}</div>
            </div>
            <div>
              <div className="font-mono text-[11px] tracking-[0.06em] text-ink-soft">任務答對</div>
              <div className="font-serif font-black text-2xl">
                {taskCorrect}
                <span className="text-sm text-ink-soft font-medium"> / {payload.total}</span>
              </div>
            </div>
            {masteredCount > 0 && (
              <div>
                <div className="font-mono text-[11px] tracking-[0.06em] text-ink-soft">新掌握</div>
                <div className="font-serif font-black text-2xl text-gold">{masteredCount}</div>
              </div>
            )}
          </div>

          {achievements.length > 0 && (
            <div className="border-t border-dashed border-line pt-5 mb-6">
              <div className="font-mono text-[11px] tracking-[0.12em] text-gold mb-3">解鎖成就</div>
              <ul className="space-y-2">
                {achievements.map((key) => {
                  const def = ACHIEVEMENT_BY_KEY.get(key)
                  return (
                    <li key={key} className="flex items-center justify-center gap-3">
                      <Stamp label="成就" animate />
                      <div className="text-left">
                        <div className="font-serif font-bold">{def?.name ?? key}</div>
                        <div className="text-[12.5px] text-ink-soft">{def?.description}</div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              href="/app"
              className="bg-stamp-red text-cream font-bold text-sm px-6 py-3 rounded-[5px] hover:bg-stamp-red-deep"
            >
              回今日任務
            </Link>
            <Link
              href="/app/growth"
              className="bg-cream border border-line text-ink font-semibold text-sm px-6 py-3 rounded-[5px] hover:border-ink"
            >
              查看成長
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!q) return null

  const progressPct = payload.total > 0 ? Math.round((answered / payload.total) * 100) : 0

  return (
    <div className="max-w-md mx-auto">
      <p className="text-[12.5px] text-ink-soft mb-3">
        <Link href="/app" className="border-b border-dotted border-ink-soft">
          今日任務
        </Link>
        {` ／ ${label}`}
      </p>

      <div className="flex items-center justify-between font-mono text-[11px] text-ink-soft mb-1.5">
        <span>{KIND_LABEL[q.kind]}</span>
        <span>
          {answered} / {payload.total}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-paper-deep overflow-hidden mb-4">
        <div className="h-full bg-ink transition-[width]" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="bg-cream border border-line rounded-lg p-6 shadow-[0_10px_28px_rgba(30,42,64,0.10)]">
        {step === 'card' && (
          <div className="text-center">
            <div className="font-mono text-[11px] tracking-[0.12em] text-stamp-red mb-3">新字</div>
            <div className="font-serif font-bold text-3xl mb-3 break-words">{q.term}</div>
            <div className="text-lg text-ink-soft mb-2">{q.answer}</div>
            {q.description && (
              <p className="text-[13px] text-ink-soft bg-paper-deep rounded-[5px] px-3 py-2 mb-2 whitespace-pre-wrap">
                {q.description}
              </p>
            )}
            <button
              type="button"
              onClick={() => setStep('answer')}
              className="mt-4 w-full bg-stamp-red text-cream font-bold py-3 rounded-[5px] text-sm hover:bg-stamp-red-deep"
            >
              記住了，開始作答
            </button>
          </div>
        )}

        {step !== 'card' && (q.kind === 'new' || q.kind === 'mcq') && (
          <div>
            <div className="font-serif font-bold text-3xl text-center mb-5 break-words">{q.term}</div>
            <div className="flex flex-col gap-2">
              {(q.options ?? []).map((opt, i) => {
                const isSelected = selected === opt
                let cls = 'border-line bg-paper hover:border-stamp-red'
                if (step === 'feedback' && feedback) {
                  if (opt.trim() === feedback.correct_answer.trim()) cls = 'border-good bg-good-bg'
                  else if (isSelected) cls = 'border-stamp-red bg-warn-bg'
                  else cls = 'border-line bg-paper opacity-70'
                } else if (isSelected) {
                  cls = 'border-stamp-red bg-warn-bg'
                }
                return (
                  <button
                    key={`${q.word_id}-${i}`}
                    type="button"
                    disabled={step === 'feedback' || submitting}
                    onClick={() => setSelected(opt)}
                    className={`block w-full text-left px-3.5 py-2.5 border-[1.5px] rounded-[5px] text-sm transition-colors ${cls}`}
                  >
                    <span className="font-mono text-[12px] text-ink-soft mr-2">
                      {String.fromCharCode(65 + i)}
                    </span>
                    {opt}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {step !== 'card' && q.kind === 'fill' && (
          <div className="text-center">
            <div className="font-serif font-bold text-2xl mb-2 break-words">{q.answer}</div>
            <p className="text-xs text-ink-soft mb-4">請輸入對應的{label}單字</p>
            <input
              ref={inputRef}
              lang={payload.language}
              value={input}
              disabled={step === 'feedback' || submitting}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                // 避免輸入法選字時的 Enter 被當成送出
                if (e.key === 'Enter' && !e.nativeEvent.isComposing && step === 'answer') {
                  void submit()
                }
              }}
              placeholder={`輸入${label}單字…`}
              className="w-full border-[1.5px] border-line rounded-[5px] px-3.5 py-3 text-[15px] text-center font-mono bg-white focus:outline-none focus:border-ink"
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        )}

        {step === 'feedback' && feedback && (
          <div
            className={`mt-4 rounded-[5px] px-4 py-3 text-sm ${
              feedback.is_correct ? 'bg-good-bg text-good' : 'bg-warn-bg text-stamp-red-deep'
            }`}
            role="status"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-bold mb-0.5">{feedback.is_correct ? '答對了' : '答錯了'}</div>
                {!feedback.is_correct && q.kind === 'fill' && (
                  <div className="text-ink">
                    {feedback.diff && (
                      <div className="mb-0.5">
                        你的輸入：<DiffView diff={feedback.diff} />
                      </div>
                    )}
                    正確答案：<span className="font-mono font-semibold">{feedback.correct_answer}</span>
                  </div>
                )}
              </div>
              {feedback.became_mastered && <Stamp label="掌握" animate />}
            </div>
          </div>
        )}

        {step === 'answer' && (
          <button
            type="button"
            disabled={submitting || (q.kind === 'fill' ? !input.trim() : !selected)}
            onClick={() => void submit()}
            className="mt-4 w-full bg-stamp-red text-cream font-bold py-3 rounded-[5px] text-sm hover:bg-stamp-red-deep disabled:opacity-60"
          >
            {submitting ? '送出中…' : '確認答案'}
          </button>
        )}
        {step === 'feedback' && (
          <button
            type="button"
            onClick={next}
            autoFocus
            className="mt-4 w-full bg-stamp-red text-cream font-bold py-3 rounded-[5px] text-sm hover:bg-stamp-red-deep"
          >
            {idx + 1 >= questions.length ? '完成' : '下一題'}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-stamp-red mt-3">{error}</p>}
      <p className="text-xs text-ink-soft mt-4">
        每題作答後立即儲存，中途離開可在今天內回來繼續。
      </p>
    </div>
  )
}
