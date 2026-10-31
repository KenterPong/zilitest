import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'

import {
  parseWordRows,
  uniqueSheetNames,
  WORD_EXPORT_HEADER,
  WORD_SHEET_HEADER,
  wordToExportRow,
  wordToRow,
  type SheetWord,
} from '@/lib/word-sheet'

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

describe('匯出含發音標註欄', () => {
  it('第 5 欄為發音標註，連同單字本與語言欄原樣再匯入時只讀前 4 欄', () => {
    const rows = [
      [...WORD_EXPORT_HEADER, '單字本', '語言'],
      [...wordToExportRow({ term: 'complete', answer: '完成', description: '動詞', reading: null, pronunciation: '/kəmplit/' }), '第一課', '英文'],
    ]
    expect(rows[0]!.slice(0, 5)).toEqual(['單字', '答案', '描述', '讀音', '發音標註'])
    expect(roundTrip(rows)).toEqual([{ term: 'complete', answer: '完成', description: '動詞', reading: null }])
  })
})

describe('匯出含例句欄', () => {
  it('第 6、7 欄為例句與例句翻譯，單字本與語言移到第 8、9 欄，再匯入只讀前 4 欄', () => {
    const word = {
      term: 'reimburse',
      answer: '報銷',
      description: null,
      reading: null,
      pronunciation: '/riɪmbɝs/',
      example: 'The company reimbursed my travel expenses.',
      example_translation: '公司報銷了我的差旅費。',
    }
    const rows = [
      [...WORD_EXPORT_HEADER, '單字本', '語言'],
      [...wordToExportRow(word), '第一課', '英文'],
    ]
    expect(rows[0]).toEqual(['單字', '答案', '描述', '讀音', '發音標註', '例句', '例句翻譯', '單字本', '語言'])
    expect(rows[1]!.slice(5)).toEqual([word.example, word.example_translation, '第一課', '英文'])
    expect(roundTrip(rows)).toEqual([{ term: 'reimburse', answer: '報銷', description: null, reading: null }])
  })

  it('沒有例句時第 6、7 欄為空字串', () => {
    const row = wordToExportRow({ term: 'a', answer: 'b', description: null, reading: null, pronunciation: null })
    expect(row.slice(5)).toEqual(['', ''])
  })
})

describe('uniqueSheetNames', () => {
  it('不同語言同名單字本加上語言，仍撞名再加編號', () => {
    const names = uniqueSheetNames(
      [
        { name: '046', languageLabel: '英文' },
        { name: '046', languageLabel: '日文' },
        { name: '046', languageLabel: '日文' },
        { name: '全部單字', languageLabel: '韓文' },
      ],
      ['全部單字']
    )
    expect(names).toEqual(['046', '046 日文', '046 日文 2', '全部單字 韓文'])
  })

  it('去除不允許的字元並限制 31 字，結果可寫入 xlsx', () => {
    const long = 'a'.repeat(40)
    const names = uniqueSheetNames([
      { name: 'A:B/C?', languageLabel: '英文' },
      { name: long, languageLabel: '英文' },
      { name: long, languageLabel: '日文' },
      { name: '  ', languageLabel: '韓文' },
    ])
    expect(names[0]).toBe('A_B_C_')
    expect(names.every((n) => n.length <= 31)).toBe(true)
    expect(names[3]).toBe('單字本')
    const wb = XLSX.utils.book_new()
    for (const n of names) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['x']]), n)
    expect(wb.SheetNames).toEqual(names)
  })
})
