import { supabaseAdmin } from '@/lib/supabase-admin'

export interface PoolWord {
  id: string
  wordbook_id: string
  term: string
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

  const { data: words, error } = await supabaseAdmin
    .from('words')
    .select('id, wordbook_id, term, answer, description')
    .in('wordbook_id', ownedIds)

  if (error) throw error
  let list = words ?? []
  if (list.length === 0) return []

  if (tagIds.length > 0) {
    const { data: ownedTags } = await supabaseAdmin
      .from('tags')
      .select('id')
      .eq('user_id', userId)
      .in('id', tagIds)

    const validTagIds = (ownedTags ?? []).map((t) => t.id)
    if (validTagIds.length !== tagIds.length) return []

    const wordIds = list.map((w) => w.id)
    const { data: wordTags } = await supabaseAdmin
      .from('word_tags')
      .select('word_id, tag_id')
      .in('word_id', wordIds)
      .in('tag_id', validTagIds)

    const tagSetByWord = new Map<string, Set<string>>()
    for (const wt of wordTags ?? []) {
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

  const ids = list.map((w) => w.id)
  const [{ data: stats }, { data: fam }] = await Promise.all([
    supabaseAdmin
      .from('word_stats')
      .select('word_id, attempt_count, correct_count')
      .in('word_id', ids),
    supabaseAdmin
      .from('card_familiarity')
      .select('word_id, familiarity')
      .eq('user_id', userId)
      .in('word_id', ids),
  ])

  const statsMap = new Map((stats ?? []).map((s) => [s.word_id, s] as const))
  const famMap = new Map(
    (fam ?? []).map((f) => [f.word_id, f.familiarity as 'unknown' | 'known'] as const)
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
