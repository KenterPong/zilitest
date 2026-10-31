'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ScopeFilter } from '@/components/ScopeFilter'
import { TermSecondLine } from '@/components/TermSecondLine'
import { useAppDialog } from '@/components/AppDialog'
import { ACHIEVEMENT_BY_KEY } from '@/lib/growth'
import type { PronunciationPrefs } from '@/lib/pronunciation-display'
import {
  insufficientLanguagesText,
  MIN_WORDS_PER_LANGUAGE,
  splitLanguagesByMinimum,
  type LanguageCounts,
} from '@/lib/quiz-language'
import { QUESTION_TYPE_LABELS, type QuestionType, type QuizQuestion } from '@/types/quiz'
import { LANGUAGE_LABELS, type DbTag, type Language, type WordbookWithCount } from '@/types/vocab'

const QTYPES: { type: QuestionType; name: string; desc: string }[] = [
  { type: 'tf', name: QUESTION_TYPE_LABELS.tf, desc: '判斷單字與翻譯配對是否正確' },
  { type: 'choice', name: QUESTION_TYPE_LABELS.choice, desc: '從 4 個選項選出正確翻譯' },
  { type: 'input', name: QUESTION_TYPE_LABELS.input, desc: '顯示中文，輸入外文單字' },
]

interface QuizSetupClientProps {
  wordbooks: WordbookWithCount[]
  tags: DbTag[]
  initialWordbookId?: string
  pronunciationPrefs: PronunciationPrefs
}

type AnswerDraft = {
  word_id: string
  user_says_true?: boolean
  display_answer?: string
  selected_answer?: string
  user_input?: string
}

