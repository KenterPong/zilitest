'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { AnswerDiff } from '@/components/AnswerDiff'
import { SpeakButton } from '@/components/SpeakButton'
import { TermSecondLine } from '@/components/TermSecondLine'
import { buildAnswerDiff, fillDiffTarget, type DiffPart } from '@/lib/answer-match'
import type { PronunciationPrefs } from '@/lib/pronunciation-display'
import { speechText } from '@/lib/speech'
import { useAutoSpeak, useSpeaker } from '@/lib/use-speech'
import {
  advanceRecall,
  answerRecall,
  buildRecallOrder,
  createRecallQueue,
  currentRecallId,
  isFirstRecall,
  isRecallDone,
  isWritingMatch,
  shouldSubmitOnEnter,
  summarizeRecall,
  WRITING_COPY_PASS_MS,
  WRITING_RECALL_CORRECT_MS,
  type RecallQueue,
} from '@/lib/writing'
import type { Language } from '@/types/vocab'

export interface WritingCard {
  word_id: string
  term: string
  reading: string | null
  pronunciation: string | null
  answer: string
  description: string | null
  language: Language
}

interface WritingPracticeProps {
  cards: WritingCard[]
  pronunciationPrefs: PronunciationPrefs
  /** 以同一篩選條件重新抽字 */
  onRestart: () => void
  /** 回背誦篩選畫面 */
  onExit: () => void
}

type Stage = 'copy' | 'between' | 'recall' | 'result'
/**
 * typing：抄寫或回想作答中；passed：通過，等待進下一題；
 * recopy：回想答錯或「不會」後，須再抄一次正確單字
 */
type Step = 'typing' | 'passed' | 'recopy'

/** 輸入差異：null 表示差異過大，只顯示正確答案 */
type Feedback = { diff: DiffPart[] | null } | null

function diffFor(input: string, card: WritingCard): DiffPart[] | null {
  return buildAnswerDiff(input, fillDiffTarget(input, card.term, card.reading))
}

