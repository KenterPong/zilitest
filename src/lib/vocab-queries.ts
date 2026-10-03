import { fetchAllRows, fetchByIds } from '@/lib/db-paging'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { DbTag, WordWithMeta, WordbookWithCount } from '@/types/vocab'

export async function listWordbooksForUser(
  userId: string
): Promise<WordbookWithCount[]> {
  const { data: books, error } = await supabaseAdmin
    .from('wordbooks')
    .select('id, user_id, name, language, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  const list = books ?? []
  if (list.length === 0) return []

  const { data: counts, error: countsError } = await supabaseAdmin.rpc('wordbook_word_counts', {
    p_user_id: userId,
  })
  if (countsError) throw countsError
  const countMap = (counts ?? {}) as Record<string, number>

  return list.map((b) => ({
    ...b,
    word_count: countMap[b.id] ?? 0,
  }))
}

export async function getWordbookForUser(userId: string, wordbookId: string) {
  const { data, error } = await supabaseAdmin
    .from('wordbooks')
    .select('id, user_id, name, language, created_at')
    .eq('id', wordbookId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function listWordsForWordbook(
  userId: string,
  wordbookId: string
): Promise<WordWithMeta[]> {
  const book = await getWordbookForUser(userId, wordbookId)
  if (!book) return []

  const list = await fetchAllRows<{
    id: string
    wordbook_id: string
    term: string
    answer: string
    description: string | null
    created_at: string
  }>((from, to) =>
    supabaseAdmin
      .from('words')
      .select('id, wordbook_id, term, answer, description, created_at')
      .eq('wordbook_id', wordbookId)
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, to)
  )
  if (list.length === 0) return []

  const wordIds = list.map((w) => w.id)
  const [stats, wordTags] = await Promise.all([
    fetchByIds<{ word_id: string; attempt_count: number; correct_count: number }>(wordIds, (ids) =>
      supabaseAdmin
        .from('word_stats')
        .select('word_id, attempt_count, correct_count')
        .in('word_id', ids)
    ),
    fetchByIds<{ word_id: string; tag_id: string }>(wordIds, (ids) =>
      supabaseAdmin.from('word_tags').select('word_id, tag_id').in('word_id', ids)
    ),
  ])

  const tagIds = Array.from(new Set(wordTags.map((wt) => wt.tag_id)))
  let tagsById = new Map<string, DbTag>()
  if (tagIds.length > 0) {
    const { data: tags } = await supabaseAdmin
      .from('tags')
      .select('id, user_id, name')
      .in('id', tagIds)
      .eq('user_id', userId)
    tagsById = new Map((tags ?? []).map((t) => [t.id, t]))
  }

  const statsMap = new Map(stats.map((s) => [s.word_id, s] as const))
  const tagsByWord = new Map<string, DbTag[]>()
  for (const wt of wordTags) {
    const tag = tagsById.get(wt.tag_id)
    if (!tag) continue
    const arr = tagsByWord.get(wt.word_id) ?? []
    arr.push(tag)
    tagsByWord.set(wt.word_id, arr)
  }

  return list.map((w) => {
    const s = statsMap.get(w.id)
    const attempt = s?.attempt_count ?? 0
    const correct = s?.correct_count ?? 0
    return {
      ...w,
      tags: tagsByWord.get(w.id) ?? [],
      attempt_count: attempt,
      correct_count: correct,
      accuracy: attempt > 0 ? correct / attempt : null,
    }
  })
}

export async function listTagsForUser(userId: string): Promise<DbTag[]> {
  const { data, error } = await supabaseAdmin
    .from('tags')
    .select('id, user_id, name')
    .eq('user_id', userId)
    .order('name', { ascending: true })

  if (error) throw error
  return data ?? []
}
