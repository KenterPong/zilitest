/**
 * 一次性補齊既有單字的發音標註（技術規格 v5 第十三節 2.）。
 * 只處理所屬單字本 language IN ('en','ko') 且 pronunciation IS NULL 的單字，只寫入 pronunciation。
 * 可重複執行：已有標註的字不再處理；產生不出標註的字（字典查不到等）維持 NULL。
 *
 * 執行（.env.local 連的是正式資料庫，執行前先確認）：
 *   npm run backfill:pronunciation -- --dry-run   # 只計算、不寫入
 *   npm run backfill:pronunciation
 */
import { createClient } from '@supabase/supabase-js'

import { generatePronunciation } from '../src/lib/pronunciation'
import type { Language } from '../src/types/vocab'

const BATCH = 200
const dryRun = process.argv.includes('--dry-run')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, '')
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
if (!url || !key) {
  console.error('缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

async function main() {
  const { data: books, error: bookErr } = await db
    .from('wordbooks')
    .select('id, language')
    .in('language', ['en', 'ko'])
  if (bookErr) throw new Error(bookErr.message)
  const languageByBook = new Map((books ?? []).map((b) => [b.id as string, b.language as Language]))
  if (languageByBook.size === 0) {
    console.log('沒有英文或韓文單字本')
    return
  }

  let lastId = ''
  let scanned = 0
  let updated = 0
  let unresolved = 0
  // 以 id 遞增分批（keyset），查不到標註的字仍為 NULL，不會被重複掃到
  for (;;) {
    let query = db
      .from('words')
      .select('id, wordbook_id, term')
      .is('pronunciation', null)
      .in('wordbook_id', Array.from(languageByBook.keys()))
      .order('id')
      .limit(BATCH)
    if (lastId) query = query.gt('id', lastId)
    const { data: rows, error } = await query
    if (error) throw new Error(error.message)
    if (!rows || rows.length === 0) break

    for (const w of rows) {
      scanned += 1
      const pronunciation = await generatePronunciation(languageByBook.get(w.wordbook_id)!, w.term)
      if (!pronunciation) {
        unresolved += 1
        continue
      }
      if (!dryRun) {
        const { error: upErr } = await db
          .from('words')
          .update({ pronunciation })
          .eq('id', w.id)
          .is('pronunciation', null)
        if (upErr) throw new Error(upErr.message)
      }
      updated += 1
    }
    lastId = rows[rows.length - 1].id
    console.log(`已掃描 ${scanned} 字…`)
  }

  console.log(
    `${dryRun ? '[dry-run] ' : ''}掃描 ${scanned} 字，${dryRun ? '可寫入' : '已寫入'} ${updated} 字，產生不出標註 ${unresolved} 字`
  )
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
