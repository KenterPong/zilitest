'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import { SpeakButton } from '@/components/SpeakButton'
import { TermSecondLine } from '@/components/TermSecondLine'
import { StagePips } from '@/components/StagePips'
import { Stamp } from '@/components/Stamp'
import { ACHIEVEMENT_BY_KEY } from '@/lib/growth'
import { speechText } from '@/lib/speech'
import { useAutoSpeak, useSpeaker } from '@/lib/use-speech'
import type { DailyAnswerResult, DailyQuestion, DailyTaskPayload } from '@/types/daily'
import { LANGUAGE_LABELS } from '@/types/vocab'

interface DailyTaskClientProps {
  payload: DailyTaskPayload
  currentStreak: number
  /** 該語言的 show_pronunciation */
  showPronunciation: boolean
}

type Step = 'card' | 'answer' | 'feedback'

const KIND_TAG: Record<DailyQuestion['kind'], string> = {
  new: 'NEW',
  mcq: '選擇',
  fill: '填空',
}

/** 卡片翻面時間（與 globals.css .card-inner 一致） */
const FLIP_MS = 450
/** 卡片離場時間 */
const LEAVE_MS = 260

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
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

function CardHeader({ kind, stage, lang }: { kind: DailyQuestion['kind']; stage: number; lang: string }) {
  return (
    <div className="absolute top-3 left-4 right-4 flex items-center justify-between">
      <span
        className={`font-mono text-[11px] tracking-[0.12em] ${
          kind === 'new' ? 'text-stamp-red font-semibold' : 'text-ink-soft'
        }`}
      >
        {KIND_TAG[kind]} ・ {lang}
      </span>
      <StagePips stage={stage} />
    </div>
  )
}

