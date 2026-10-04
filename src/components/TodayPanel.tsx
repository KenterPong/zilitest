import Link from 'next/link'

import { Stamp } from '@/components/Stamp'
import type { TodayOverview } from '@/lib/daily-service'
import type { TaskSummary } from '@/types/daily'
import { LANGUAGE_LABELS } from '@/types/vocab'

interface TodayPanelProps {
  overview: TodayOverview
  totalMastered: number
  hasWordbooks: boolean
  frozen: boolean
}

function formatDate(date: string) {
  const [y, m, d] = date.split('-')
  return `${y} / ${m} / ${d}`
}

function TaskRow({ task, primary }: { task: TaskSummary; primary: boolean }) {
  const label = LANGUAGE_LABELS[task.language]

  if (task.status === 'too_few_words') {
    return (
      <li className="flex items-center justify-between gap-4 py-3.5 border-b border-dashed border-line last:border-0">
        <span className="font-serif font-bold">{label}</span>
        <span className="text-[12.5px] text-ink-soft text-right">
          單字不足 4 個（目前 {task.word_count ?? 0} 個），新增單字後才會產生任務
        </span>
      </li>
    )
  }

  if (task.status === 'words_deleted') {
    return (
      <li className="flex items-center justify-between gap-4 py-3.5 border-b border-dashed border-line last:border-0">
        <span className="font-serif font-bold">{label}</span>
        <span className="text-[12.5px] text-ink-soft text-right">
          今日任務的單字已全部刪除，明天會依新的單字重新安排
        </span>
      </li>
    )
  }

  if (task.status === 'nothing_to_do') {
    return (
      <li className="flex items-center justify-between gap-4 py-3.5 border-b border-dashed border-line last:border-0">
        <span className="font-serif font-bold">{label}</span>
        <span className="text-[12.5px] text-ink-soft text-right">
          今天沒有需要複習的字，可以新增單字繼續學習
        </span>
      </li>
    )
  }

  const pct = task.total > 0 ? Math.round((task.answered / task.total) * 100) : 0
  return (
    <li className="flex items-center gap-4 py-3.5 border-b border-dashed border-line last:border-0 flex-wrap">
      <span className="font-serif font-bold w-12">{label}</span>
      <div className="flex-1 min-w-[140px]">
        <div className="h-1.5 rounded-full bg-paper-deep overflow-hidden">
          <div
            className={`h-full ${task.completed ? 'bg-good' : 'bg-ink'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="font-mono text-[11px] text-ink-soft mt-1">
          {task.answered} / {task.total}
        </div>
      </div>
      {task.completed ? (
        <Stamp label="完成" />
      ) : (
        <Link
          href={`/app/daily/${task.language}`}
          className={
            primary
              ? 'bg-stamp-red text-cream font-bold text-sm px-5 py-2.5 rounded-[5px] hover:bg-stamp-red-deep hover:-translate-y-px transition'
              : 'bg-cream border border-line text-ink font-semibold text-sm px-5 py-2.5 rounded-[5px] hover:border-ink'
          }
        >
          {task.answered > 0 ? '繼續' : primary ? '開始今日任務' : '開始'}
        </Link>
      )}
    </li>
  )
}

export function TodayPanel({ overview, totalMastered, hasWordbooks, frozen }: TodayPanelProps) {
  const { tasks, streak, today } = overview
  const firstOpen = tasks.find((t) => t.status === 'ok' && !t.completed)

  return (
    <section className="bg-cream border border-line rounded-lg p-6 mb-8 shadow-[0_10px_28px_rgba(30,42,64,0.10)]">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <div className="font-mono text-[11px] tracking-[0.12em] text-ink-soft mb-1">
            {formatDate(today)}
          </div>
          <h1 className="font-serif font-black text-2xl">今日任務</h1>
        </div>
        <div className="flex gap-6">
          <div className="text-right">
            <div className="font-mono text-[11px] tracking-[0.06em] text-ink-soft">連續天數</div>
            <div className="font-serif font-black text-2xl">
              {streak.current_streak}
              <span className="text-sm font-medium text-ink-soft ml-1">天</span>
            </div>
          </div>
          <Link href="/app/growth" className="text-right group">
            <div className="font-mono text-[11px] tracking-[0.06em] text-ink-soft group-hover:text-ink">
              已掌握 →
            </div>
            <div className="font-serif font-black text-2xl text-gold">
              {totalMastered.toLocaleString('en-US')}
              <span className="text-sm font-medium text-ink-soft ml-1">字</span>
            </div>
          </Link>
        </div>
      </div>

      {frozen ? (
        <p className="text-sm text-ink-soft">
          帳號暫停中，每日任務與連續天數已凍結，付費恢復後會接續原本的紀錄。
        </p>
      ) : !hasWordbooks ? (
        <p className="text-sm text-ink-soft">
          建立第一本單字本並加入至少 4 個單字，系統每天會依熟練度為你安排複習任務。
        </p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-ink-soft">
          所有語言的每日任務都已關閉，可至
          <Link href="/app/settings" className="border-b border-current mx-1">
            設定
          </Link>
          開啟。
        </p>
      ) : (
        <ul>
          {tasks.map((t) => (
            <TaskRow key={t.language} task={t} primary={t === firstOpen} />
          ))}
        </ul>
      )}
    </section>
  )
}
