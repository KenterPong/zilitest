'use client'

import { forwardRef, useImperativeHandle, useRef, useState } from 'react'

import { ExampleSentence, hasExample } from '@/components/ExampleSentence'
import { SpeakButton } from '@/components/SpeakButton'
import { TermSecondLine } from '@/components/TermSecondLine'
import { isTap, swipeDecision, swipeHintOpacity, type SwipeChoice } from '@/lib/swipe'
import type { ExampleFields, Language } from '@/types/vocab'

export interface SwipeCardHandle {
  fly: (choice: SwipeChoice) => void
  flip: () => void
}

interface SwipeCardProps {
  term: string
  reading: string | null
  pronunciation: string | null
  answer: string
  description: string | null
  /** 背面顯示的例句 */
  example?: ExampleFields
  language: Language
  /** 該語言的 show_pronunciation */
  showPronunciation: boolean
  onDecide: (choice: SwipeChoice) => void
}

/** 飛出時間 */
const FLY_MS = 260

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** 卡牌背誦的單字卡：點擊翻面，右滑認得、左滑不認得 */
export const SwipeCard = forwardRef<SwipeCardHandle, SwipeCardProps>(function SwipeCard(
  { term, reading, pronunciation, answer, description, example, language, showPronunciation, onDecide },
  ref
) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; y: number; width: number } | null>(null)
  const [dx, setDx] = useState(0)
  const [dy, setDy] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [flying, setFlying] = useState<SwipeChoice | null>(null)
  const [flipped, setFlipped] = useState(false)

  function fly(choice: SwipeChoice) {
    if (flying) return
    if (prefersReducedMotion()) {
      onDecide(choice)
      return
    }
    setFlying(choice)
    window.setTimeout(() => onDecide(choice), FLY_MS)
  }

  useImperativeHandle(ref, () => ({ fly, flip: () => setFlipped((f) => !f) }))

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (flying) return
    const width = wrapRef.current?.getBoundingClientRect().width ?? 320
    start.current = { x: e.clientX, y: e.clientY, width }
    setDragging(true)
    try {
      // 拖出卡片範圍也持續收到移動事件；指標已結束時部分瀏覽器會丟錯，忽略即可
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {}
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging || !start.current) return
    setDx(e.clientX - start.current.x)
    setDy(e.clientY - start.current.y)
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging || !start.current) return
    const finalDx = e.clientX - start.current.x
    const finalDy = e.clientY - start.current.y
    const width = start.current.width
    start.current = null
    setDragging(false)
    if (isTap(finalDx, finalDy)) {
      setDx(0)
      setDy(0)
      setFlipped((f) => !f)
      return
    }
    const choice = swipeDecision(finalDx, width)
    setDx(0)
    setDy(0)
    if (choice) fly(choice)
  }

  const width = wrapRef.current?.getBoundingClientRect().width ?? 320
  let transform = `translate(${dx}px, ${dy * 0.15}px) rotate(${dx / 18}deg)`
  let opacity = 1
  if (flying) {
    const dir = flying === 'known' ? 1 : -1
    transform = `translate(${dir * 140}%, 0) rotate(${dir * 18}deg)`
    opacity = 0
  }
  const hint = flying ? 1 : swipeHintOpacity(dx, width)
  const withExample = !!example && hasExample(example)
  const showKnown = flying === 'known' || (!flying && dx > 0)
  const showUnknown = flying === 'unknown' || (!flying && dx < 0)

  return (
    <div
      ref={wrapRef}
      role="button"
      tabIndex={-1}
      aria-label={`${term}，點擊翻面，右滑認得、左滑不認得`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`card-3d relative ${withExample ? 'h-[310px]' : 'h-[250px]'} select-none cursor-grab active:cursor-grabbing touch-pan-y`}
      style={{
        transform,
        opacity,
        transition: dragging ? 'none' : `transform ${FLY_MS}ms ease, opacity ${FLY_MS}ms ease`,
      }}
    >
      <div className={`card-inner ${flipped ? 'is-flipped' : ''}`}>
        <div className="card-face card-ruled rounded-lg border border-line shadow-[0_10px_28px_rgba(30,42,64,0.10)] flex flex-col items-center justify-center text-center px-6">
          <div className="flex items-center gap-2.5">
            <div className="font-serif font-black text-[34px] leading-tight break-words">{term}</div>
            <SpeakButton term={term} reading={reading} language={language} />
          </div>
          <TermSecondLine language={language} word={{ term, reading, pronunciation }} show={showPronunciation} />
          <div className="font-mono text-[11px] text-ink-soft mt-4">點卡片翻面</div>
        </div>
        <div className="card-face card-back card-ruled rounded-lg border border-line shadow-[0_10px_28px_rgba(30,42,64,0.10)] flex flex-col items-center justify-center text-center px-6">
          <div className="flex items-center gap-2.5">
            <div className="font-serif font-bold text-[26px] leading-tight break-words">{term}</div>
            <SpeakButton term={term} reading={reading} language={language} />
          </div>
          <TermSecondLine
            language={language}
            word={{ term, reading, pronunciation }}
            show={showPronunciation}
            className="text-sm"
          />
          <div className="text-lg mt-2">{answer}</div>
          {description && (
            <p
              className={`text-[12.5px] text-ink-soft mt-2 whitespace-pre-wrap ${withExample ? 'line-clamp-2' : 'line-clamp-3'}`}
            >
              {description}
            </p>
          )}
          {withExample && (
            <ExampleSentence
              word={example}
              term={term}
              language={language}
              compact
              className="w-full mt-3 pt-3 border-t border-line"
            />
          )}
        </div>
      </div>

      {/* 滑動提示章：跟著拖曳距離浮現 */}
      {showKnown && (
        <span
          className="stamp absolute top-5 left-5 inline-flex items-center justify-center w-[64px] h-[64px] rounded-full border-[2.5px] border-good text-good font-serif font-black text-[14px] pointer-events-none"
          style={{ opacity: hint }}
          aria-hidden
        >
          認得
        </span>
      )}
      {showUnknown && (
        <span
          className="stamp absolute top-5 right-5 inline-flex items-center justify-center w-[64px] h-[64px] rounded-full border-[2.5px] border-stamp-red text-stamp-red font-serif font-black text-[13px] pointer-events-none"
          style={{ opacity: hint }}
          aria-hidden
        >
          不認得
        </span>
      )}
    </div>
  )
})
