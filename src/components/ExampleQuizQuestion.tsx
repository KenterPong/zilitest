'use client'

import { useEffect, useRef, useState } from 'react'

import { ChunkBoard, type ChunkBoardStatus, type ChunkTile } from '@/components/ChunkBoard'
import { ExampleSentence } from '@/components/ExampleSentence'
import { SpeakButton } from '@/components/SpeakButton'
import { TermSecondLine } from '@/components/TermSecondLine'
import { isReorderCorrect } from '@/lib/example'
import { joinSentence } from '@/lib/example-quiz'
import { normalizeAnswer } from '@/lib/answer-match'
import type { PronunciationPrefs } from '@/lib/pronunciation-display'
import { exampleSpeechText } from '@/lib/speech'
import type { ExampleQuestionType, QuizQuestion } from '@/types/quiz'
import type { Language } from '@/types/vocab'

/** 送出給 complete API 的作答內容（伺服器依資料庫重新判定） */
export interface ExampleAnswerDraft {
  word_id: string
  user_says_true?: boolean
  display_sentence?: string
  selected_answer?: string
  chunk_texts?: string[]
}

/** 作答後的結果：對錯與作答內容，按「下一題」才送出 */
type Outcome = { correct: boolean; draft: ExampleAnswerDraft }

/**
 * 自由練習例句題（技術規格 v5 第五節 9.）的單題作答：作答後立即顯示對錯與完整例句，
 * 對錯以出題時附帶的正解判斷（2026/10/31 定案），成績仍以伺服器判定為準
 */
