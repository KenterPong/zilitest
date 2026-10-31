'use client'

import type { ReactNode } from 'react'

import type { Language } from '@/types/vocab'

export interface ChunkTile {
  id: number
  text: string
  reading?: string
}

/** arranging：排列中；passed：排對；wrong：排錯（空格標示錯誤） */
export type ChunkBoardStatus = 'arranging' | 'passed' | 'wrong'

/** 詞塊文字；日文含漢字的詞塊在上方顯示讀音（第十三節 3.） */
function ChunkLabel({ tile, showReading }: { tile: ChunkTile; showReading: boolean }) {
  return (
    <span className="flex flex-col items-center leading-tight">
      {showReading && tile.reading && (
        <span className="font-sans font-normal text-[10.5px] text-ink-soft">{tile.reading}</span>
      )}
      <span>{tile.text}</span>
    </span>
  )
}

/**
 * 詞塊重組的作答區（背誦重組、自由練習例句重組共用）：上方為依序填入的句子，下方為打散的詞塊。
 * 點詞塊填入、點已填入的詞塊退回；判定與換題由使用的元件處理
 */
export function ChunkBoard({
  language,
  tiles,
  filled,
  status,
  showReading,
  message,
  onPick,
  onUnpick,
}: {
  language: Language
  tiles: ChunkTile[]
  filled: ChunkTile[]
  status: ChunkBoardStatus
  showReading: boolean
  /** 作答區下方的提示或結果文字 */
  message: ReactNode
  onPick: (tile: ChunkTile) => void
  onUnpick: (id: number) => void
}) {
  const usedIds = new Set(filled.map((t) => t.id))
  const remaining = tiles.length - filled.length

  return (
    <>
      <div
        lang={language}
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
            onClick={() => onUnpick(t.id)}
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

      <div className="flex justify-center flex-wrap gap-2 mt-3" lang={language}>
        {tiles.map((t) => {
          const used = usedIds.has(t.id)
          return (
            <button
              key={t.id}
              type="button"
              disabled={used || status !== 'arranging'}
              onClick={() => onPick(t)}
              className={`card-ruled min-h-12 px-3 py-1.5 rounded-[5px] border-[1.5px] font-serif font-bold text-[18px] shadow-[0_2px_6px_rgba(30,42,64,0.08)] transition-opacity motion-reduce:transition-none ${
                used ? 'opacity-25 border-line' : 'border-line hover:border-ink'
              }`}
            >
              <ChunkLabel tile={t} showReading={showReading} />
            </button>
          )
        })}
      </div>
    </>
  )
}
