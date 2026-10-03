interface StampProps {
  label: string
  /** 進場動畫（prefers-reduced-motion 時由 CSS 關閉） */
  animate?: boolean
  size?: 'sm' | 'lg'
}

/** 朱紅圓形印章，用於成長回饋時刻（附錄 A 5.） */
export function Stamp({ label, animate = false, size = 'sm' }: StampProps) {
  const dims =
    size === 'lg'
      ? 'w-[96px] h-[96px] text-[20px] border-[4px]'
      : 'w-[52px] h-[52px] text-[12px] border-[2.5px]'
  return (
    <span
      className={`stamp ${animate ? 'stamp-enter' : ''} inline-flex items-center justify-center rounded-full border-stamp-red text-stamp-red font-serif font-black tracking-[0.08em] select-none shrink-0 ${dims}`}
      aria-label={label}
    >
      {label}
    </span>
  )
}