export function ExampleQuizQuestion({
  type,
  question,
  pronunciationPrefs,
  disabled,
  isLast,
  onNext,
}: {
  type: ExampleQuestionType
  question: QuizQuestion
  pronunciationPrefs: PronunciationPrefs
  disabled: boolean
  isLast: boolean
  onNext: (draft: ExampleAnswerDraft) => void
}) {
  const language = question.language as Language
  const reveal = question.reveal!
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [filled, setFilled] = useState<ChunkTile[]>([])
  const filledRef = useRef<ChunkTile[]>([])

  function setFilledBoth(next: ChunkTile[]) {
    filledRef.current = next
    setFilled(next)
  }

  function answerChoice(term: string) {
    if (outcome) return
    setSelected(term)
    setOutcome({
      correct: normalizeAnswer(term) === normalizeAnswer(question.correct_term ?? ''),
      draft: { word_id: question.word_id, selected_answer: term },
    })
  }

  function answerTf(saysTrue: boolean) {
    if (outcome || !question.sentence) return
    const shown = joinSentence(question.sentence)
    setOutcome({
      correct: saysTrue === (shown === reveal.example),
      draft: { word_id: question.word_id, user_says_true: saysTrue, display_sentence: shown },
    })
  }

  function pick(tile: ChunkTile) {
    if (outcome || filledRef.current.some((t) => t.id === tile.id)) return
    const next = [...filledRef.current, tile]
    setFilledBoth(next)
    const total = question.chunks?.length ?? 0
    if (next.length < total) return
    // 全部填入時判定一次；答錯不重作（第五節 9.）
    const texts = next.map((t) => t.text)
    setOutcome({
      correct: isReorderCorrect(question.correct_chunks ?? [], texts),
      draft: { word_id: question.word_id, chunk_texts: texts },
    })
  }

  function unpick(id: number) {
    if (outcome) return
    setFilledBoth(filledRef.current.filter((t) => t.id !== id))
  }

  // 例句重組：Backspace 退回最後一塊
  useEffect(() => {
    if (type !== 'example_reorder' || outcome) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Backspace') return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      e.preventDefault()
      const last = filledRef.current[filledRef.current.length - 1]
      if (last) unpick(last.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // unpick 只讀 ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, outcome])

  const verdict = outcome && (
    <span className={`font-bold ${outcome.correct ? 'text-good' : 'text-stamp-red-deep'}`}>
      {outcome.correct ? '✓ 答對' : '✗ 答錯'}
    </span>
  )

  return (
    <div>
      {type === 'example_choice' && question.sentence && (
        <>
          <p lang={language} className="font-serif text-[18px] leading-relaxed text-center mb-5">
            {question.sentence.before}
            <span className="inline-block min-w-[3em] border-b-2 border-ink mx-0.5" aria-label="空格">
              &nbsp;
            </span>
            {question.sentence.after}
          </p>
          <div className="flex flex-col gap-2">
            {question.example_options?.map((opt, i) => {
              const isAnswer = outcome && normalizeAnswer(opt.term) === normalizeAnswer(question.correct_term ?? '')
              const isPicked = selected === opt.term
              const tone = outcome
                ? isAnswer
                  ? 'border-good bg-good-bg'
                  : isPicked
                    ? 'border-stamp-red bg-warn-bg'
                    : 'border-line bg-paper opacity-60'
                : 'border-line bg-paper hover:border-stamp-red'
              return (
                <button
                  key={`${question.word_id}-${i}`}
                  type="button"
                  disabled={!!outcome || disabled}
                  onClick={() => answerChoice(opt.term)}
                  className={`block w-full text-left px-3.5 py-2.5 border rounded-md text-sm ${tone}`}
                >
                  <span lang={language} className="font-serif font-bold text-[15px]">
                    {String.fromCharCode(65 + i)}. {opt.term}
                  </span>
                  <TermSecondLine
                    language={language}
                    word={opt}
                    show={pronunciationPrefs[language]}
                    className="text-xs text-ink-soft ml-5"
                  />
                </button>
              )
            })}
          </div>
        </>
      )}

      {type === 'example_tf' && question.sentence && (
        <>
          <p lang={language} className="font-serif text-[18px] leading-relaxed text-center">
            {question.sentence.before}
            <strong className="font-bold">{question.sentence.mark}</strong>
            {question.sentence.after}
          </p>
          <div className="text-[14px] text-center mt-3 mb-5 p-3 bg-paper-deep rounded-md">
            中文翻譯：<b>{reveal.example_translation}</b>
          </div>
          <div className="flex gap-2.5">
            <button
              type="button"
              disabled={!!outcome || disabled}
              onClick={() => answerTf(true)}
              className="flex-1 py-2.5 rounded-sm font-bold text-sm border-[1.5px] border-good text-good disabled:opacity-60"
            >
              相符
            </button>
            <button
              type="button"
              disabled={!!outcome || disabled}
              onClick={() => answerTf(false)}
              className="flex-1 py-2.5 rounded-sm font-bold text-sm border-[1.5px] border-stamp-red text-stamp-red-deep disabled:opacity-60"
            >
              不相符
            </button>
          </div>
        </>
      )}

      {type === 'example_reorder' && question.chunks && (
        <>
          <div className="flex items-start justify-center gap-2 mb-5">
            <p className="text-[17px] font-medium text-center leading-snug">{reveal.example_translation}</p>
            <SpeakButton
              term={reveal.example}
              language={language}
              size="sm"
              text={exampleSpeechText(reveal.example, reveal.example_tts, language)}
              label="播放例句"
            />
          </div>
          <ChunkBoard
            language={language}
            tiles={question.chunks}
            filled={filled}
            status={(outcome ? (outcome.correct ? 'passed' : 'wrong') : 'arranging') as ChunkBoardStatus}
            showReading={language === 'ja' && pronunciationPrefs.ja}
            message={verdict ?? <span className="text-[12px] text-ink-soft">看翻譯，依序點選詞塊排回原句</span>}
            onPick={pick}
            onUnpick={unpick}
          />
        </>
      )}

      {outcome && (
        <div className="mt-5 pt-4 border-t border-dashed border-line" aria-live="polite">
          {type !== 'example_reorder' && <div className="text-sm mb-2">{verdict}</div>}
          <div lang={language}>
            <ExampleSentence word={reveal} term={reveal.example} language={language} />
          </div>
          <button
            type="button"
            autoFocus
            disabled={disabled}
            onClick={() => onNext(outcome.draft)}
            className="mt-4 w-full bg-ink text-cream font-bold py-2.5 rounded-md text-sm disabled:opacity-60"
          >
            {isLast ? '看結果' : '下一題'}
          </button>
        </div>
      )}
    </div>
  )
}
