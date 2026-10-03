import { LANGUAGE_LABELS, type Language } from '@/types/vocab'

export function LanguageBadge({ language }: { language: Language }) {
  return (
    <span className="inline-block font-mono text-[11px] tracking-[0.06em] px-2 py-0.5 rounded-sm border border-line bg-paper-deep text-ink-soft align-middle">
      {LANGUAGE_LABELS[language]}
    </span>
  )
}
