import type { DiffPart } from '@/lib/answer-match'

/** 紅字標記（技術規格 v5 第五節 8.）：拼錯與多餘字母紅色波浪底線，缺少位置以紅色底線符號標示 */
export function AnswerDiff({ diff }: { diff: DiffPart[] }) {
  return (
    <span className="font-mono">
      {diff.map((p, i) => {
        if (p.type === 'ok') return <span key={i}>{p.text}</span>
        if (p.type === 'bad' || p.type === 'extra')
          return (
            <span key={i} className="text-stamp-red font-bold underline decoration-wavy">
              {p.text}
            </span>
          )
        return (
          <span key={i} className="text-stamp-red font-bold">
            {p.text}
          </span>
        )
      })}
    </span>
  )
}
