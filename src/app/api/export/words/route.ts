import * as XLSX from 'xlsx'
import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

/** 匯出全部單字本為 Excel（suspended 也可） */
export async function GET() {
  const auth = await requireUser()
  if (auth.error) return auth.error

  const { data: books, error } = await supabaseAdmin
    .from('wordbooks')
    .select('id, name')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const wb = XLSX.utils.book_new()

  if (!books?.length) {
    const sheet = XLSX.utils.aoa_to_sheet([['單字', '答案', '描述', '單字本']])
    XLSX.utils.book_append_sheet(wb, sheet, '單字')
  } else {
    const bookIds = books.map((b) => b.id)
    const nameById = new Map(books.map((b) => [b.id, b.name]))

    const { data: words, error: wordsError } = await supabaseAdmin
      .from('words')
      .select('term, answer, description, wordbook_id')
      .in('wordbook_id', bookIds)
      .order('created_at', { ascending: true })

    if (wordsError) {
      return NextResponse.json({ error: wordsError.message }, { status: 500 })
    }

    const rows = [
      ['單字', '答案', '描述', '單字本'],
      ...(words ?? []).map((w) => [
        w.term,
        w.answer,
        w.description ?? '',
        nameById.get(w.wordbook_id) ?? '',
      ]),
    ]

    const sheet = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, sheet, '全部單字')

    // 每個單字本一張 sheet（名稱截斷）
    for (const book of books) {
      const bookWords = (words ?? []).filter((w) => w.wordbook_id === book.id)
      const sheetRows = [
        ['單字', '答案', '描述'],
        ...bookWords.map((w) => [w.term, w.answer, w.description ?? '']),
      ]
      const s = XLSX.utils.aoa_to_sheet(sheetRows)
      const safeName = book.name.replace(/[\\/?*[\]]/g, '_').slice(0, 28) || '單字本'
      XLSX.utils.book_append_sheet(wb, s, safeName)
    }
  }

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  const filename = `zilitest-export-${new Date().toISOString().slice(0, 10)}.xlsx`

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
