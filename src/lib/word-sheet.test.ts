import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'

import { parseWordRows, WORD_SHEET_HEADER, wordToRow, type SheetWord } from '@/lib/word-sheet'

/** 模擬匯出 → 寫成 xlsx → 匯入解析 */
function roundTrip(rows: string[][]): SheetWord[] {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), '全部單字')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  const read = XLSX.read(buffer, { type: 'buffer' })
  const sheet = read.Sheets[read.SheetNames[0]!]!
  return parseWordRows(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }))
}

const words: SheetWord[] = [
  { term: '受ける', answer: '接受', description: '動詞', reading: 'うける' },
  { term: 'journey', answer: '旅程', description: null, reading: null },
  { term: '約束', answer: '約定', description: null, reading: 'やくそく' },
]

describe('Excel 匯出再匯入', () => {
  it('讀音與描述不遺失', () => {
    expect(roundTrip([[...WORD_SHEET_HEADER], ...words.map(wordToRow)])).toEqual(words)
  })

  it('匯出的第一張表多出的單字本、語言欄不影響匯入', () => {
    const rows = [
      [...WORD_SHEET_HEADER, '單字本', '語言'],
      ...words.map((w) => [...wordToRow(w), '日文', '日文']),
    ]
    expect(roundTrip(rows)).toEqual(words)
  })
})

describe('parseWordRows', () => {
  it('略過表頭（含英文 term）與缺單字或答案的列', () => {
    expect(
      parseWordRows([
        ['term', 'answer'],
        ['', '旅程'],
        ['borrow', ''],
        [' apple ', ' 蘋果 ', '', ''],
      ])
    ).toEqual([{ term: 'apple', answer: '蘋果', description: null, reading: null }])
  })

  it('數字儲存格轉成字串', () => {
    expect(parseWordRows([[100, 'hundred']])).toEqual([
      { term: '100', answer: 'hundred', description: null, reading: null },
    ])
  })
})