/** 書寫練習（技術規格 v5 第六節 4.）：先抄寫整輪，再看中文憑記憶打出外文 */
export function WritingPractice({ cards, pronunciationPrefs, onRestart, onExit }: WritingPracticeProps) {
  const [stage, setStage] = useState<Stage>('copy')
  const [step, setStep] = useState<Step>('typing')
  const [copyIdx, setCopyIdx] = useState(0)
  const [recall, setRecall] = useState<RecallQueue>(() => createRecallQueue([]))
  // 計時器回呼取最新佇列用，與 state 同步更新
  const recallRef = useRef(recall)
  /** 通過時顯示的標示：回想第一次作答答對為「答對」，其餘為「通過」 */
  const [passLabel, setPassLabel] = useState('通過')
  const [input, setInput] = useState('')
  const [feedback, setFeedback] = useState<Feedback>(null)
  /** 回想答錯時的輸入（顯示紅字用），「不會」則為 null */
  const [wrongInput, setWrongInput] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const composingRef = useRef(false)
  const timerRef = useRef<number | null>(null)

  const byId = useMemo(() => new Map(cards.map((c) => [c.word_id, c])), [cards])
  const recallId = currentRecallId(recall)
  const card =
    stage === 'copy' ? cards[copyIdx] : stage === 'recall' && recallId ? byId.get(recallId) : undefined
  /** 回想段作答中不顯示單字與第二層 */
  const revealed = stage === 'copy' || step !== 'typing'

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
  }, [])

  const speakEn = useSpeaker('en')
  const speakJa = useSpeaker('ja')
  const speakKo = useSpeaker('ko')
  const [autoSpeak] = useAutoSpeak()
  const speakCard = useCallback(
    (c: WritingCard | undefined) => {
      if (!c) return
      const speak = c.language === 'ja' ? speakJa : c.language === 'ko' ? speakKo : speakEn
      speak?.(speechText(c.term, c.reading, c.language))
    },
    [speakEn, speakJa, speakKo]
  )

  // 自動播放：抄寫段每張卡出現時唸一次（回想段在答對時唸）
  useEffect(() => {
    if (stage === 'copy' && autoSpeak) speakCard(cards[copyIdx])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, copyIdx, autoSpeak])

  // 鍵盤 S 發音；輸入框取得焦點時停用。回想段作答中不提供發音
  useEffect(() => {
    if (stage !== 'copy' && stage !== 'recall') return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 's' && e.key !== 'S') return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (!revealed) return
      e.preventDefault()
      speakCard(card)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stage, revealed, card, speakCard])

  // 每題出現時清空並聚焦；整輪共用同一個輸入框且焦點不離開，手機鍵盤不會每題收起。
  // 程式呼叫 focus() 在手機上叫不出已收起的鍵盤，所以重點是一開始就別讓輸入框失去焦點
  const resetInput = useCallback(() => {
    setInput('')
    setFeedback(null)
    composingRef.current = false
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  function updateRecall(next: RecallQueue) {
    recallRef.current = next
    setRecall(next)
  }

  function later(fn: () => void, ms: number) {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(fn, ms)
  }

  function nextCopy() {
    setStep('typing')
    if (copyIdx + 1 >= cards.length) {
      setStage('between')
      return
    }
    setCopyIdx((i) => i + 1)
    resetInput()
  }

  function startRecall() {
    const lastCopied = cards[cards.length - 1]?.word_id ?? null
    updateRecall(createRecallQueue(buildRecallOrder(cards.map((c) => c.word_id), lastCopied)))
    setStage('recall')
    setStep('typing')
    setWrongInput(null)
    resetInput()
  }

  function nextRecall() {
    const next = advanceRecall(recallRef.current)
    updateRecall(next)
    setStep('typing')
    setWrongInput(null)
    if (isRecallDone(next)) {
      setStage('result')
      return
    }
    resetInput()
  }

  /** 第一次回想的結果立即寫入 card_familiarity（同滑卡模式，中途離開也保留已作答的字） */
  function judgeRecall(correct: boolean) {
    if (!card) return
    if (isFirstRecall(recallRef.current)) {
      void fetch('/api/cards/familiarity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word_id: card.word_id, familiarity: correct ? 'known' : 'unknown' }),
      })
    }
    updateRecall(answerRecall(recallRef.current, correct ? 'correct' : 'wrong'))
  }

  /** 抄寫段與再抄：一致即通過（組字結束後才比對），不一致不顯示錯誤 */
  function autoCheck(value: string) {
    if (!card || step === 'passed') return
    if (stage === 'copy' && step === 'typing') {
      if (isWritingMatch(card.language, value, card.term, card.reading)) {
        setStep('passed')
        setPassLabel('通過')
        setFeedback(null)
        later(nextCopy, WRITING_COPY_PASS_MS)
      }
    } else if (stage === 'recall' && step === 'recopy') {
      if (isWritingMatch(card.language, value, card.term, card.reading)) {
        setStep('passed')
        setPassLabel('通過')
        setFeedback(null)
        later(nextRecall, WRITING_COPY_PASS_MS)
      }
    }
  }

  /** Enter／「確認」 */
  function submit() {
    if (!card || step === 'passed' || !input.trim()) return
    const ok = isWritingMatch(card.language, input, card.term, card.reading)

    if (stage === 'recall' && step === 'typing') {
      judgeRecall(ok)
      if (ok) {
        setStep('passed')
        setPassLabel('答對')
        if (autoSpeak) speakCard(card)
        later(nextRecall, WRITING_RECALL_CORRECT_MS)
      } else {
        setWrongInput(input)
        setStep('recopy')
        setInput('')
        setFeedback(null)
      }
      return
    }

    if (ok) {
      autoCheck(input)
      return
    }
    setFeedback({ diff: diffFor(input, card) })
  }

  function skipCopy() {
    if (step === 'passed') return
    nextCopy()
  }

  function giveUp() {
    if (!card || step !== 'typing') return
    judgeRecall(false)
    setWrongInput(null)
    setStep('recopy')
    setInput('')
    setFeedback(null)
    inputRef.current?.focus()
  }

  if (stage === 'between') {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <h2 className="font-serif font-black text-2xl mb-3">抄寫完成</h2>
        <p className="text-sm text-ink-soft mb-6">
          接下來只看中文，憑記憶打出 {cards.length} 個單字。
        </p>
        <button
          type="button"
          autoFocus
          onClick={startRecall}
          className="bg-stamp-red text-cream font-bold px-8 py-3 rounded-sm text-[15px] hover:bg-stamp-red-deep"
        >
          開始回想
        </button>
        <button type="button" onClick={onExit} className="mt-5 text-sm text-ink-soft underline">
          結束練習
        </button>
      </div>
    )
  }

  if (stage === 'result') {
    const summary = summarizeRecall(recall, cards.map((c) => c.word_id))
    return (
      <div className="flex flex-col items-center py-10">
        <h2 className="font-serif font-black text-2xl mb-3">本輪書寫結束</h2>
        <p className="font-mono text-sm text-ink-soft mb-6">
          第一次回想答對 {summary.correct} / {summary.total}
        </p>
        <ul className="w-[420px] max-w-full border border-line rounded-[5px] bg-cream divide-y divide-line mb-6">
          {summary.results.map((r) => {
            const c = byId.get(r.word_id)!
            const ok = r.outcome === 'correct'
            return (
              <li key={r.word_id} className="flex items-start gap-3 px-4 py-3">
                <span
                  className={`font-bold text-sm shrink-0 w-10 ${ok ? 'text-good' : 'text-stamp-red-deep'}`}
                >
                  {ok ? '答對' : '答錯'}
                </span>
                <div className="min-w-0">
                  <div lang={c.language} className="font-serif font-bold text-[17px] break-words">
                    {c.term}
                  </div>
                  <TermSecondLine
                    language={c.language}
                    word={c}
                    show={pronunciationPrefs[c.language]}
                    className="text-[12.5px]"
                  />
                  <div className="text-[13px] text-ink-soft mt-0.5">{c.answer}</div>
                </div>
              </li>
            )
          })}
        </ul>
        <div className="flex gap-3 flex-wrap justify-center">
          <button
            type="button"
            onClick={onExit}
            className="border border-line bg-cream px-5 py-2.5 rounded-sm text-sm font-medium"
          >
            回背誦
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="bg-stamp-red text-cream px-5 py-2.5 rounded-sm text-sm font-bold hover:bg-stamp-red-deep"
          >
            再練一輪
          </button>
        </div>
      </div>
    )
  }

  if (!card) return null

  const total = cards.length
  const progress =
    stage === 'copy'
      ? `抄寫 ${copyIdx + 1} / ${total}`
      : recall.index < total
        ? `回想 ${recall.index + 1} / ${total}`
        : `再一次 ${recall.index - total + 1} / ${recall.queue.length - total}`

  const hint =
    stage === 'copy'
      ? '照著打出單字，一致就會自動通過'
      : step === 'typing'
        ? '憑記憶打出單字，按 Enter 或「確認」核對'
        : step === 'recopy'
          ? '再抄一次正確的單字'
          : ''

  return (
    <div className="flex flex-col items-center py-5">
      <div className="font-mono text-xs text-ink-soft mb-4">{progress}</div>

      <div className="w-[420px] max-w-full rounded-lg border border-line bg-cream px-6 py-7 text-center">
        {revealed ? (
          <>
            <div className="flex items-center justify-center gap-2">
              <span lang={card.language} className="font-serif font-black text-[28px] break-words">
                {card.term}
              </span>
              <SpeakButton term={card.term} reading={card.reading} language={card.language} size="sm" keepFocus />
            </div>
            <TermSecondLine language={card.language} word={card} show={pronunciationPrefs[card.language]} />
            <div className="mt-3 text-[15px]">{card.answer}</div>
            {stage === 'copy' && card.description && (
              <p className="text-[12.5px] text-ink-soft mt-2 line-clamp-3 whitespace-pre-wrap">
                {card.description}
              </p>
            )}
          </>
        ) : (
          <div className="text-[18px] font-medium py-4">{card.answer}</div>
        )}

        {stage === 'recall' && step === 'recopy' && (
          <p className="mt-3 text-sm text-stamp-red-deep">
            {wrongInput !== null ? (
              <>
                {(() => {
                  const diff = diffFor(wrongInput, card)
                  return diff ? (
                    <>
                      你的輸入：<AnswerDiff diff={diff} />
                    </>
                  ) : (
                    <>答錯了</>
                  )
                })()}
              </>
            ) : (
              '正確答案如上'
            )}
          </p>
        )}
      </div>

      <div className="w-[420px] max-w-full mt-5">
        <input
          ref={inputRef}
          lang={card.language}
          value={input}
          // 通過後到下一題前忽略輸入；不用 readOnly，焦點中的輸入框變成唯讀會讓手機鍵盤收起
          aria-readonly={step === 'passed'}
          autoFocus
          onChange={(e) => {
            if (step === 'passed') return
            setInput(e.target.value)
            if (!composingRef.current && !(e.nativeEvent as InputEvent).isComposing) {
              autoCheck(e.target.value)
            }
          }}
          onCompositionStart={() => {
            composingRef.current = true
          }}
          onCompositionEnd={(e) => {
            composingRef.current = false
            autoCheck(e.currentTarget.value)
          }}
          onKeyDown={(e) => {
            if (
              shouldSubmitOnEnter({
                key: e.key,
                isComposing: e.nativeEvent.isComposing,
                keyCode: e.nativeEvent.keyCode,
              })
            ) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={stage === 'recall' && step === 'typing' ? '打出這個意思的單字…' : '照著打出單字…'}
          aria-label="輸入單字"
          className={`w-full border-[1.5px] rounded-[5px] px-3.5 py-3 text-[15px] text-center font-mono bg-white focus:outline-none ${
            step === 'passed' ? 'border-good' : 'border-line focus:border-ink'
          }`}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
        />

        <div className="min-h-[24px] mt-2 text-center text-sm" aria-live="polite">
          {step === 'passed' ? (
            <span className="font-bold text-good">✓ {passLabel}</span>
          ) : feedback ? (
            feedback.diff ? (
              <span className="text-stamp-red-deep">
                還不一致：<AnswerDiff diff={feedback.diff} />
              </span>
            ) : (
              <span className="text-stamp-red-deep">還不一致，請對照上方單字</span>
            )
          ) : (
            <span className="text-[12px] text-ink-soft">{hint}</span>
          )}
        </div>

        <div className="flex gap-3 mt-3">
          {stage === 'copy' && (
            <button
              type="button"
              // 不讓按鈕搶走輸入框焦點，手機鍵盤才不會收起
              onMouseDown={(e) => e.preventDefault()}
              onClick={skipCopy}
              disabled={step === 'passed'}
              className="flex-1 border border-line bg-cream py-3 rounded-[5px] text-sm font-medium disabled:opacity-60"
            >
              跳過
            </button>
          )}
          {stage === 'recall' && step === 'typing' && (
            <button
              type="button"
              // 不讓按鈕搶走輸入框焦點，手機鍵盤才不會收起
              onMouseDown={(e) => e.preventDefault()}
              onClick={giveUp}
              className="flex-1 bg-cream border-[1.5px] border-stamp-red text-stamp-red-deep py-3 rounded-[5px] text-sm font-bold"
            >
              不會
            </button>
          )}
          <button
            type="button"
            // 不讓按鈕搶走輸入框焦點，手機鍵盤才不會收起
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              submit()
              inputRef.current?.focus()
            }}
            disabled={step === 'passed' || !input.trim()}
            className="flex-1 bg-stamp-red text-cream font-bold py-3 rounded-[5px] text-sm hover:bg-stamp-red-deep disabled:opacity-60"
          >
            確認
          </button>
        </div>
      </div>

      <button type="button" onClick={onExit} className="mt-6 text-[12.5px] text-ink-soft hover:text-ink">
        結束練習
      </button>
    </div>
  )
}
