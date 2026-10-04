import { NextResponse } from 'next/server'

import { assertCanMutate, canAddWords, requireUser } from '@/lib/api-auth'
import { recalculateWordCount } from '@/lib/word-count'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { listWordsForWordbook } from '@/lib/vocab-queries'
import type { WordWithMeta } from '@/types/vocab'

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

  try {
    const words: WordWithMeta[] = await listWordsForWordbook(auth.user.id, wordbookId)
    return NextResponse.json({ words })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '讀取失敗'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
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
    reading?: string | null
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
  const reading = body.reading?.trim() || null
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
      reading,
      answer,
      description,
    })
    .select('id, wordbook_id, term, reading, answer, description, created_at')
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
