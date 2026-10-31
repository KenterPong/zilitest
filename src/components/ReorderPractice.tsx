'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ExampleSentence } from '@/components/ExampleSentence'
import { SpeakButton } from '@/components/SpeakButton'
import type { PronunciationPrefs } from '@/lib/pronunciation-display'
import {
  isReorderFilledCorrect,
  REORDER_CORRECT_MS,
  REORDER_PASS_MS,
  REORDER_WRONG_FLASH_MS,
  shuffleChunks,
  type ReorderTile,
} from '@/lib/reorder'
import { exampleSpeechText } from '@/lib/speech'
import { useAutoSpeak, useSpeaker } from '@/lib/use-speech'
import {
  advanceRecall,
  answerRecall,
  buildRecallOrder,
  createRecallQueue,
  currentRecallId,
  isFirstRecall,
  isRecallDone,
  summarizeRecall,
  type RecallQueue,
} from '@/lib/writing'
import type { ExampleChunk, ExampleSource, Language } from '@/types/vocab'

/** 出題前已篩選：example 不為空、詞塊 3–12 塊 */
export interface ReorderCard {
  word_id: string
  term: string
  language: Language
  example: string
  example_translation?: string | null
  example_source?: ExampleSource | null
  example_target?: string | null
  example_tts?: string | null
  example_chunks: ExampleChunk[]
}

interface ReorderPracticeProps {
  cards: ReorderCard[]
  pronunciationPrefs: PronunciationPrefs
  /** 以同一篩選條件重新抽句 */
  onRestart: () => void
  /** 回背誦篩選畫面 */
  onExit: () => void
}

type Stage = 'follow' | 'between' | 'recall' | 'result'
/** arranging：排列中；passed：排對，等待下一句；wrong：排錯，空格短暫標示後詞塊全部退回 */
type Status = 'arranging' | 'passed' | 'wrong'

/** 詞塊文字；日文含漢字的詞塊在上方顯示讀音 */
function ChunkLabel({ tile, showReading }: { tile: ReorderTile; showReading: boolean }) {
  return (
    <span className="flex flex-col items-center leading-tight">
      {showReading && tile.reading && (
        <span className="font-sans font-normal text-[10.5px] text-ink-soft">{tile.reading}</span>
      )}
      <span>{tile.text}</span>
    </span>
  )
}

