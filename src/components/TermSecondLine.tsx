import { secondLine, type SecondLineSource } from '@/lib/pronunciation-display'
import type { Language } from '@/types/vocab'

interface TermSecondLineProps {
  language: Language
  word: SecondLineSource
  /** 該語言的 show_pronunciation */
  show: boolean
  className?: string
}

/**
 * 單字第二層（技術規格 v5 第十三節 3.）：英文音標、日文讀音、韓文羅馬拼音。
 * --ink-soft、字級比 term 小；英韓用 IBM Plex Mono，日文假名用 Noto Sans TC
 */
export function TermSecondLine({ language, word, show, className = 'text-sm mt-1' }: TermSecondLineProps) {
  const text = secondLine(language, word, show)
  if (!text) return null
  return (
    <div className={`text-ink-soft ${language === 'ja' ? 'font-sans' : 'font-mono'} ${className}`}>{text}</div>
  )
}
