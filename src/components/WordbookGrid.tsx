import Link from 'next/link'

import { CreateWordbookButton } from '@/components/CreateWordbookButton'
import type { WordbookWithCount } from '@/types/vocab'

interface WordbookGridProps {
  wordbooks: WordbookWithCount[]
  canMutate: boolean
}

export function WordbookGrid({ wordbooks, canMutate }: WordbookGridProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-serif font-bold text-xl">我的單字本</h1>
        <CreateWordbookButton disabled={!canMutate} />
      </div>

      {wordbooks.length === 0 ? (
        <div className="border border-dashed border-line rounded-lg p-12 text-center text-ink-soft bg-cream">
          <p className="mb-4">還沒有單字本，建立第一本開始吧。</p>
          <CreateWordbookButton disabled={!canMutate} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {wordbooks.map((book) => (
            <div
              key={book.id}
              className="relative bg-cream border border-line rounded-md p-5"
            >
              <Link
                href={`/app/wordbooks/${book.id}`}
                className="absolute top-4 right-4 font-mono text-[11px] text-ink-soft hover:text-stamp-red"
              >
                管理
              </Link>
              <h3 className="font-serif text-[16.5px] mb-2.5 pr-10">{book.name}</h3>
              <div className="flex gap-3.5 font-mono text-[11.5px] text-ink-soft mb-4">
                <span>
                  <b className="text-ink font-semibold">{book.word_count}</b> 字
                </span>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/app/cards?wordbook=${book.id}`}
                  className="flex-1 text-center text-[12.5px] font-semibold py-2 rounded-sm bg-paper-deep border border-line text-ink hover:border-ink"
                >
                  背誦
                </Link>
                <Link
                  href={`/app/quiz?wordbook=${book.id}`}
                  className="flex-1 text-center text-[12.5px] font-semibold py-2 rounded-sm bg-stamp-red text-cream hover:bg-stamp-red-deep"
                >
                  測驗
                </Link>
              </div>
            </div>
          ))}
          {canMutate && <CreateWordbookButton variant="dashed" />}
        </div>
      )}
    </>
  )
}
