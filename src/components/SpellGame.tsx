'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Stamp } from '@/components/Stamp'
import { TermSecondLine } from '@/components/TermSecondLine'
import { speechText } from '@/lib/speech'
import {
  isSpellCorrect,
  makeSpellQuestion,
  reshuffleSpellPool,
  SPELL_CORRECT_MS,
  SPELL_DURATION_MS,
  SPELL_SKIP_MS,
  SPELL_WRONG_FLASH_MS,
  tileForKey,
  type SpellQuestion,
  type SpellTile,
  type SpellWord,
} from '@/lib/spell'
import { useAutoSpeak, useSpeaker } from '@/lib/use-speech'
import { LANGUAGE_LABELS, type Language } from '@/types/vocab'

interface SpellGameProps {
  language: Language
  pool: SpellWord[]
  /** 同語言全部單字的 term（干擾字來源） */
  terms: string[]
  initialBest: number | null
  /** 該語言的 show_pronunciation（答對或跳過後才顯示第二層） */
  showPronunciation: boolean
}

type Phase = 'ready' | 'playing' | 'done'
/** answering：作答中；wrong：空格標示錯誤；correct / skipped：顯示答案後換題 */
type Status = 'answering' | 'wrong' | 'correct' | 'skipped'

interface Result {
  score: number
  questions: number
  isNewBest: boolean
  best: number | null
}

/**
 * 拼字挑戰（第十二節 5.）：看中文，把打散的方塊（含干擾字）拼回外文單字。
 * 按「開始」後出第一題並開始 60 秒計時；英文可用實體鍵盤，日韓第一版不支援。
 */
