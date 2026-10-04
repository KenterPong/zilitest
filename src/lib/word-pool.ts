import { fetchAllRows } from '@/lib/db-paging'
import { supabaseAdmin } from '@/lib/supabase-admin'

export interface PoolWord {
  id: string
  wordbook_id: string
  term: string
  reading: string | null
  answer: string
  description: string | null
  attempt_count: number
  correct_count: number
  familiarity: 'unknown' | 'known' | null
}

/**
 * 篩選單字池：
 * 單字本之間 OR；標籤之間 AND；標籤空陣列則不篩標籤
 */
export async function fetchWordPool(
  userId: string,
  wordbookIds: string[],
  tagIds: string[] = []
): Promise<PoolWord[]> {
  if (wordbookIds.length === 0) return []

  const { data: ownedBooks } = await supabaseAdmin
    .from('wordbooks')
    .select('id')
    .eq('user_id', userId)
    .in('id', wordbookIds)

  const ownedIds = (ownedBooks ?? []).map((b) => b.id)
  if (ownedIds.length === 0) return []

  let list = await fetchAllRows<{
    id: string
    wordbook_id: string
    term: string
    reading: string | null
    answer: string
    description: string | null
  }>((from, to) =>
    supabaseAdmin
      .from('words')
      .select('id, wordbook_id, term, reading, answer, description')
      .in('wordbook_id', ownedIds)
      .order('id')
      .range(from, to)
  )
  if (list.length === 0) return []

  if (tagIds.length > 0) {
    const { data: ownedTags } = await supabaseAdmin
      .from('tags')
      .select('id')
      .eq('user_id', userId)
      .in('id', tagIds)

    const validTagIds = (ownedTags ?? []).map((t) => t.id)
    if (validTagIds.length !== tagIds.length) return []

    // 以標籤查（標籤數少），避免把大量 word_id 放進網址
    const wordTags = await fetchAllRows<{ word_id: string; tag_id: string }>((from, to) =>
      supabaseAdmin
        .from('word_tags')
        .select('word_id, tag_id')
        .in('tag_id', validTagIds)
        .order('word_id')
        .order('tag_id')
        .range(from, to)
    )

    const tagSetByWord = new Map<string, Set<string>>()
    for (const wt of wordTags) {
      const set = tagSetByWord.get(wt.word_id) ?? new Set()
      set.add(wt.tag_id)
      tagSetByWord.set(wt.word_id, set)
    }

    list = list.filter((w) => {
      const set = tagSetByWord.get(w.id)
      if (!set) return false
      return validTagIds.every((tid) => set.has(tid))
    })
  }

  if (list.length === 0) return []

  // 以 user_id 查（冗餘欄位），避免把大量 word_id 放進網址
  const [stats, fam] = await Promise.all([
    fetchAllRows<{ word_id: string; attempt_count: number; correct_count: number }>((from, to) =>
      supabaseAdmin
        .from('word_stats')
        .select('word_id, attempt_count, correct_count')
        .eq('user_id', userId)
        .order('word_id')
        .range(from, to)
    ),
    fetchAllRows<{ word_id: string; familiarity: string }>((from, to) =>
      supabaseAdmin
        .from('card_familiarity')
        .select('word_id, familiarity')
        .eq('user_id', userId)
        .order('word_id')
        .range(from, to)
    ),
  ])

  const statsMap = new Map(stats.map((s) => [s.word_id, s] as const))
  const famMap = new Map(
    fam.map((f) => [f.word_id, f.familiarity as 'unknown' | 'known'] as const)
  )

  return list.map((w) => {
    const s = statsMap.get(w.id)
    return {
      ...w,
      attempt_count: s?.attempt_count ?? 0,
      correct_count: s?.correct_count ?? 0,
      familiarity: famMap.get(w.id) ?? null,
    }
  })
}