export function DailyTaskClient({ payload, currentStreak, showPronunciation }: DailyTaskClientProps) {
  const label = LANGUAGE_LABELS[payload.language]
  const [questions] = useState(payload.questions)
  const [idx, setIdx] = useState(0)
  const [answered, setAnswered] = useState(payload.answered)
  const [step, setStep] = useState<Step>(questions[0]?.kind === 'new' ? 'card' : 'answer')
  const [selected, setSelected] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<DailyAnswerResult | null>(null)
  const [streak, setStreak] = useState(currentStreak)
  const [achievements, setAchievements] = useState<string[]>([])
  const [masteredCount, setMasteredCount] = useState(0)
  /** 整個任務的答對數（含續作前已答的題目） */
  const [taskCorrect, setTaskCorrect] = useState(payload.correct)
  const [finished, setFinished] = useState(questions.length === 0)
  const inputRef = useRef<HTMLInputElement>(null)
  const speaker = useSpeaker(payload.language)
  const [autoSpeak] = useAutoSpeak()
  const spokenRef = useRef<string | null>(null)

  const q = questions[idx]
  /** 填空題翻開答案前不能發音（等於直接唸出答案） */
  const canSpeak = q ? q.kind !== 'fill' || (step === 'feedback' && feedback !== null) : false
  const speakTerm = q?.kind === 'fill' ? feedback?.term : q?.term
  const speakReading = q?.kind === 'fill' ? feedback?.reading : q?.reading

  // 自動播放：每張卡在可發音時唸一次（設定頁開關，預設關閉）
  useEffect(() => {
    if (!autoSpeak || !speaker || !q || !canSpeak || !speakTerm) return
    const key = `${q.word_id}:${q.kind === 'fill' ? 'back' : 'front'}`
    if (spokenRef.current === key) return
    spokenRef.current = key
    speaker(speechText(speakTerm, speakReading, payload.language))
  }, [autoSpeak, speaker, q, canSpeak, speakTerm, speakReading, payload.language])

  // 鍵盤 S：播放目前單字的發音
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 's' && e.key !== 'S') return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (!speaker || !canSpeak || !speakTerm) return
      e.preventDefault()
      speaker(speechText(speakTerm, speakReading, payload.language))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [speaker, canSpeak, speakTerm, speakReading, payload.language])

  useEffect(() => {
    if (step !== 'answer' || q?.kind !== 'fill') return
    const id = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [step, q])

  const submit = useCallback(async () => {
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
  }, [q, submitting, input, selected, payload.task_id])

  const next = useCallback(() => {
    if (leaving) return
    const advance = () => {
      const nextIdx = idx + 1
      setLeaving(false)
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
    if (prefersReducedMotion()) {
      advance()
      return
    }
    setLeaving(true)
    window.setTimeout(advance, LEAVE_MS)
  }, [leaving, idx, questions])

  // 鍵盤：1–4 選答案、Enter 確認（填空題輸入框自行處理 Enter；下一題按鈕已取得焦點）
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!q || step !== 'answer' || q.kind === 'fill') return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const n = Number(e.key)
      const opts = q.options ?? []
      if (Number.isInteger(n) && n >= 1 && n <= opts.length) {
        setSelected(opts[n - 1])
        e.preventDefault()
      } else if (e.key === 'Enter' && selected) {
        e.preventDefault()
        void submit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [q, step, selected, submit])

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
            {doneAll && (
              <Link
                href={`/app/games/match?lang=${payload.language}`}
                className="bg-cream border border-line text-ink font-semibold text-sm px-6 py-3 rounded-[5px] hover:border-ink"
              >
                玩一局配對
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (!q) return null

  const remaining = questions.length - idx
  const behind = Math.min(remaining - 1, 2)
  const flipped = step === 'feedback' && feedback !== null
  const stampLabel = feedback?.became_mastered ? '掌握' : feedback?.is_correct ? '正確' : '再來'

  return (
    <div className="max-w-md mx-auto">
      <div className="flex items-center justify-between text-[12.5px] text-ink-soft mb-4">
        <span>
          <Link href="/app" className="border-b border-dotted border-ink-soft">
            今日任務
          </Link>
          {` ／ ${label}`}
        </span>
        <span className="font-mono text-[11px]">
          已答 {answered} / {payload.total} ・ 剩 {remaining} 張
        </span>
      </div>

      {/* 牌堆：後方疊著尚未翻開的卡 */}
      <div className="relative h-[270px] mb-6 card-3d">
        {Array.from({ length: behind }, (_, i) => (
          <div
            key={i}
            className="absolute inset-0 rounded-lg border border-line bg-cream"
            style={{ transform: `translate(${(i + 1) * 5}px, ${(i + 1) * 5}px) rotate(${(i + 1) * 1.3}deg)` }}
            aria-hidden
          />
        ))}

        <div
          key={q.word_id}
          className={`card-inner ${flipped ? 'is-flipped' : ''} ${leaving ? 'is-leaving' : ''}`}
        >
          {/* 正面：題目 */}
          <div className="card-face card-ruled rounded-lg border border-line shadow-[0_10px_28px_rgba(30,42,64,0.10)]">
            <CardHeader kind={q.kind} stage={q.stage} lang={label} />
            <div className="h-full flex flex-col items-center justify-center px-6 pt-6 text-center">
              {q.kind === 'fill' ? (
                <>
                  <div className="font-serif font-bold text-[26px] break-words">{q.answer}</div>
                  <p className="text-xs text-ink-soft mt-2">拼出對應的{label}單字</p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2.5">
                    <div className="font-serif font-bold text-[34px] leading-tight break-words">{q.term}</div>
                    {q.term && <SpeakButton term={q.term} reading={q.reading} language={payload.language} />}
                  </div>
                  {q.term && (
                    <TermSecondLine
                      language={payload.language}
                      word={{ term: q.term, reading: q.reading, pronunciation: q.pronunciation }}
                      show={showPronunciation}
                    />
                  )}
                  {step === 'card' ? (
                    <>
                      <div className="text-lg mt-3">{q.answer}</div>
                      {q.description && (
                        <p className="text-[12.5px] text-ink-soft mt-2 line-clamp-3 whitespace-pre-wrap">
                          {q.description}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-ink-soft mt-3">選出中文意思</p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 背面：答案與結果 */}
          <div className="card-face card-back card-ruled rounded-lg border border-line shadow-[0_10px_28px_rgba(30,42,64,0.10)]">
            {feedback && (
              <>
                <CardHeader kind={q.kind} stage={feedback.stage_after} lang={label} />
                <div className="h-full flex flex-col items-center justify-center px-6 pt-6 text-center">
                  {q.kind === 'fill' ? (
                    <>
                      <div className="flex items-center gap-2.5">
                        <div className="font-serif font-bold text-[30px] leading-tight break-words">
                          {feedback.correct_answer}
                        </div>
                        <SpeakButton term={feedback.term} reading={feedback.reading} language={payload.language} />
                      </div>
                      {/* 填空題翻開答案後才顯示第二層 */}
                      <TermSecondLine language={payload.language} word={feedback} show={showPronunciation} />
                      <div className="text-base text-ink-soft mt-1">{q.answer}</div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2.5">
                        <div className="font-serif font-bold text-[30px] leading-tight break-words">{q.term}</div>
                        {q.term && <SpeakButton term={q.term} reading={q.reading} language={payload.language} />}
                      </div>
                      {q.term && (
                        <TermSecondLine
                          language={payload.language}
                          word={{ term: q.term, reading: q.reading, pronunciation: q.pronunciation }}
                          show={showPronunciation}
                          className="text-sm"
                        />
                      )}
                      <div className="text-lg mt-2">{feedback.correct_answer}</div>
                    </>
                  )}
                  <div
                    className={`mt-3 text-sm font-bold ${feedback.is_correct ? 'text-good' : 'text-stamp-red-deep'}`}
                    role="status"
                  >
                    {feedback.is_correct ? '答對了' : '答錯了，明天再複習'}
                  </div>
                  {!feedback.is_correct && q.kind === 'fill' && feedback.diff && (
                    <div className="text-[13px] mt-1">
                      你的輸入：<DiffView diff={feedback.diff} />
                    </div>
                  )}
                </div>
                <div className="absolute bottom-4 right-5">
                  <Stamp label={stampLabel} animate delayMs={prefersReducedMotion() ? 0 : FLIP_MS - 100} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 作答區 */}
      {step === 'card' && (
        <button
          type="button"
          autoFocus
          onClick={() => setStep('answer')}
          className="w-full bg-stamp-red text-cream font-bold py-3 rounded-[5px] text-sm hover:bg-stamp-red-deep"
        >
          記住了，開始作答
        </button>
      )}

      {step !== 'card' && q.kind !== 'fill' && (
        <div className="grid grid-cols-2 gap-2">
          {(q.options ?? []).map((opt, i) => {
            const isSelected = selected === opt
            let cls = 'border-line bg-cream hover:border-stamp-red'
            if (step === 'feedback' && feedback) {
              if (opt.trim() === feedback.correct_answer.trim()) cls = 'border-good bg-good-bg'
              else if (isSelected) cls = 'border-stamp-red bg-warn-bg'
              else cls = 'border-line bg-cream opacity-60'
            } else if (isSelected) {
              cls = 'border-stamp-red bg-warn-bg'
            }
            return (
              <button
                key={`${q.word_id}-${i}`}
                type="button"
                disabled={step === 'feedback' || submitting}
                onClick={() => setSelected(opt)}
                className={`text-left px-3 py-2.5 border-[1.5px] rounded-[5px] text-sm transition-colors ${cls}`}
              >
                <span className="font-mono text-[11px] text-ink-soft mr-1.5">{i + 1}</span>
                {opt}
              </button>
            )
          })}
        </div>
      )}

      {step !== 'card' && q.kind === 'fill' && (
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
      )}

      {step === 'answer' && (
        <button
          type="button"
          disabled={submitting || (q.kind === 'fill' ? !input.trim() : !selected)}
          onClick={() => void submit()}
          className="mt-3 w-full bg-stamp-red text-cream font-bold py-3 rounded-[5px] text-sm hover:bg-stamp-red-deep disabled:opacity-60"
        >
          {submitting ? '送出中…' : '翻開答案'}
        </button>
      )}
      {step === 'feedback' && (
        <button
          type="button"
          onClick={next}
          autoFocus
          disabled={leaving}
          className="mt-3 w-full bg-stamp-red text-cream font-bold py-3 rounded-[5px] text-sm hover:bg-stamp-red-deep"
        >
          {idx + 1 >= questions.length ? '完成' : '下一張'}
        </button>
      )}

      {error && <p className="text-sm text-stamp-red mt-3">{error}</p>}
      <p className="text-xs text-ink-soft mt-4">
        每題作答後立即儲存，中途離開可在今天內回來繼續。
        <span className="hidden sm:inline"> 鍵盤：1–4 選答案、Enter 確認、S 播放發音。</span>
      </p>
    </div>
  )
}
