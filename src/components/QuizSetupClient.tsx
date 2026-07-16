'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'

import { ScopeFilter } from '@/components/ScopeFilter'
import { useAppDialog } from '@/components/AppDialog'
import type { QuestionType, QuizQuestion } from '@/types/quiz'
import type { DbTag, WordbookWithCount } from '@/types/vocab'

const QTYPES: { type: QuestionType; name: string; desc: string }[] = [
  { type: '是非題', name: '是非題', desc: '判斷單字與翻譯配對是否正確' },
  { type: '選擇題', name: '選擇題', desc: '從 4 個選項選出正確翻譯' },
  { type: '輸入題', name: '填空題', desc: '顯示中文，輸入外文單字' },
]

interface QuizSetupClientProps {
  wordbooks: WordbookWithCount[]
  tags: DbTag[]
  initialWordbookId?: string
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
}: QuizSetupClientProps) {
  const router = useRouter()
  const { confirm } = useAppDialog()
  const [wordbookIds, setWordbookIds] = useState<string[]>(
    initialWordbookId ? [initialWordbookId] : []
  )
  const [tagIds, setTagIds] = useState<string[]>([])
  const [poolSize, setPoolSize] = useState(0)
  const [qtype, setQtype] = useState<QuestionType>('選擇題')
  const [count, setCount] = useState(10)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [phase, setPhase] = useState<'setup' | 'play' | 'result'>('setup')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [answers, setAnswers] = useState<AnswerDraft[]>([])
  const [idx, setIdx] = useState(0)
  const [inputVal, setInputVal] = useState('')
  const [result, setResult] = useState<{
    total: number
    correct: number
    wrong: number
    score: number
    question_type: string
    results: {
      word_id: string
      term: string
      prompt?: string
      correct_answer: string
      is_correct: boolean
      user_input?: string
      diff: { type: string; text: string }[] | null
    }[]
  } | null>(null)

  const onFilterChange = useCallback(
    (wb: string[], tg: string[], size: number) => {
      setWordbookIds(wb)
      setTagIds(tg)
      setPoolSize(size)
    },
    []
  )

  async function startQuiz() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/quiz/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wordbook_ids: wordbookIds,
          tag_ids: tagIds,
          question_type: qtype,
          word_count: count,
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
    if (idx + 1 >= questions.length) {
      await finish(nextAnswers)
    } else {
      setIdx(idx + 1)
      setInputVal('')
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
        return
      }
      setResult(data)
      setPhase('result')
    } catch {
      setError('網路錯誤')
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
          {' ／ 測驗結果'}
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
                {result.question_type === '輸入題' ? '填空題' : result.question_type}
              </b>
            </div>
          </div>
        </div>

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
                  {result.question_type === '輸入題' ? (r.prompt ?? r.term) : r.term}
                </div>
                <div className="flex gap-5 text-sm">
                  {result.question_type === '輸入題' && (
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
            重新測驗（同樣範圍）
          </button>
          <Link
            href="/app"
            className="border border-line bg-cream px-6 py-3 rounded-md text-sm font-medium"
          >
            回單字本
          </Link>
        </div>
        <p className="text-xs text-ink-soft mt-2.5">
          答錯率越高的單字，下次測驗出現的機率越高。
        </p>
      </div>
    )
  }

  if (phase === 'play' && q) {
    return (
      <div className="max-w-md mx-auto">
        <div className="font-mono text-[10.5px] text-ink-soft mb-3">
          {qtype === '輸入題' ? '填空題' : qtype}{' '}
          <span className="float-right">
            第 {idx + 1} / {questions.length} 題
          </span>
        </div>
        <div className="bg-cream border border-line rounded-lg p-6">
          <div className="font-serif font-black text-2xl text-center mb-5 pt-1">
            {qtype === '輸入題' ? q.prompt : q.term}
          </div>

          {qtype === '是非題' && (
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
                  className="flex-1 py-2.5 rounded-sm font-bold text-sm border-[1.5px] border-[#3E7A4F] text-[#3E7A4F]"
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

          {qtype === '選擇題' && q.options && (
            <div className="flex flex-col gap-2">
              {q.options.map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    pushAnswer({
                      word_id: q.word_id,
                      selected_answer: opt,
                    })
                  }
                  className="block w-full text-left px-3.5 py-2.5 border border-line rounded-md text-sm bg-paper hover:border-stamp-red"
                >
                  {String.fromCharCode(65 + i)}. {opt}
                </button>
              ))}
            </div>
          )}

          {qtype === '輸入題' && (
            <div className="text-center">
              <p className="text-xs text-ink-soft mb-3">請輸入對應的外文單字</p>
              <input
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
                placeholder="輸入英文單字…"
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
            const ok = await confirm('確定結束測驗？目前進度將不會儲存。', {
              title: '放棄測驗',
              confirmLabel: '結束測驗',
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
          放棄測驗
        </button>
        {error && <p className="text-sm text-stamp-red mt-2">{error}</p>}
      </div>
    )
  }

  const minPool = qtype === '選擇題' ? 4 : qtype === '是非題' ? 2 : 1
  const canStart = wordbookIds.length > 0 && poolSize >= minPool && count >= 1

  return (
    <div>
      <p className="text-[12.5px] text-ink-soft mb-2.5">
        <Link href="/app" className="border-b border-dotted border-ink-soft">
          我的單字本
        </Link>
        {' ／ 測驗設定'}
      </p>
      <h1 className="font-serif font-black text-2xl mb-6">開始一場測驗</h1>

      <ScopeFilter
        wordbooks={wordbooks}
        tags={tags}
        initialWordbookIds={initialWordbookId ? [initialWordbookId] : []}
        onChange={onFilterChange}
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
            type="number"
            min={1}
            max={Math.max(poolSize, 1)}
            value={count}
            onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
            className="font-mono text-lg font-semibold border border-line bg-cream px-4 py-2 rounded-md w-24"
          />
          <span className="text-[12.5px] text-ink-soft">最多 {poolSize || '—'} 題</span>
        </div>
        {poolSize > 0 && poolSize < minPool && (
          <div className="text-[12.5px] text-stamp-red-deep bg-[#FBEAE3] border border-[#E9BCAE] px-3 py-2 rounded mt-2">
            {qtype}單字池需至少 {minPool} 個字，目前僅 {poolSize} 個，請擴大篩選或改題型。
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
        {loading ? '準備中…' : '開始測驗'}
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
