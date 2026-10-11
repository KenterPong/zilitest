'use client'

import { useAutoSpeak } from '@/lib/use-speech'

/** 設定頁：自動播放發音開關（只存在這台裝置） */
export function AutoSpeakToggle() {
  const [on, setOn] = useAutoSpeak()
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => setOn(e.target.checked)}
        className="mt-1 w-4 h-4 accent-[var(--ink)]"
      />
      <span className="text-sm">
        <span className="font-semibold text-ink">自動播放發音</span>
        <span className="block text-ink-soft text-[12.5px]">
          每日任務與背誦的新卡片出現時自動唸一次（填空題在翻開答案後才唸）。這個設定只存在這台裝置，換手機或電腦要再設定一次。
        </span>
      </span>
    </label>
  )
}