export function SpellGame({ language, pool: initialPool, terms, initialBest, showPronunciation }: SpellGameProps) {
  const label = LANGUAGE_LABELS[language]
  const speak = useSpeaker(language)
  const [autoSpeak] = useAutoSpeak()

  const [phase, setPhase] = useState<Phase>('ready')
  const [question, setQuestion] = useState<SpellQuestion | null>(null)
  const [filled, setFilled] = useState<SpellTile[]>([])
  const [status, setStatus] = useState<Status>('answering')
  const [correct, setCorrect] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [remaining, setRemaining] = useState(SPELL_DURATION_MS)
  const [result, setResult] = useState<Result | null>(null)
  const [best, setBest] = useState(initialBest)
  const [error, setError] = useState<string | null>(null)

  // 計時器與 setTimeout 會在舊的 render 中執行，遊戲狀態以 ref 為準
  const phaseRef = useRef<Phase>('ready')
  const poolRef = useRef(initialPool)
  const cursorRef = useRef(0)
  const questionRef = useRef<SpellQuestion | null>(null)
  const filledRef = useRef<SpellTile[]>([])
  const statusRef = useRef<Status>('answering')
  const shownRef = useRef(0)
  const correctRef = useRef(0)
  const mistakesRef = useRef(0)
  const endAtRef = useRef(0)
  const timer = useRef<number | null>(null)
  const bestRef = useRef(initialBest)
  // 鍵盤事件可能來自舊的 render；語音設定也以 ref 讀取最新值
  const speakRef = useRef(speak)
  const autoSpeakRef = useRef(autoSpeak)
  speakRef.current = speak
  autoSpeakRef.current = autoSpeak

  function setFilledBoth(next: SpellTile[]) {
    filledRef.current = next
    setFilled(next)
  }

  function setStatusBoth(next: Status) {
    statusRef.current = next
    setStatus(next)
  }

  /** 同一局不重複出題；題庫用完才重新洗牌 */
  function showNext() {
    if (cursorRef.current >= poolRef.current.length) {
      poolRef.current = reshuffleSpellPool(poolRef.current)
      cursorRef.current = 0
    }
    const word = poolRef.current[cursorRef.current]!
    cursorRef.current += 1
    shownRef.current += 1
    const q = makeSpellQuestion(word, language, terms)
    questionRef.current = q
    setQuestion(q)
    setFilledBoth([])
    setStatusBoth('answering')
  }

  const finish = useCallback(async () => {
    if (phaseRef.current !== 'playing') return
    phaseRef.current = 'done'
    if (timer.current !== null) window.clearTimeout(timer.current)

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
        body: JSON.stringify({ game: 'spell', language, word_count: questions, score, mistakes: finalMistakes }),
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

  function start(reshuffle: boolean) {
    if (reshuffle) poolRef.current = reshuffleSpellPool(poolRef.current)
    cursorRef.current = 0
    shownRef.current = 0
    correctRef.current = 0
    mistakesRef.current = 0
    setCorrect(0)
    setMistakes(0)
    setResult(null)
    setError(null)
    endAtRef.current = performance.now() + SPELL_DURATION_MS
    setRemaining(SPELL_DURATION_MS)
    phaseRef.current = 'playing'
    setPhase('playing')
    showNext()
  }

  /** 顯示答案一段時間後換下一題（計時照算） */
  function nextAfter(ms: number) {
    timer.current = window.setTimeout(() => {
      timer.current = null
      if (phaseRef.current === 'playing') showNext()
    }, ms)
  }

  function judge(next: SpellTile[]) {
    const q = questionRef.current!
    if (isSpellCorrect(next.map((t) => t.char), q.word.term)) {
      correctRef.current += 1
      setCorrect(correctRef.current)
      setStatusBoth('correct')
      if (autoSpeakRef.current && speakRef.current) {
        speakRef.current(speechText(q.word.term, q.word.reading, language))
      }
      nextAfter(SPELL_CORRECT_MS)
      return
    }
    mistakesRef.current += 1
    setMistakes(mistakesRef.current)
    setStatusBoth('wrong')
    timer.current = window.setTimeout(() => {
      timer.current = null
      if (phaseRef.current !== 'playing') return
      setFilledBoth([])
      setStatusBoth('answering')
    }, SPELL_WRONG_FLASH_MS)
  }

  function pick(tile: SpellTile) {
    const q = questionRef.current
    if (phaseRef.current !== 'playing' || !q || statusRef.current !== 'answering') return
    if (filledRef.current.some((t) => t.id === tile.id)) return
    const next = [...filledRef.current, tile]
    setFilledBoth(next)
    if (next.length === q.answerTiles.length) judge(next)
  }

  /** 點已填入的方塊退回（後面的方塊往前補） */
  function unpick(id: number) {
    if (phaseRef.current !== 'playing' || statusRef.current !== 'answering') return
    setFilledBoth(filledRef.current.filter((t) => t.id !== id))
  }

  function skip() {
    if (phaseRef.current !== 'playing' || statusRef.current !== 'answering') return
    mistakesRef.current += 1
    setMistakes(mistakesRef.current)
    setStatusBoth('skipped')
    nextAfter(SPELL_SKIP_MS)
  }

  // 倒數 60 秒（顯示答案期間照算）
  useEffect(() => {
    if (phase !== 'playing') return
    const t = window.setInterval(() => {
      const left = endAtRef.current - performance.now()
      if (left <= 0) void finish()
      else setRemaining(left)
    }, 100)
    return () => window.clearInterval(t)
  }, [phase, finish])

  // 離開頁面時停止計時
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    []
  )

  // 鍵盤（僅英文）：輸入字母選方塊、Backspace 退回最後一塊
  useEffect(() => {
    if (phase !== 'playing' || language !== 'en') return
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Backspace') {
        e.preventDefault()
        const last = filledRef.current[filledRef.current.length - 1]
        if (last) unpick(last.id)
        return
      }
      const q = questionRef.current
      if (!q) return
      const tile = tileForKey(q.tiles, new Set(filledRef.current.map((t) => t.id)), e.key)
      if (tile) {
        e.preventDefault()
        pick(tile)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // pick / unpick 只讀 ref，不需列入依賴
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, language])

  const breadcrumb = (
    <span>
      <Link href="/app/games" className="border-b border-dotted border-ink-soft">
        遊戲
      </Link>
      {` ／ 拼字挑戰 ・ ${label}`}
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
            60 秒內拼了 {result.questions} 題{mistakes > 0 && `，答錯或跳過 ${mistakes} 次`}
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
              onClick={() => start(true)}
              className="bg-stamp-red text-cream font-bold text-sm px-6 py-3 rounded-[5px] hover:bg-stamp-red-deep"
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

  if (phase === 'ready' || !question) {
    return (
      <div className="max-w-md mx-auto">
        <div className="text-[12.5px] text-ink-soft mb-4">{breadcrumb}</div>
        <div className="bg-cream border border-line rounded-lg p-8 text-center shadow-[0_18px_40px_rgba(30,42,64,0.14)]">
          <h1 className="font-serif font-black text-2xl mb-2">拼字挑戰</h1>
          <p className="text-sm text-ink-soft mb-6">
            看中文意思，把打散的方塊拼回{label}單字；方塊裡混有不需要的字。60 秒內拼對越多越好。
          </p>
          <button
            type="button"
            autoFocus
            onClick={() => start(false)}
            className="w-full bg-stamp-red text-cream font-bold py-3 rounded-[5px] text-sm hover:bg-stamp-red-deep"
          >
            開始
          </button>
          <p className="text-[12px] text-ink-soft mt-4">
            {language === 'en' ? '鍵盤：輸入字母選方塊、Backspace 退回' : '點方塊填入，點已填入的方塊退回'}
            {best !== null && ` ・ ${label}個人最佳 ${best} 題`}
          </p>
        </div>
      </div>
    )
  }

  const seconds = Math.ceil(remaining / 1000)
  const usedIds = new Set(filled.map((t) => t.id))
  const revealed = status === 'correct' || status === 'skipped'
  const slots = revealed ? question.answerTiles : question.answerTiles.map((_, i) => filled[i]?.char ?? '')

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
          style={{ width: `${(remaining / SPELL_DURATION_MS) * 100}%` }}
        />
      </div>

      <div className="card-ruled relative bg-cream border border-line rounded-lg px-5 py-6 text-center shadow-[0_4px_12px_rgba(30,42,64,0.06)] mb-5">
        <p className="font-serif font-bold text-[22px] leading-snug break-words">{question.word.answer}</p>
        <div className="flex justify-center flex-wrap gap-1.5 mt-5" lang={language}>
          {slots.map((c, i) => {
            const tile = revealed ? null : filled[i]
            const tone =
              status === 'wrong'
                ? 'border-stamp-red bg-warn-bg'
                : status === 'correct'
                  ? 'border-good bg-good-bg'
                  : status === 'skipped'
                    ? 'border-line bg-paper-deep text-ink-soft'
                    : c
                      ? 'border-ink bg-white'
                      : 'border-dashed border-line bg-paper'
            return (
              <button
                key={i}
                type="button"
                disabled={!tile || status !== 'answering'}
                onClick={() => tile && unpick(tile.id)}
                aria-label={tile ? `退回 ${tile.char}` : `第 ${i + 1} 格`}
                className={`w-10 h-11 rounded-[5px] border-[1.5px] font-serif font-bold text-[20px] flex items-center justify-center ${tone}`}
              >
                {c}
              </button>
            )
          })}
        </div>
        <div aria-live="polite" className="min-h-[40px] mt-3">
          {revealed && (
            <>
              <p className="text-sm">
                <span className={`font-bold ${status === 'correct' ? 'text-good' : 'text-ink-soft'}`}>
                  {status === 'correct' ? '正確' : '正確答案'}
                </span>{' '}
                <span lang={language} className="font-serif font-bold">
                  {question.word.term}
                </span>
              </p>
              <TermSecondLine
                language={language}
                word={question.word}
                show={showPronunciation}
                className="text-xs mt-0.5"
              />
            </>
          )}
          {status === 'wrong' && <p className="text-sm text-stamp-red font-bold">拼錯了，再試一次</p>}
        </div>
        {status === 'correct' && (
          <div className="absolute top-3 right-3">
            <Stamp label="正確" animate />
          </div>
        )}
      </div>

      <div className="flex justify-center flex-wrap gap-2" lang={language}>
        {question.tiles.map((t) => {
          const used = usedIds.has(t.id)
          return (
            <button
              key={t.id}
              type="button"
              disabled={used || status !== 'answering'}
              onClick={() => pick(t)}
              className={`card-ruled w-12 h-12 rounded-[5px] border-[1.5px] font-serif font-bold text-[22px] flex items-center justify-center shadow-[0_2px_6px_rgba(30,42,64,0.08)] transition-opacity ${
                used ? 'opacity-25 border-line' : 'border-line hover:border-ink'
              }`}
            >
              {t.char}
            </button>
          )
        })}
      </div>

      <div className="flex justify-center mt-6">
        <button
          type="button"
          onClick={skip}
          disabled={status !== 'answering'}
          className="bg-cream border border-line text-ink font-semibold text-sm px-6 py-2.5 rounded-[5px] hover:border-ink disabled:opacity-50"
        >
          跳過
        </button>
      </div>
    </div>
  )
}
