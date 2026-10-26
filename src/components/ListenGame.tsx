'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Stamp } from '@/components/Stamp'
import { TermSecondLine } from '@/components/TermSecondLine'
import {
  LISTEN_DURATION_MS,
  LISTEN_FEEDBACK_MS,
  nextListenQuestion,
  reshuffleListenPool,
  type ListenQuestion,
  type ListenWord,
} from '@/lib/games'
import { speechText } from '@/lib/speech'
import { useSpeaker, useVoiceStatus } from '@/lib/use-speech'
import { LANGUAGE_LABELS, type Language } from '@/types/vocab'

interface ListenGameProps {
  language: Language
  pool: ListenWord[]
  initialBest: number | null
  /** 該語言的 show_pronunciation（作答後才顯示第二層） */
  showPronunciation: boolean
}

type Phase = 'ready' | 'playing' | 'done'

interface Result {
  score: number
  questions: number
  isNewBest: boolean
  best: number | null
}

/**
 * 聽音辨字（第十二節 4.）：聽發音，4 選 1，60 秒內答對越多越好。
 * 必須由「開始」按鈕觸發第一次播放（iOS Safari 需使用者點擊才允許語音）。
 */
export function ListenGame({ language, pool: initialPool, initialBest, showPronunciation }: ListenGameProps) {
  const label = LANGUAGE_LABELS[language]
  const speak = useSpeaker(language)
  const voiceStatus = useVoiceStatus(language)

  const [phase, setPhase] = useState<Phase>('ready')
  const [question, setQuestion] = useState<ListenQuestion | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [correct, setCorrect] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [remaining, setRemaining] = useState(LISTEN_DURATION_MS)
  const [result, setResult] = useState<Result | null>(null)
  const [best, setBest] = useState(initialBest)
  const [error, setError] = useState<string | null>(null)

  // 計時器與 setTimeout 會在舊的 render 中執行，遊戲狀態以 ref 為準
  const phaseRef = useRef<Phase>('ready')
  const poolRef = useRef(initialPool)
  const cursorRef = useRef(0)
  const questionRef = useRef<ListenQuestion | null>(null)
  const pickedRef = useRef(false)
  const shownRef = useRef(0)
  const correctRef = useRef(0)
  const mistakesRef = useRef(0)
  const endAtRef = useRef(0)
  const feedbackTimer = useRef<number | null>(null)
  const bestRef = useRef(initialBest)

  const say = useCallback(
    (q: ListenQuestion | null) => {
      if (q && speak) speak(speechText(q.answer.term, q.answer.reading, language))
    },
    [speak, language]
  )

  function showNext(): boolean {
    const r = nextListenQuestion(poolRef.current, cursorRef.current, language)
    if (!r) return false
    cursorRef.current = r.next
    shownRef.current += 1
    questionRef.current = r.question
    pickedRef.current = false
    setQuestion(r.question)
    setPicked(null)
    say(r.question)
    return true
  }

  const finish = useCallback(async () => {
    if (phaseRef.current !== 'playing') return
    phaseRef.current = 'done'
    if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()

    const score = correctRef.current
    const questions = Math.max(1, shownRef.current)
    const finalMistakes = mistakesRef.current
    setRemaining(0)
    setPhase('done')
    setResult({ score, questions, isNewBest: false, best: bestRef.current })
    try {
      const res = await fetch('/api/games/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: 'listen', language, word_count: questions, score, mistakes: finalMistakes }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '成績儲存失敗')
        return
      }
      bestRef.current = data.best
      setBest(data.best)
      setResult({ score, questions, isNewBest: data.is_new_best, best: data.best })
    } catch {
      setError('網路錯誤，成績未儲存')
    }
  }, [language])

  /** 開始一局：必須在點擊事件中同步呼叫，第一題的播放才會被 iOS 允許 */
  function start(reshuffle: boolean) {
    if (!speak) return
    if (reshuffle) poolRef.current = reshuffleListenPool(poolRef.current)
    cursorRef.current = 0
    shownRef.current = 0
    correctRef.current = 0
    mistakesRef.current = 0
    setCorrect(0)
    setMistakes(0)
    setResult(null)
    setError(null)
    endAtRef.current = performance.now() + LISTEN_DURATION_MS
    setRemaining(LISTEN_DURATION_MS)
    phaseRef.current = 'playing'
    setPhase('playing')
    if (!showNext()) void finish()
  }

  function choose(choice: ListenWord) {
    const q = questionRef.current
    if (phaseRef.current !== 'playing' || !q || pickedRef.current) return
    pickedRef.current = true
    setPicked(choice.id)
    if (choice.id === q.answer.id) {
      correctRef.current += 1
      setCorrect(correctRef.current)
    } else {
      mistakesRef.current += 1
      setMistakes(mistakesRef.current)
    }
    feedbackTimer.current = window.setTimeout(() => {
      feedbackTimer.current = null
      if (phaseRef.current === 'playing' && !showNext()) void finish()
    }, LISTEN_FEEDBACK_MS)
  }

  // 倒數 60 秒（作答回饋與重播期間照算）
  useEffect(() => {
    if (phase !== 'playing') return
    const t = window.setInterval(() => {
      const left = endAtRef.current - performance.now()
      if (left <= 0) void finish()
      else setRemaining(left)
    }, 100)
    return () => window.clearInterval(t)
  }, [phase, finish])

  // 離開頁面時停止播放與計時
  useEffect(
    () => () => {
      if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current)
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    },
    []
  )

  // 鍵盤：1–4 作答、S 重播
  useEffect(() => {
    if (phase !== 'playing') return
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        say(questionRef.current)
        return
      }
      const n = Number(e.key)
      const choice = questionRef.current?.choices[n - 1]
      if (Number.isInteger(n) && choice) {
        e.preventDefault()
        choose(choice)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // choose 只讀 ref，不需列入依賴
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, say])

  const breadcrumb = (
    <span>
      <Link href="/app/games" className="border-b border-dotted border-ink-soft">
        遊戲
      </Link>
      {` ／ 聽音辨字 ・ ${label}`}
    </span>
  )

  if (phase === 'done' && result) {
    return (
      <div className="max-w-md mx-auto text-center py-6">
        <div className="bg-cream border border-line rounded-lg p-8 shadow-[0_18px_40px_rgba(30,42,64,0.14)]">
          <div className="flex justify-center mb-4 min-h-[96px] items-center">
            {result.isNewBest ? <Stamp label="新紀錄" size="lg" animate /> : <Stamp label="完成" size="lg" />}
          </div>
          <h1 className="font-serif font-black text-3xl mb-1">答對 {result.score} 題</h1>
          <p className="text-sm text-ink-soft mb-6">
            60 秒內聽了 {result.questions} 題{mistakes > 0 && `，答錯 ${mistakes} 次`}
          </p>
          {result.best !== null && !result.isNewBest && (
            <p className="font-mono text-[12px] text-ink-soft mb-6">
              {label}個人最佳 {result.best} 題
            </p>
          )}
          {error && <p className="text-sm text-stamp-red mb-4">{error}</p>}
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              type="button"
              autoFocus
              disabled={!speak}
              onClick={() => start(true)}
              className="bg-stamp-red text-cream font-bold text-sm px-6 py-3 rounded-[5px] hover:bg-stamp-red-deep disabled:opacity-60"
            >
              再玩一局
            </button>
            <Link
              href="/app/games"
              className="bg-cream border border-line text-ink font-semibold text-sm px-6 py-3 rounded-[5px] hover:border-ink"
            >
              回遊戲
            </Link>
          </div>
          <p className="text-[12px] text-ink-soft mt-5">遊戲成績不影響熟練度與連續天數。</p>
        </div>
      </div>
    )
  }

  if (phase === 'ready') {
    return (
      <div className="max-w-md mx-auto">
        <div className="text-[12.5px] text-ink-soft mb-4">{breadcrumb}</div>
        <div className="bg-cream border border-line rounded-lg p-8 text-center shadow-[0_18px_40px_rgba(30,42,64,0.14)]">
          <h1 className="font-serif font-black text-2xl mb-2">聽音辨字</h1>
          <p className="text-sm text-ink-soft mb-6">
            聽發音，從 4 個選項選出聽到的{label}單字。60 秒內答對越多越好；答錯不扣時間，可以無限重播。
          </p>
          {voiceStatus === 'none' ? (
            <p className="text-sm text-stamp-red-deep mb-2">這台裝置沒有{label}語音，無法玩聽音辨字。</p>
          ) : (
            <button
              type="button"
              autoFocus
              disabled={!speak}
              onClick={() => start(false)}
              className="w-full bg-stamp-red text-cream font-bold py-3 rounded-[5px] text-sm hover:bg-stamp-red-deep disabled:opacity-60"
            >
              {speak ? '開始' : '語音載入中…'}
            </button>
          )}
          <p className="text-[12px] text-ink-soft mt-4">
            鍵盤：數字鍵 1–4 作答、S 重播
            {best !== null && ` ・ ${label}個人最佳 ${best} 題`}
          </p>
        </div>
      </div>
    )
  }

  const answered = picked !== null && question !== null
  const isRight = answered && picked === question.answer.id
  const seconds = Math.ceil(remaining / 1000)

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center justify-between text-[12.5px] text-ink-soft mb-2 flex-wrap gap-2">
        {breadcrumb}
        <span className="font-mono text-[12px]">
          答對 {correct}
          {mistakes > 0 && <span className="text-stamp-red"> ・ 錯 {mistakes}</span>} ・ 剩 {seconds} 秒
        </span>
      </div>
      <div
        className="h-1.5 bg-paper-deep rounded-full overflow-hidden mb-6"
        role="progressbar"
        aria-label="剩餘時間"
        aria-valuemin={0}
        aria-valuemax={60}
        aria-valuenow={seconds}
      >
        <div
          className={`h-full ${seconds <= 10 ? 'bg-stamp-red' : 'bg-ink'}`}
          style={{ width: `${(remaining / LISTEN_DURATION_MS) * 100}%` }}
        />
      </div>

      <div className="flex justify-center mb-6">
        <button
          type="button"
          onClick={() => say(question)}
          aria-label="重播發音"
          className="w-24 h-24 rounded-full border-[1.5px] border-line bg-cream hover:border-ink flex flex-col items-center justify-center shadow-[0_4px_12px_rgba(30,42,64,0.06)]"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 9v6h4l5 4V5L8 9H4z" strokeLinejoin="round" />
            <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" strokeLinecap="round" />
          </svg>
          <span className="text-[11px] text-ink-soft mt-1">再聽一次</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {question?.choices.map((c, i) => {
          const isAnswer = c.id === question.answer.id
          const isPicked = c.id === picked
          const state = !answered
            ? 'border-line hover:border-ink'
            : isAnswer
              ? 'border-good bg-good-bg'
              : isPicked
                ? 'border-stamp-red bg-warn-bg'
                : 'border-line opacity-50'
          return (
            <button
              key={c.id}
              type="button"
              disabled={answered}
              onClick={() => choose(c)}
              lang={language}
              className={`card-ruled relative min-h-[76px] rounded-lg border-[1.5px] px-3 py-3 flex items-center justify-center text-center shadow-[0_4px_12px_rgba(30,42,64,0.06)] transition-colors ${state}`}
            >
              <span className="absolute top-1.5 left-2 font-mono text-[10.5px] text-ink-soft">{i + 1}</span>
              <span className="font-serif font-bold text-[19px] leading-tight break-words">{c.term}</span>
            </button>
          )
        })}
      </div>

      <div aria-live="polite" className="min-h-[52px] mt-4 text-center">
        {answered && (
          <>
            <p className="text-sm">
              <span className={`font-bold ${isRight ? 'text-good' : 'text-stamp-red'}`}>{isRight ? '正確' : '答錯'}</span>
              <span className="text-ink-soft">
                {' ・ '}
                <span lang={language} className="font-serif font-bold text-ink">
                  {question.answer.term}
                </span>{' '}
                {question.answer.meaning}
              </span>
            </p>
            <TermSecondLine language={language} word={question.answer} show={showPronunciation} className="text-xs mt-0.5" />
          </>
        )}
      </div>
    </div>
  )
}
