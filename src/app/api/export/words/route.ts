import * as XLSX from 'xlsx'
import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/api-auth'
import { fetchAllRows } from '@/lib/db-paging'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { taipeiToday } from '@/lib/taipei-date'
import { uniqueSheetNames, WORD_EXPORT_HEADER, wordToExportRow } from '@/lib/word-sheet'
import { LANGUAGE_LABELS, type Language } from '@/types/vocab'

export const runtime = 'nodejs'

/** 匯出全部單字本為 Excel（suspended 也可） */
export async function GET() {
  const auth = await requireUser()
  if (auth.error) return auth.error

  const { data: books, error } = await supabaseAdmin
    .from('wordbooks')
    .select('id, name, language')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const wb = XLSX.utils.book_new()

  if (!books?.length) {
    const sheet = XLSX.utils.aoa_to_sheet([[...WORD_EXPORT_HEADER, '單字本', '語言']])
    XLSX.utils.book_append_sheet(wb, sheet, '單字')
  } else {
    const bookIds = books.map((b) => b.id)
    const bookById = new Map(books.map((b) => [b.id, b]))

    let words: {
      term: string
      reading: string | null
      answer: string
      description: string | null
      pronunciation: string | null
      example: string | null
      example_translation: string | null
      wordbook_id: string
    }[]
    try {
      words = await fetchAllRows((from, to) =>
        supabaseAdmin
          .from('words')
          .select('term, reading, answer, description, pronunciation, example, example_translation, wordbook_id')
          .in('wordbook_id', bookIds)
          .order('created_at', { ascending: true })
          .order('id')
          .range(from, to)
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : '讀取失敗'
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    const rows = [
      [...WORD_EXPORT_HEADER, '單字本', '語言'],
      ...words.map((w) => {
        const book = bookById.get(w.wordbook_id)
        return [
          ...wordToExportRow(w),
          book?.name ?? '',
          book ? LANGUAGE_LABELS[book.language as Language] : '',
        ]
      }),
    ]

    const sheet = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, sheet, '全部單字')

    // 每個單字本一張 sheet（不同語言可同名，名稱需去重）
    const sheetNames = uniqueSheetNames(
      books.map((b) => ({ name: b.name, languageLabel: LANGUAGE_LABELS[b.language as Language] ?? '' })),
      ['全部單字']
    )
    books.forEach((book, i) => {
      const bookWords = words.filter((w) => w.wordbook_id === book.id)
      const sheetRows = [
        [...WORD_EXPORT_HEADER],
        ...bookWords.map(wordToExportRow),
      ]
      const s = XLSX.utils.aoa_to_sheet(sheetRows)
      XLSX.utils.book_append_sheet(wb, s, sheetNames[i])
    })
  }

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  const filename = `zilitest-export-${taipeiToday()}.xlsx`

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