export function QuizSetupClient({
  wordbooks,
  tags,
  initialWordbookId,
  pronunciationPrefs,
}: QuizSetupClientProps) {
  const router = useRouter()
  const { confirm } = useAppDialog()
  const [wordbookIds, setWordbookIds] = useState<string[]>(
    initialWordbookId ? [initialWordbookId] : []
  )
  const [tagIds, setTagIds] = useState<string[]>([])
  const [languageCounts, setLanguageCounts] = useState<LanguageCounts>({})
  const [poolLoading, setPoolLoading] = useState(!!initialWordbookId)
  const [qtype, setQtype] = useState<QuestionType>('choice')
  const [countInput, setCountInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [phase, setPhase] = useState<'setup' | 'play' | 'scoring' | 'result'>(
    'setup'
  )
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [answers, setAnswers] = useState<AnswerDraft[]>([])
  const [idx, setIdx] = useState(0)
  const [inputVal, setInputVal] = useState('')
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null)
  const answerInputRef = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<{
    total: number
    correct: number
    wrong: number
    score: number
    question_type: QuestionType
    new_achievements?: string[]
    results: {
      word_id: string
      term: string
      language: Language
      reading: string | null
      pronunciation: string | null
      prompt?: string
      correct_answer: string
      is_correct: boolean
      user_input?: string
      diff: { type: string; text: string }[] | null
    }[]
  } | null>(null)

  const onFilterChange = useCallback(
    (wb: string[], tg: string[], _size: number, loadingPool: boolean, counts: LanguageCounts) => {
      setWordbookIds(wb)
      setTagIds(tg)
      setLanguageCounts(counts)
      setPoolLoading(loadingPool)
    },
    []
  )

  useEffect(() => {
    if (phase !== 'play' || qtype !== 'input') return
    const id = window.requestAnimationFrame(() => {
      answerInputRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(id)
  }, [phase, qtype, idx])

  useEffect(() => {
    setSelectedChoice(null)
  }, [idx, phase])

  function parseCountInput(raw: string): number | null {
    const trimmed = raw.trim()
    if (!trimmed) return null
    if (!/^\d+$/.test(trimmed)) return null
    const n = Number(trimmed)
    if (!Number.isInteger(n) || n < 1) return null
    return n
  }

  async function startQuiz() {
    setError(null)
    const maxCount = Math.max(poolSize, 1)
    const parsed = parseCountInput(countInput)
    if (parsed === null) {
      setError('請輸入正整數題數')
      return
    }
    if (parsed > maxCount) {
      setError(`題數不可超過可出題數（最多 ${maxCount} 題）`)
      return
    }
    setCountInput(String(parsed))
    setLoading(true)
    try {
      const res = await fetch('/api/quiz/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wordbook_ids: wordbookIds,
          tag_ids: tagIds,
          question_type: qtype,
          word_count: parsed,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '無法開始測驗')
        return
      }
      setSessionId(data.session_id)
      setQuestions(data.questions)
      setAnswers([])
      setIdx(0)
      setInputVal('')
      setSelectedChoice(null)
      setPhase('play')
      if (data.truncated) {
        setError(`單字池僅 ${data.questions.length} 個，已全部入選`)
      }
    } catch {
      setError('網路錯誤')
    } finally {
      setLoading(false)
    }
  }

  async function pushAnswer(draft: AnswerDraft) {
    const nextAnswers = [...answers, draft]
    setAnswers(nextAnswers)
    setSelectedChoice(null)
    setInputVal('')
    if (typeof document !== 'undefined') {
      const active = document.activeElement
      if (active instanceof HTMLElement) active.blur()
    }
    if (idx + 1 >= questions.length) {
      setPhase('scoring')
      setError(null)
      await finish(nextAnswers)
    } else {
      setIdx(idx + 1)
    }
  }

  async function finish(finalAnswers: AnswerDraft[]) {
    if (!sessionId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/quiz/${sessionId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: finalAnswers }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '提交失敗')
        setPhase('play')
        return
      }
      setResult(data)
      setPhase('result')
    } catch {
      setError('網路錯誤')
      setPhase('play')
    } finally {
      setLoading(false)
    }
  }

  const q = questions[idx]

  if (phase === 'result' && result) {
    const wrongs = result.results.filter((r) => !r.is_correct)
    return (
      <div>
        <p className="text-[12.5px] text-ink-soft mb-4">
          <Link href="/app" className="border-b border-dotted border-ink-soft">
            我的單字本
          </Link>
          {' ／ 自由練習結果'}
        </p>

        <div className="flex items-center gap-8 bg-cream border border-line rounded-lg p-6 mb-6 flex-wrap">
          <div className="w-[92px] h-[92px] rounded-full border-[5px] border-stamp-red flex flex-col items-center justify-center shrink-0">
            <div className="font-serif font-black text-[22px]">
              {Math.round(result.score * 100)}%
            </div>
            <div className="font-mono text-[9px] text-ink-soft">正確率</div>
          </div>
          <div className="flex gap-9 flex-wrap text-[13px] text-ink-soft">
            <div>
              總題數
              <b className="block font-serif text-xl text-ink">{result.total}</b>
            </div>
            <div>
              答對
              <b className="block font-serif text-xl text-ink">{result.correct}</b>
            </div>
            <div>
              答錯
              <b className="block font-serif text-xl text-ink">{result.wrong}</b>
            </div>
            <div>
              題型
              <b className="block font-serif text-xl text-ink">
                {QUESTION_TYPE_LABELS[result.question_type]}
              </b>
            </div>
          </div>
        </div>

        {(result.new_achievements?.length ?? 0) > 0 && (
          <div className="border border-gold bg-cream rounded-md px-5 py-3 mb-6 text-sm">
            <span className="font-mono text-[11px] tracking-[0.12em] text-gold mr-2">解鎖成就</span>
            {result.new_achievements!
              .map((key) => ACHIEVEMENT_BY_KEY.get(key)?.name ?? key)
              .join('、')}
          </div>
        )}

        {wrongs.length > 0 && (
          <>
            <div className="font-mono text-[11.5px] tracking-wide text-ink-soft mb-3.5">
              答錯的單字
            </div>
            {wrongs.map((r) => (
              <div
                key={r.word_id}
                className="bg-cream border border-line rounded-md px-5 py-4 mb-2.5 flex items-center justify-between gap-5 flex-wrap"
              >
                <div className="font-serif font-bold text-base min-w-[110px]">
                  {result.question_type === 'input' ? (r.prompt ?? r.term) : r.term}
                  {result.question_type !== 'input' && (
                    <TermSecondLine
                      language={r.language}
                      word={r}
                      show={pronunciationPrefs[r.language]}
                      className="font-normal text-xs"
                    />
                  )}
                </div>
                <div className="flex gap-5 text-sm">
                  {result.question_type === 'input' && (
                    <div>
                      <span className="font-mono text-[9.5px] text-ink-soft block mb-0.5">
                        你的輸入
                      </span>
                      {r.diff ? (
                        <span className="font-mono">
                          {r.diff.map((p, i) => {
                            if (p.type === 'ok') return <span key={i}>{p.text}</span>
                            if (p.type === 'bad' || p.type === 'extra')
                              return (
                                <span
                                  key={i}
                                  className="text-stamp-red font-bold underline decoration-wavy"
                                >
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
                      ) : (
                        <span className="font-mono">{r.user_input || '（空白）'}</span>
                      )}
                    </div>
                  )}
                  <div>
                    <span className="font-mono text-[9.5px] text-ink-soft block mb-0.5">
                      正確答案
                    </span>
                    <span className="font-semibold font-mono">{r.correct_answer}</span>
                    {result.question_type === 'input' && (
                      <TermSecondLine
                        language={r.language}
                        word={r}
                        show={pronunciationPrefs[r.language]}
                        className="text-xs"
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        <div className="flex gap-3 mt-6 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setPhase('setup')
              setResult(null)
              setQuestions([])
              setSessionId(null)
            }}
            className="bg-stamp-red text-cream font-bold px-6 py-3 rounded-md text-sm"
          >
            再練一次（同樣範圍）
          </button>
          <Link
            href="/app"
            className="border border-line bg-cream px-6 py-3 rounded-md text-sm font-medium"
          >
            回單字本
          </Link>
        </div>
        <p className="text-xs text-ink-soft mt-2.5">
          答錯率越高的單字，下次練習出現的機率越高；答錯的字會回到每日任務重新複習。
        </p>
      </div>
    )
  }

  if (phase === 'scoring') {
    return (
      <div className="max-w-md mx-auto py-16 text-center">
        <div className="bg-cream border border-line rounded-lg p-8">
          <p className="font-serif font-bold text-xl mb-2">成績計算中</p>
          <p className="text-sm text-ink-soft">正在核對答案，請稍候…</p>
        </div>
      </div>
    )
  }

  if (phase === 'play' && q) {
    return (
      <div className="max-w-md mx-auto">
        <div className="font-mono text-[10.5px] text-ink-soft mb-3">
          {QUESTION_TYPE_LABELS[qtype]}{' '}
          <span className="float-right">
            第 {idx + 1} / {questions.length} 題
          </span>
        </div>
        <div className="bg-cream border border-line rounded-lg p-6">
          <div className="font-serif font-black text-2xl text-center mb-5 pt-1">
            {qtype === 'input' ? q.prompt : q.term}
            {/* 填空題作答前不顯示第二層（會洩漏拼法） */}
            {qtype !== 'input' && q.term && q.language && (
              <TermSecondLine
                language={q.language}
                word={{ term: q.term, reading: q.reading, pronunciation: q.pronunciation }}
                show={pronunciationPrefs[q.language]}
                className="font-normal text-sm mt-1"
              />
            )}
          </div>

          {qtype === 'tf' && (
            <>
              <div className="flex items-center justify-center gap-2 text-[15px] mb-4 p-3.5 bg-paper-deep rounded-md">
                中文翻譯：<b>{q.display_answer}</b>
              </div>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    pushAnswer({
                      word_id: q.word_id,
                      user_says_true: true,
                      display_answer: q.display_answer,
                    })
                  }
                  className="flex-1 py-2.5 rounded-sm font-bold text-sm border-[1.5px] border-good text-good"
                >
                  正確
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    pushAnswer({
                      word_id: q.word_id,
                      user_says_true: false,
                      display_answer: q.display_answer,
                    })
                  }
                  className="flex-1 py-2.5 rounded-sm font-bold text-sm border-[1.5px] border-stamp-red text-stamp-red-deep"
                >
                  錯誤
                </button>
              </div>
            </>
          )}

          {qtype === 'choice' && q.options && (
            <div key={q.word_id} className="flex flex-col gap-2">
              {q.options.map((opt, i) => {
                const selected = selectedChoice === opt
                return (
                  <button
                    key={`${q.word_id}-${i}-${opt}`}
                    type="button"
                    disabled={loading}
                    onClick={() => setSelectedChoice(opt)}
                    className={`block w-full text-left px-3.5 py-2.5 border rounded-md text-sm transition-colors ${
                      selected
                        ? 'border-stamp-red bg-warn-bg text-ink'
                        : 'border-line bg-paper hover:border-stamp-red'
                    }`}
                  >
                    {String.fromCharCode(65 + i)}. {opt}
                  </button>
                )
              })}
              <button
                type="button"
                disabled={loading || !selectedChoice}
                onClick={() => {
                  if (!selectedChoice) return
                  void pushAnswer({
                    word_id: q.word_id,
                    selected_answer: selectedChoice,
                  })
                }}
                className="mt-2 w-full bg-ink text-cream font-bold py-2.5 rounded-md text-sm disabled:opacity-60"
              >
                確認答案
              </button>
            </div>
          )}

          {qtype === 'input' && (
            <div className="text-center">
              <p className="text-xs text-ink-soft mb-3">請輸入對應的外文單字</p>
              <input
                ref={answerInputRef}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && inputVal.trim()) {
                    void pushAnswer({
                      word_id: q.word_id,
                      user_input: inputVal,
                    })
                  }
                }}
                lang={q.language}
                placeholder={q.language ? `輸入${LANGUAGE_LABELS[q.language]}單字…` : '輸入單字…'}
                className="w-full border-[1.5px] border-line rounded-md px-3.5 py-3 text-[15px] text-center mb-3.5 font-mono"
                autoFocus
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <button
                type="button"
                disabled={loading || !inputVal.trim()}
                onClick={() =>
                  pushAnswer({
                    word_id: q.word_id,
                    user_input: inputVal,
                  })
                }
                className="w-full bg-ink text-cream font-bold py-2.5 rounded-md text-sm disabled:opacity-60"
              >
                送出答案
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={async () => {
            const ok = await confirm('確定結束練習？目前進度將不會儲存。', {
              title: '放棄練習',
              confirmLabel: '結束練習',
              danger: true,
            })
            if (ok) {
              setPhase('setup')
              setQuestions([])
              setSessionId(null)
            }
          }}
          className="mt-4 text-sm text-ink-soft underline"
        >
          放棄練習
        </button>
        {error && <p className="text-sm text-stamp-red mt-2">{error}</p>}
      </div>
    )
  }

  // 防呆依語言計算：字數不足的語言不出題（第五節 5.）
  const minPool = MIN_WORDS_PER_LANGUAGE[qtype]
  const split = splitLanguagesByMinimum(languageCounts, minPool)
  const poolSize = split.ok.reduce((sum, l) => sum + (languageCounts[l] ?? 0), 0)
  const totalWords = Object.values(languageCounts).reduce((sum, n) => sum + (n ?? 0), 0)
  const excludedText = insufficientLanguagesText(split.insufficient, minPool)
  const parsedCount = parseCountInput(countInput)
  const maxCount = Math.max(poolSize, 1)
  const canStart =
    wordbookIds.length > 0 &&
    !poolLoading &&
    poolSize >= minPool &&
    parsedCount !== null &&
    parsedCount <= maxCount

  return (
    <div>
      <p className="text-[12.5px] text-ink-soft mb-2.5">
        <Link href="/app" className="border-b border-dotted border-ink-soft">
          我的單字本
        </Link>
        {' ／ 自由練習'}
      </p>
      <h1 className="font-serif font-black text-2xl mb-2">
        自由練習
      </h1>
      <p className="text-sm text-ink-soft mb-6">
        自選範圍與題型練習，可複選多本單字本；錯誤率越高的單字越常出現。連續天數只計每日任務。
      </p>

      <ScopeFilter
        wordbooks={wordbooks}
        tags={tags}
        initialWordbookIds={initialWordbookId ? [initialWordbookId] : []}
        onChange={onFilterChange}
        emphasizeCombined
      />

      <div className="mb-6">
        <div className="font-mono text-[11.5px] tracking-wide text-ink-soft mb-2.5">
          題型
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {QTYPES.map((q) => (
            <button
              key={q.type}
              type="button"
              onClick={() => setQtype(q.type)}
              className={`text-left bg-cream border-[1.5px] rounded-md px-4 py-4 ${
                qtype === q.type ? 'border-stamp-red' : 'border-line'
              }`}
            >
              <div className="font-serif font-bold text-[15px] mb-1">{q.name}</div>
              <div className="text-[12.5px] text-ink-soft">{q.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <div className="font-mono text-[11.5px] tracking-wide text-ink-soft mb-2.5">
          題數
        </div>
        <div className="flex items-center gap-3.5">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={countInput}
            placeholder="輸入題數"
            onChange={(e) => {
              const next = e.target.value.replace(/[^\d]/g, '')
              setCountInput(next)
              setError(null)
            }}
            onBlur={() => {
              if (!countInput.trim()) return
              const parsed = parseCountInput(countInput)
              if (parsed === null) {
                setError('請輸入正整數題數')
                return
              }
              if (parsed > maxCount) {
                setCountInput(String(maxCount))
                setError(`題數不可超過可出題數（最多 ${maxCount} 題）`)
                return
              }
              setCountInput(String(parsed))
            }}
            className="font-mono text-lg font-semibold border border-line bg-cream px-4 py-2 rounded-md w-24 placeholder:text-ink-soft placeholder:font-sans placeholder:text-sm placeholder:font-normal"
            aria-label="題數"
          />
          <span className="text-[12.5px] text-ink-soft">
            最多 {poolLoading ? '計算中…' : poolSize || '—'} 題
          </span>
        </div>
        {!poolLoading && totalWords > 0 && excludedText && (
          <div className="text-[12.5px] text-stamp-red-deep bg-warn-bg border border-warn-line px-3 py-2 rounded mt-2">
            {poolSize === 0
              ? `${QUESTION_TYPE_LABELS[qtype]}每個語言需至少 ${minPool} 個字（${excludedText}），請擴大篩選或改題型。`
              : `${excludedText}，${QUESTION_TYPE_LABELS[qtype]}不出這些語言的字。`}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-stamp-red mb-3">{error}</p>}

      <button
        type="button"
        disabled={!canStart || loading}
        onClick={startQuiz}
        className="bg-stamp-red text-cream font-bold text-[15px] px-8 py-3.5 rounded-sm disabled:opacity-60"
      >
        {loading
          ? '準備中…'
          : poolLoading
            ? '計算單字池…'
            : '開始練習'}
      </button>
      <button
        type="button"
        onClick={() => router.push('/app')}
        className="ml-3 text-sm text-ink-soft underline"
      >
        返回
      </button>
    </div>
  )
}
