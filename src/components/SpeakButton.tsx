'use client'

import { speechText } from '@/lib/speech'
import { useSpeaker } from '@/lib/use-speech'
import type { Language } from '@/types/vocab'

interface SpeakButtonProps {
  term: string
  reading?: string | null
  language: Language
  size?: 'sm' | 'md'
  className?: string
  /** 直接指定要唸的文字（如整句例句）；未指定時依 term／reading 決定 */
  text?: string
  label?: string
  /** 點擊時不搶走輸入框焦點（書寫練習：避免手機鍵盤收起） */
  keepFocus?: boolean
}

/** 單字發音按鈕；裝置沒有該語言語音時不顯示 */
export function SpeakButton({
  term,
  reading,
  language,
  size = 'md',
  className = '',
  text,
  label,
  keepFocus = false,
}: SpeakButtonProps) {
  const speak = useSpeaker(language)
  if (!speak) return null

  const dim = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9'
  const icon = size === 'sm' ? 14 : 18

  return (
    <button
      type="button"
      aria-label={label ?? `播放「${term}」的發音`}
      title="播放發音"
      // 卡片本身可拖曳或點擊翻面，按鈕事件不往上傳
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onMouseDown={keepFocus ? (e) => e.preventDefault() : undefined}
      onKeyDown={(e) => {
        // 只攔 Enter／空白鍵，避免連帶觸發卡片翻面；其他快捷鍵照常
        if (e.key === 'Enter' || e.key === ' ') e.stopPropagation()
      }}
      onClick={(e) => {
        e.stopPropagation()
        speak(text ?? speechText(term, reading, language))
      }}
      className={`inline-flex items-center justify-center rounded-full border border-line bg-cream text-ink-soft hover:text-ink hover:border-ink shrink-0 ${dim} ${className}`}
    >
      <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M11 5 6 9H2v6h4l5 4V5z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M18.5 5.5a9 9 0 0 1 0 13" />
      </svg>
    </button>
  )
}