/** 重組練習（技術規格 v5 第六節 5.）：先看著原句跟組整輪，再只看中文翻譯默組 */
export function ReorderPractice({ cards, pronunciationPrefs, onRestart, onExit }: ReorderPracticeProps) {
  const [stage, setStage] = useState<Stage>('follow')
  const [followIdx, setFollowIdx] = useState(0)
  const [recall, setRecall] = useState<RecallQueue>(() => createRecallQueue([]))
  // 計時器回呼取最新佇列用，與 state 同步更新
  const recallRef = useRef(recall)
  const [tiles, setTiles] = useState<ReorderTile[]>(() =>
    cards[0] ? shuffleChunks(cards[0].example_chunks) : []
  )
  const [filled, setFilled] = useState<ReorderTile[]>([])
  const filledRef = useRef<ReorderTile[]>([])
  const [status, setStatus] = useState<Status>('arranging')
  const statusRef = useRef<Status>('arranging')
  /** 默組答錯或「不會」後，看著原句再排一次 */
  const [redo, setRedo] = useState(false)
  /** 排對時的標示：默組第一次排對為「答對」，其餘為「通過」 */
  const [passLabel, setPassLabel] = useState('通過')
  /** 排錯時的提示：默組第一次答錯要求看著原句再排，其餘為一般排錯 */
  const [wrongLabel, setWrongLabel] = useState('順序不對，再排一次')
  const timerRef = useRef<number | null>(null)

  const byId = useMemo(() => new Map(cards.map((c) => [c.word_id, c])), [cards])
  const recallId = currentRecallId(recall)
  const card =
    stage === 'follow' ? cards[followIdx] : stage === 'recall' && recallId ? byId.get(recallId) : undefined
  /** 默組作答中不顯示原例句 */
  const sentenceVisible = stage === 'follow' || redo || status === 'passed'

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
  }, [])

  const speakEn = useSpeaker('en')
  const speakJa = useSpeaker('ja')
  const speakKo = useSpeaker('ko')
  const [autoSpeak] = useAutoSpeak()
  const speakSentence = useCallback(
    (c: ReorderCard | undefined) => {
      if (!c) return
      const speak = c.language === 'ja' ? speakJa : c.language === 'ko' ? speakKo : speakEn
      speak?.(exampleSpeechText(c.example, c.example_tts, c.language))
    },
    [speakEn, speakJa, speakKo]
  )

  // 自動播放：每句出現時念一次整句（跟組與默組皆同）
  useEffect(() => {
    if ((stage === 'follow' || stage === 'recall') && autoSpeak) speakSentence(card)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, followIdx, recall.index, autoSpeak])

  function setFilledBoth(next: ReorderTile[]) {
    filledRef.current = next
    setFilled(next)
  }

  function setStatusBoth(next: Status) {
    statusRef.current = next
    setStatus(next)
  }

  function updateRecall(next: RecallQueue) {
    recallRef.current = next
    setRecall(next)
  }

  function later(fn: () => void, ms: number) {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(fn, ms)
  }

  /** 換句或排錯時：重新打散、清空空格 */
  function setupSentence(c: ReorderCard | undefined) {
    setTiles(c ? shuffleChunks(c.example_chunks) : [])
    setFilledBoth([])
    setStatusBoth('arranging')
  }

  function nextFollow() {
    if (followIdx + 1 >= cards.length) {
      setStage('between')
      return
    }
    setFollowIdx((i) => i + 1)
    setupSentence(cards[followIdx + 1])
  }

  function startRecall() {
    const lastFollowed = cards[cards.length - 1]?.word_id ?? null
    const next = createRecallQueue(buildRecallOrder(cards.map((c) => c.word_id), lastFollowed))
    updateRecall(next)
    setRedo(false)
    setStage('recall')
    setupSentence(byId.get(currentRecallId(next) ?? ''))
  }

  function nextRecall() {
    const next = advanceRecall(recallRef.current)
    updateRecall(next)
    setRedo(false)
    if (isRecallDone(next)) {
      setStage('result')
      return
    }
    setupSentence(byId.get(currentRecallId(next) ?? ''))
  }

  /** 每句第一次默組的結果立即寫入 card_familiarity（同書寫練習，中途離開也保留已作答的字） */
  function judgeRecall(c: ReorderCard, correct: boolean) {
    if (isFirstRecall(recallRef.current)) {
      void fetch('/api/cards/familiarity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word_id: c.word_id, familiarity: correct ? 'known' : 'unknown' }),
      })
    }
    updateRecall(answerRecall(recallRef.current, correct ? 'correct' : 'wrong'))
  }

  /** 排錯：空格短暫標示錯誤，之後詞塊全部退回並重新打散 */
  function flashWrong(c: ReorderCard, label = '順序不對，再排一次') {
    setWrongLabel(label)
    setStatusBoth('wrong')
    later(() => setupSentence(c), REORDER_WRONG_FLASH_MS)
  }

  function judge(next: ReorderTile[]) {
    if (!card) return
    const ok = isReorderFilledCorrect(next, card.example_chunks)

    if (stage === 'recall' && !redo) {
      judgeRecall(card, ok)
      if (ok) {
        setStatusBoth('passed')
        setPassLabel('答對')
        later(nextRecall, REORDER_CORRECT_MS)
      } else {
        setRedo(true)
        flashWrong(card, '答錯了，照著正確例句再排一次')
      }
      return
    }

    if (ok) {
      setStatusBoth('passed')
      setPassLabel('通過')
      later(stage === 'follow' ? nextFollow : nextRecall, REORDER_PASS_MS)
    } else {
      flashWrong(card)
    }
  }

  function pick(tile: ReorderTile) {
    if (!card || statusRef.current !== 'arranging') return
    if (filledRef.current.some((t) => t.id === tile.id)) return
    const next = [...filledRef.current, tile]
    setFilledBoth(next)
    if (next.length === card.example_chunks.length) judge(next)
  }

  /** 點已填入的詞塊退回（後面的詞塊往前補） */
  function unpick(id: number) {
    if (statusRef.current !== 'arranging') return
    setFilledBoth(filledRef.current.filter((t) => t.id !== id))
  }

  function skipFollow() {
    if (statusRef.current !== 'arranging') return
    nextFollow()
  }

  function giveUp() {
    if (!card || redo || statusRef.current !== 'arranging') return
    judgeRecall(card, false)
    setRedo(true)
    setupSentence(card)
  }

  // 鍵盤：Backspace 退回最後一塊；S 播放整句
  useEffect(() => {
    if (stage !== 'follow' && stage !== 'recall') return
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Backspace') {
        e.preventDefault()
        const last = filledRef.current[filledRef.current.length - 1]
        if (last) unpick(last.id)
        return
      }
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        speakSentence(card)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // unpick 只讀 ref，不需列入依賴
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, card, speakSentence])

  if (stage === 'between') {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <h2 className="font-serif font-black text-2xl mb-3">跟組完成</h2>
        <p className="text-sm text-ink-soft mb-6">接下來只看中文翻譯，憑記憶把 {cards.length} 句排回來。</p>
        <button
          type="button"
          autoFocus
          onClick={startRecall}
          className="bg-stamp-red text-cream font-bold px-8 py-3 rounded-sm text-[15px] hover:bg-stamp-red-deep"
        >
          開始默組
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
        <h2 className="font-serif font-black text-2xl mb-3">本輪重組結束</h2>
        <p className="font-mono text-sm text-ink-soft mb-6">
          第一次默組答對 {summary.correct} / {summary.total}
        </p>
        <ul className="w-[520px] max-w-full border border-line rounded-[5px] bg-cream divide-y divide-line mb-6">
          {summary.results.map((r) => {
            const c = byId.get(r.word_id)!
            const ok = r.outcome === 'correct'
            return (
              <li key={r.word_id} className="flex items-start gap-3 px-4 py-3">
                <span className={`font-bold text-sm shrink-0 w-10 ${ok ? 'text-good' : 'text-stamp-red-deep'}`}>
                  {ok ? '答對' : '答錯'}
                </span>
                <div className="min-w-0 flex-1" lang={c.language}>
                  <ExampleSentence word={c} term={c.term} language={c.language} />
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
    stage === 'follow'
      ? `跟組 ${followIdx + 1} / ${total}`
      : recall.index < total
        ? `默組 ${recall.index + 1} / ${total}`
        : `再一次 ${recall.index - total + 1} / ${recall.queue.length - total}`
  const showReading = card.language === 'ja' && pronunciationPrefs.ja
  const usedIds = new Set(filled.map((t) => t.id))
  const remaining = card.example_chunks.length - filled.length

  const message =
    status === 'passed' ? (
      <span className="font-bold text-good">✓ {passLabel}</span>
    ) : status === 'wrong' ? (
      <span className="font-bold text-stamp-red-deep">{wrongLabel}</span>
    ) : (
      <span className="text-[12px] text-ink-soft">
        {stage === 'follow'
          ? '照著例句，依序點選詞塊'
          : redo
            ? '照著正確例句再排一次'
            : '只看翻譯，憑記憶把句子排回來'}
      </span>
    )

  return (
    <div className="flex flex-col items-center py-5">
      <div className="font-mono text-xs text-ink-soft mb-4">{progress}</div>

      <div className="w-[520px] max-w-full rounded-lg border border-line bg-cream px-5 py-6">
        {sentenceVisible ? (
          <div lang={card.language}>
            <ExampleSentence word={card} term={card.term} language={card.language} />
          </div>
        ) : (
          <div className="flex items-start justify-center gap-2 py-2">
            <p className="text-[17px] font-medium text-center leading-snug">{card.example_translation}</p>
            <SpeakButton
              term={card.term}
              language={card.language}
              size="sm"
              text={exampleSpeechText(card.example, card.example_tts, card.language)}
              label="播放例句"
            />
          </div>
        )}
      </div>

      <div className="w-[520px] max-w-full mt-5">
        <div
          lang={card.language}
          aria-label="排好的句子"
          className={`min-h-[60px] flex flex-wrap items-end gap-1.5 rounded-[5px] border-[1.5px] px-2.5 py-2.5 ${
            status === 'wrong'
              ? 'tile-shake border-stamp-red bg-warn-bg'
              : status === 'passed'
                ? 'border-good bg-good-bg'
                : 'border-dashed border-line bg-paper'
          }`}
        >
          {filled.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={status !== 'arranging'}
              onClick={() => unpick(t.id)}
              aria-label={`退回 ${t.text}`}
              className="min-h-10 px-2.5 py-1 rounded-[5px] border-[1.5px] border-ink bg-white font-serif font-bold text-[17px]"
            >
              <ChunkLabel tile={t} showReading={showReading} />
            </button>
          ))}
          {status === 'arranging' &&
            Array.from({ length: remaining }, (_, i) => (
              <span
                key={`slot-${i}`}
                aria-hidden
                className="w-8 h-10 rounded-[5px] border-[1.5px] border-dashed border-line"
              />
            ))}
        </div>

        <div className="min-h-[24px] mt-2 text-center text-sm" aria-live="polite">
          {message}
        </div>

        <div className="flex justify-center flex-wrap gap-2 mt-3" lang={card.language}>
          {tiles.map((t) => {
            const used = usedIds.has(t.id)
            return (
              <button
                key={t.id}
                type="button"
                disabled={used || status !== 'arranging'}
                onClick={() => pick(t)}
                className={`card-ruled min-h-12 px-3 py-1.5 rounded-[5px] border-[1.5px] font-serif font-bold text-[18px] shadow-[0_2px_6px_rgba(30,42,64,0.08)] transition-opacity motion-reduce:transition-none ${
                  used ? 'opacity-25 border-line' : 'border-line hover:border-ink'
                }`}
              >
                <ChunkLabel tile={t} showReading={showReading} />
              </button>
            )
          })}
        </div>

        <div className="flex justify-center mt-6">
          {stage === 'follow' && (
            <button
              type="button"
              onClick={skipFollow}
              disabled={status !== 'arranging'}
              className="bg-cream border border-line text-ink font-semibold text-sm px-6 py-2.5 rounded-[5px] hover:border-ink disabled:opacity-50"
            >
              跳過
            </button>
          )}
          {stage === 'recall' && !redo && (
            <button
              type="button"
              onClick={giveUp}
              disabled={status !== 'arranging'}
              className="bg-cream border-[1.5px] border-stamp-red text-stamp-red-deep font-bold text-sm px-6 py-2.5 rounded-[5px] disabled:opacity-50"
            >
              不會
            </button>
          )}
        </div>
      </div>

      <button type="button" onClick={onExit} className="mt-6 text-[12.5px] text-ink-soft hover:text-ink">
        結束練習
      </button>
    </div>
  )
}
