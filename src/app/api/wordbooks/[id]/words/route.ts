import { NextResponse } from 'next/server'

import { assertCanMutate, canAddWords, requireUser } from '@/lib/api-auth'
import { recalculateWordCount } from '@/lib/word-count'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { DbTag, WordWithMeta } from '@/types/vocab'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> }

async function assertOwnedWordbook(userId: string, wordbookId: string) {
  const { data } = await supabaseAdmin
    .from('wordbooks')
    .select('id')
    .eq('id', wordbookId)
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

export async function GET(_request: Request, context: Ctx) {
  const auth = await requireUser()
  if (auth.error) return auth.error

  const { id: wordbookId } = await context.params
  const book = await assertOwnedWordbook(auth.user.id, wordbookId)
  if (!book) {
    return NextResponse.json({ error: '找不到單字本' }, { status: 404 })
  }

  const { data: words, error } = await supabaseAdmin
    .from('words')
    .select('id, wordbook_id, term, answer, description, created_at')
    .eq('wordbook_id', wordbookId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const list = words ?? []
  if (list.length === 0) {
    return NextResponse.json({ words: [] satisfies WordWithMeta[] })
  }

  const wordIds = list.map((w) => w.id)

  const [{ data: stats }, { data: wordTags }] = await Promise.all([
    supabaseAdmin
      .from('word_stats')
      .select('word_id, attempt_count, correct_count')
      .in('word_id', wordIds),
    supabaseAdmin.from('word_tags').select('word_id, tag_id').in('word_id', wordIds),
  ])

  const tagIds = Array.from(new Set((wordTags ?? []).map((wt) => wt.tag_id)))
  let tagsById = new Map<string, DbTag>()
  if (tagIds.length > 0) {
    const { data: tags } = await supabaseAdmin
      .from('tags')
      .select('id, user_id, name')
      .in('id', tagIds)
      .eq('user_id', auth.user.id)
    tagsById = new Map((tags ?? []).map((t) => [t.id, t]))
  }

  const statsMap = new Map(
    (stats ?? []).map((s) => [s.word_id, s] as const)
  )
  const tagsByWord = new Map<string, DbTag[]>()
  for (const wt of wordTags ?? []) {
    const tag = tagsById.get(wt.tag_id)
    if (!tag) continue
    const arr = tagsByWord.get(wt.word_id) ?? []
    arr.push(tag)
    tagsByWord.set(wt.word_id, arr)
  }

  const result: WordWithMeta[] = list.map((w) => {
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

  return NextResponse.json({ words: result })
}

export async function POST(request: Request, context: Ctx) {
  const auth = await requireUser()
  if (auth.error) return auth.error

  const blocked = assertCanMutate(auth.user)
  if (blocked) return blocked

  const limitErr = canAddWords(auth.user, 1)
  if (limitErr) return limitErr

  const { id: wordbookId } = await context.params
  const book = await assertOwnedWordbook(auth.user.id, wordbookId)
  if (!book) {
    return NextResponse.json({ error: '找不到單字本' }, { status: 404 })
  }

  let body: {
    term?: string
    answer?: string
    description?: string | null
    tag_ids?: string[]
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '無效的 JSON' }, { status: 400 })
  }

  const term = body.term?.trim()
  const answer = body.answer?.trim()
  if (!term || !answer) {
    return NextResponse.json({ error: '單字與答案皆必填' }, { status: 400 })
  }

  const description = body.description?.trim() || null
  const tagIds = Array.isArray(body.tag_ids) ? body.tag_ids : []

  if (tagIds.length > 0) {
    const { data: ownedTags } = await supabaseAdmin
      .from('tags')
      .select('id')
      .eq('user_id', auth.user.id)
      .in('id', tagIds)
    if ((ownedTags?.length ?? 0) !== tagIds.length) {
      return NextResponse.json({ error: '含有無效標籤' }, { status: 400 })
    }
  }

  const { data: word, error } = await supabaseAdmin
    .from('words')
    .insert({
      wordbook_id: wordbookId,
      term,
      answer,
      description,
    })
    .select('id, wordbook_id, term, answer, description, created_at')
    .single()

  if (error || !word) {
    return NextResponse.json({ error: error?.message ?? '新增失敗' }, { status: 500 })
  }

  if (tagIds.length > 0) {
    const { error: tagError } = await supabaseAdmin.from('word_tags').insert(
      tagIds.map((tag_id) => ({ word_id: word.id, tag_id }))
    )
    if (tagError) {
      return NextResponse.json({ error: tagError.message }, { status: 500 })
    }
  }

  let wordCount: number
  try {
    wordCount = await recalculateWordCount(auth.user.id)
  } catch (e) {
    const msg = e instanceof Error ? e.message : '更新字數失敗'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({ word, word_count: wordCount }, { status: 201 })
}
