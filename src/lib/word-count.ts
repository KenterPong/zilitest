import { supabaseAdmin } from '@/lib/supabase-admin'

/** 重新計算帳號全站單字數並寫回 users.word_count */
export async function recalculateWordCount(userId: string): Promise<number> {
  const { data: books, error: booksError } = await supabaseAdmin
    .from('wordbooks')
    .select('id')
    .eq('user_id', userId)

  if (booksError) throw booksError
  if (!books?.length) {
    await supabaseAdmin.from('users').update({ word_count: 0 }).eq('id', userId)
    return 0
  }

  const ids = books.map((b) => b.id)
  const { count, error } = await supabaseAdmin
    .from('words')
    .select('id', { count: 'exact', head: true })
    .in('wordbook_id', ids)

  if (error) throw error
  const wordCount = count ?? 0
  await supabaseAdmin.from('users').update({ word_count: wordCount }).eq('id', userId)
  return wordCount
}
