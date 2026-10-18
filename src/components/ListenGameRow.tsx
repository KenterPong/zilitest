'use client'

import Link from 'next/link'

import { LISTEN_CHOICES } from '@/lib/games'
import { useVoiceStatus } from '@/lib/use-speech'
import { LANGUAGE_LABELS, type Language } from '@/types/vocab'

interface ListenGameRowProps {
  language: Language
  total: number
  best: number | undefined
  frozen: boolean
}

/** 遊戲列表的聽音辨字一列：語音要在瀏覽器判斷，不能開始時顯示原因（不隱藏） */
export function ListenGameRow({ language, total, best, frozen }: ListenGameRowProps) {
  const label = LANGUAGE_LABELS[language]
  const voice = useVoiceStatus(language)

  let action: React.ReactNode = null
  if (frozen) action = null
  else if (total < LISTEN_CHOICES)
    action = (
      <span className="text-[12.5px] text-ink-soft">
        至少需要 {LISTEN_CHOICES} 個單字（目前 {total} 個）
      </span>
    )
  else if (voice === 'loading') action = <span className="text-[12.5px] text-ink-soft">檢查語音中…</span>
  else if (voice === 'none') action = <span className="text-[12.5px] text-ink-soft">這台裝置沒有{label}語音</span>
  else
    action = (
      <Link
        href={`/app/games/listen?lang=${language}`}
        className="bg-ink text-cream font-semibold text-sm px-5 py-2.5 rounded-[5px] hover:bg-stamp-red-deep"
      >
        開始聽音
      </Link>
    )

  return (
    <li className="flex items-center justify-between gap-4 py-3 flex-wrap">
      <div>
        <div className="font-serif font-bold">{label}</div>
        <div className="font-mono text-[11.5px] text-ink-soft">
          {best !== undefined ? `個人最佳 ${best} 題` : '還沒有紀錄'}
        </div>
      </div>
      {action}
    </li>
  )
}
