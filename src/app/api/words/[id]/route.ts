import { NextResponse } from 'next/server'

import { assertCanMutate, requireUser } from '@/lib/api-auth'
import { recalculateWordCount } from '@/lib/word-count'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> }

async function getOwnedWord(userId: string, wordId: string) {
  const { data: word } = await supabaseAdmin
    .from('words')
    .select('id, wordbook_id, term, answer, description, created_at')
    .eq('id', wordId)
    .maybeSingle()

  if (!word) return null

  const { data: book } = await supabaseAdmin
    .from('wordbooks')
    .select('id')
    .eq('id', word.wordbook_id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!book) return null
  return word
}

export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireUser()
  if (auth.error) return auth.error

  const blocked = assertCanMutate(auth.user)
  if (blocked) return blocked

  const { id } = await context.params
  const existing = await getOwnedWord(auth.user.id, id)
  if (!existing) {
    return NextResponse.json({ error: '找不到單字' }, { status: 404 })
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

  const updates: {
    term?: string
    answer?: string
    description?: string | null
  } = {}

  if (body.term !== undefined) {
    const term = body.term.trim()
    if (!term) {
      return NextResponse.json({ error: '單字不可為空' }, { status: 400 })
    }
    updates.term = term
  }
  if (body.answer !== undefined) {
    const answer = body.answer.trim()
    if (!answer) {
      return NextResponse.json({ error: '答案不可為空' }, { status: 400 })
    }
    updates.answer = answer
  }
  if (body.description !== undefined) {
    updates.description = body.description?.trim() || null
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabaseAdmin.from('words').update(updates).eq('id', id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  if (Array.isArray(body.tag_ids)) {
    const tagIds = body.tag_ids
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

    await supabaseAdmin.from('word_tags').delete().eq('word_id', id)
    if (tagIds.length > 0) {
      const { error: tagError } = await supabaseAdmin.from('word_tags').insert(
        tagIds.map((tag_id) => ({ word_id: id, tag_id }))
      )
      if (tagError) {
        return NextResponse.json({ error: tagError.message }, { status: 500 })
      }
    }
  }

  const word = await getOwnedWord(auth.user.id, id)
  return NextResponse.json({ word })
}

export async function DELETE(_request: Request, context: Ctx) {
  const auth = await requireUser()
  if (auth.error) return auth.error

  const blocked = assertCanMutate(auth.user)
  if (blocked) return blocked

  const { id } = await context.params
  const existing = await getOwnedWord(auth.user.id, id)
  if (!existing) {
    return NextResponse.json({ error: '找不到單字' }, { status: 404 })
  }

  const { error } = await supabaseAdmin.from('words').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let wordCount: number
  try {
    wordCount = await recalculateWordCount(auth.user.id)
  } catch (e) {
    const msg = e instanceof Error ? e.message : '更新字數失敗'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({ ok: true, word_count: wordCount })
}
