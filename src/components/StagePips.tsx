import { MASTERED_STAGE, MAX_STAGE } from '@/lib/progress'

/** 熟練度點數：7 格，已掌握（stage ≥ 4）以金色顯示 */
export function StagePips({ stage }: { stage: number }) {
  const mastered = stage >= MASTERED_STAGE
  return (
    <div className="flex items-center gap-[3px]" aria-label={`熟練度 ${stage} / ${MAX_STAGE}`}>
      {Array.from({ length: MAX_STAGE }, (_, i) => {
        const on = i < stage
        return (
          <span
            key={i}
            className={`w-[7px] h-[7px] rounded-full border ${
              on ? (mastered ? 'bg-gold border-gold' : 'bg-ink border-ink') : 'border-line bg-cream'
            }`}
          />
        )
      })}
    </div>
  )
}
