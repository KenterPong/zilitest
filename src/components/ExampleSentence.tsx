'use client'

import { SpeakButton } from '@/components/SpeakButton'
import { splitAtTarget } from '@/lib/example'
import { exampleSpeechText } from '@/lib/speech'
import type { ExampleFields, Language } from '@/types/vocab'

/** 至少有例句文字才顯示 */
export function hasExample(w: ExampleFields): w is ExampleFields & { example: string } {
  return !!w.example?.trim()
}

/**
 * 例句區塊（第十三節 3.）：例句（目標字粗體）+ 整句播放 + 中文翻譯；AI 造句標示「AI 例句」。
 * compact 用於空間有限的卡片，限制行數
 */
export function ExampleSentence({
  word,
  term,
  language,
  compact = false,
  className = '',
}: {
  word: ExampleFields
  term: string
  language: Language
  compact?: boolean
  className?: string
}) {
  if (!hasExample(word)) return null
  const { before, target, after } = splitAtTarget(word.example, word.example_target)

  return (
    <div className={`text-left ${className}`}>
      <div className="flex items-start gap-2">
        <p className={`flex-1 min-w-0 leading-snug ${compact ? 'text-[13px] line-clamp-3' : 'text-[14px]'}`}>
          {before}
          {target && <strong className="font-bold">{target}</strong>}
          {after}
          {word.example_source === 'generated' && (
            <span className="ml-1.5 font-mono text-[10.5px] text-ink-soft border border-line rounded-sm px-1 whitespace-nowrap">
              AI 例句
            </span>
          )}
        </p>
        <SpeakButton
          term={term}
          language={language}
          size="sm"
          text={exampleSpeechText(word.example, word.example_tts, language)}
          label="播放例句"
        />
      </div>
      {word.example_translation && (
        <p className={`text-ink-soft mt-1 leading-snug ${compact ? 'text-[12px] line-clamp-2' : 'text-[12.5px]'}`}>
          {word.example_translation}
        </p>
      )}
    </div>
  )
}
