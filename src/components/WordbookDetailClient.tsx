'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { ImportExcelButton } from '@/components/ImportExcelButton'
import type { DbTag, WordWithMeta } from '@/types/vocab'
import { TRIAL_WORD_LIMIT } from '@/types/user'

interface WordbookDetailClientProps {
  wordbookId: string
  wordbookName: string
  words: WordWithMeta[]
  tags: DbTag[]
  accountWordCount: number
  userStatus: string
  canMutate: boolean
}

function accuracyLabel(accuracy: number | null) {
  if (accuracy === null) {
    return { text: '尚未測驗', className: 'text-ink-soft' }
  }
  const pct = Math.round(accuracy * 100)
  if (pct >= 70) return { text: `${pct}%`, className: 'text-[#3E7A4F] font-semibold' }
  if (pct >= 45) return { text: `${pct}%`, className: 'text-gold font-semibold' }
  return { text: `${pct}%`, className: 'text-stamp-red font-semibold' }
}

export function WordbookDetailClient({
  wordbookId,
  wordbookName,
  words: initialWords,
  tags: initialTags,
  accountWordCount,
  userStatus,
  canMutate,
}: WordbookDetailClientProps) {
  const router = useRouter()
  const [words, setWords] = useState(initialWords)
  const [tags, setTags] = useState(initialTags)
  const [filterTagId, setFilterTagId] = useState<string | null>(null)
  const [wordCount, setWordCount] = useState(accountWordCount)

  const [wordModal, setWordModal] = useState<'create' | WordWithMeta | null>(null)
  const [tagModal, setTagModal] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [nameDraft, setNameDraft] = useState(wordbookName)
  const [displayName, setDisplayName] = useState(wordbookName)

  const [form, setForm] = useState({
    term: '',
    answer: '',
    description: '',
    tag_ids: [] as string[],
  })
  const [newTagName, setNewTagName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const filtered = useMemo(() => {
    if (!filterTagId) return words
    return words.filter((w) => w.tags.some((t) => t.id === filterTagId))
  }, [words, filterTagId])

  const limitPct =
    userStatus === 'trial'
      ? Math.min(100, Math.round((wordCount / TRIAL_WORD_LIMIT) * 100))
      : 0

  function openCreate() {
    setForm({ term: '', answer: '', description: '', tag_ids: [] })
    setError(null)
    setWordModal('create')
  }

  function openEdit(word: WordWithMeta) {
    setForm({
      term: word.term,
      answer: word.answer,
      description: word.description ?? '',
      tag_ids: word.tags.map((t) => t.id),
    })
    setError(null)
    setWordModal(word)
  }

  async function saveWord(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (wordModal === 'create') {
        const res = await fetch(`/api/wordbooks/${wordbookId}/words`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            term: form.term,
            answer: form.answer,
            description: form.description || null,
            tag_ids: form.tag_ids,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? '新增失敗')
          return
        }
        if (typeof data.word_count === 'number') setWordCount(data.word_count)
      } else if (wordModal && typeof wordModal === 'object') {
        const res = await fetch(`/api/words/${wordModal.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            term: form.term,
            answer: form.answer,
            description: form.description || null,
            tag_ids: form.tag_ids,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? '更新失敗')
          return
        }
      }
      setWordModal(null)
      router.refresh()
      // 重新拉列表以取得 tags / stats
      const listRes = await fetch(`/api/wordbooks/${wordbookId}/words`)
      const listData = await listRes.json()
      if (listRes.ok) setWords(listData.words)
    } catch {
      setError('網路錯誤')
    } finally {
      setLoading(false)
    }
  }

  async function deleteWord(word: WordWithMeta) {
    if (!confirm(`確定刪除「${word.term}」？`)) return
    const res = await fetch(`/api/words/${word.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) {
      alert(data.error ?? '刪除失敗')
      return
    }
    if (typeof data.word_count === 'number') setWordCount(data.word_count)
    setWords((prev) => prev.filter((w) => w.id !== word.id))
    router.refresh()
  }

  async function renameWordbook(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/wordbooks/${wordbookId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameDraft }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '重新命名失敗')
        return
      }
      setDisplayName(data.wordbook.name)
      setRenameOpen(false)
      router.refresh()
    } catch {
      setError('網路錯誤')
    } finally {
      setLoading(false)
    }
  }

  async function deleteWordbook() {
    if (!confirm(`確定刪除單字本「${displayName}」？其中所有單字都會一併刪除。`)) return
    const res = await fetch(`/api/wordbooks/${wordbookId}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) {
      alert(data.error ?? '刪除失敗')
      return
    }
    router.push('/app')
    router.refresh()
  }

  async function createTag(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagName }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '建立標籤失敗')
        return
      }
      setTags((prev) => [...prev, data.tag].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant')))
      setNewTagName('')
    } catch {
      setError('網路錯誤')
    } finally {
      setLoading(false)
    }
  }

  async function deleteTag(tag: DbTag) {
    if (!confirm(`刪除標籤「${tag.name}」？單字上的此標籤會一併移除。`)) return
    const res = await fetch(`/api/tags/${tag.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) {
      alert(data.error ?? '刪除失敗')
      return
    }
    setTags((prev) => prev.filter((t) => t.id !== tag.id))
    setWords((prev) =>
      prev.map((w) => ({
        ...w,
        tags: w.tags.filter((t) => t.id !== tag.id),
      }))
    )
    if (filterTagId === tag.id) setFilterTagId(null)
  }

  function toggleFormTag(tagId: string) {
    setForm((f) => ({
      ...f,
      tag_ids: f.tag_ids.includes(tagId)
        ? f.tag_ids.filter((id) => id !== tagId)
        : [...f.tag_ids, tagId],
    }))
  }

  return (
    <div>
      <p className="text-[12.5px] text-ink-soft mb-1.5">
        <Link href="/app" className="border-b border-dotted border-ink-soft">
          我的單字本
        </Link>
        {' ／ '}
        {displayName}
      </p>

      <div className="flex items-end justify-between flex-wrap gap-2.5 mb-1.5">
        <h1 className="font-serif font-black text-2xl">{displayName}</h1>
        {userStatus === 'trial' && (
          <div className="font-mono text-[11.5px] text-ink-soft">
            {wordCount} / {TRIAL_WORD_LIMIT} 字（試用中）
          </div>
        )}
      </div>

      {userStatus === 'trial' && (
        <div className="h-1.5 max-w-xs bg-paper-deep border border-line rounded-sm overflow-hidden mb-5">
          <div className="h-full bg-gold" style={{ width: `${limitPct}%` }} />
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex gap-2.5 flex-wrap">
          <button
            type="button"
            disabled={!canMutate}
            onClick={openCreate}
            className="bg-ink text-cream text-sm font-medium px-4 py-2 rounded-sm disabled:opacity-60"
          >
            + 新增單字
          </button>
          <ImportExcelButton
            wordbookId={wordbookId}
            canMutate={canMutate}
            remainingSlots={
              userStatus === 'trial'
                ? Math.max(0, TRIAL_WORD_LIMIT - wordCount)
                : null
            }
            onImported={async () => {
              const listRes = await fetch(`/api/wordbooks/${wordbookId}/words`)
              const listData = await listRes.json()
              if (listRes.ok) setWords(listData.words)
              const me = await fetch('/api/users/me')
              const meData = await me.json()
              if (me.ok && meData.user) setWordCount(meData.user.word_count)
            }}
          />
          <button
            type="button"
            disabled={!canMutate}
            onClick={() => {
              setError(null)
              setTagModal(true)
            }}
            className="border border-line bg-cream text-sm font-medium px-4 py-2 rounded-sm disabled:opacity-60"
          >
            管理標籤
          </button>
          <button
            type="button"
            disabled={!canMutate}
            onClick={() => {
              setNameDraft(displayName)
              setError(null)
              setRenameOpen(true)
            }}
            className="border border-line bg-cream text-sm font-medium px-4 py-2 rounded-sm disabled:opacity-60"
          >
            重新命名
          </button>
          <button
            type="button"
            disabled={!canMutate}
            onClick={deleteWordbook}
            className="border border-stamp-red text-stamp-red-deep text-sm font-medium px-4 py-2 rounded-sm disabled:opacity-60"
          >
            刪除單字本
          </button>
        </div>
        <div className="border border-line bg-cream text-sm px-4 py-2 rounded-sm text-ink-soft">
          共 {words.length} 個單字
        </div>
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        <button
          type="button"
          onClick={() => setFilterTagId(null)}
          className={`font-mono text-[11.5px] px-2.5 py-1 rounded-full border ${
            !filterTagId
              ? 'bg-ink text-cream border-ink'
              : 'bg-cream text-ink-soft border-line'
          }`}
        >
          全部標籤
        </button>
        {tags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            onClick={() => setFilterTagId(tag.id)}
            className={`font-mono text-[11.5px] px-2.5 py-1 rounded-full border ${
              filterTagId === tag.id
                ? 'bg-ink text-cream border-ink'
                : 'bg-cream text-ink-soft border-line'
            }`}
          >
            {tag.name}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="border border-dashed border-line rounded-lg p-10 text-center text-ink-soft bg-cream">
          {words.length === 0 ? '此單字本尚無單字，點「新增單字」開始。' : '沒有符合此標籤的單字。'}
        </div>
      ) : (
        <div className="overflow-x-auto border border-line rounded-md bg-cream">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {['單字', '答案', '正確率', '標籤', '操作'].map((h) => (
                  <th
                    key={h}
                    className="text-left font-mono text-[11px] tracking-wide text-ink-soft bg-paper-deep px-4 py-2.5 font-medium"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((word) => {
                const acc = accuracyLabel(word.accuracy)
                return (
                  <tr key={word.id} className="border-t border-line">
                    <td className="px-4 py-3 font-serif font-bold text-[15.5px]">
                      {word.term}
                    </td>
                    <td className="px-4 py-3">{word.answer}</td>
                    <td className={`px-4 py-3 ${acc.className}`}>{acc.text}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {word.tags.map((t) => (
                          <span
                            key={t.id}
                            className="font-mono text-[10px] text-ink-soft bg-paper-deep px-1.5 py-0.5 rounded-full"
                          >
                            {t.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3 text-xs text-ink-soft">
                        <button
                          type="button"
                          disabled={!canMutate}
                          onClick={() => openEdit(word)}
                          className="hover:text-stamp-red disabled:opacity-50"
                        >
                          編輯
                        </button>
                        <button
                          type="button"
                          disabled={!canMutate}
                          onClick={() => deleteWord(word)}
                          className="hover:text-stamp-red disabled:opacity-50"
                        >
                          刪除
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 新增／編輯單字 */}
      {wordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <form
            onSubmit={saveWord}
            className="bg-cream border border-line rounded-lg p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <h2 className="font-serif font-bold text-lg mb-4">
              {wordModal === 'create' ? '新增單字' : '編輯單字'}
            </h2>
            <label className="block text-xs text-ink-soft mb-1">單字</label>
            <input
              value={form.term}
              onChange={(e) => setForm((f) => ({ ...f, term: e.target.value }))}
              className="w-full border border-line rounded-sm px-3 py-2 text-sm bg-white mb-3"
              required
            />
            <label className="block text-xs text-ink-soft mb-1">答案（中文）</label>
            <input
              value={form.answer}
              onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
              className="w-full border border-line rounded-sm px-3 py-2 text-sm bg-white mb-3"
              required
            />
            <label className="block text-xs text-ink-soft mb-1">補充說明（選填）</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full border border-line rounded-sm px-3 py-2 text-sm bg-white mb-3 min-h-[72px]"
            />
            {tags.length > 0 && (
              <>
                <label className="block text-xs text-ink-soft mb-2">標籤</label>
                <div className="flex gap-2 flex-wrap mb-3">
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleFormTag(tag.id)}
                      className={`font-mono text-[11.5px] px-2.5 py-1 rounded-full border ${
                        form.tag_ids.includes(tag.id)
                          ? 'bg-ink text-cream border-ink'
                          : 'bg-white text-ink-soft border-line'
                      }`}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </>
            )}
            {error && <p className="text-sm text-stamp-red mb-3">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setWordModal(null)}
                className="border border-line bg-white text-sm px-4 py-2 rounded-sm"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-ink text-cream text-sm font-medium px-4 py-2 rounded-sm disabled:opacity-60"
              >
                {loading ? '儲存中…' : '儲存'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 管理標籤 */}
      {tagModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div className="bg-cream border border-line rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 className="font-serif font-bold text-lg mb-4">管理標籤</h2>
            <p className="text-xs text-ink-soft mb-3">標籤屬帳號共用，可跨單字本使用。</p>
            <ul className="space-y-2 mb-4 max-h-48 overflow-y-auto">
              {tags.map((tag) => (
                <li
                  key={tag.id}
                  className="flex items-center justify-between border border-line rounded-sm px-3 py-2 text-sm bg-white"
                >
                  <span>{tag.name}</span>
                  <button
                    type="button"
                    onClick={() => deleteTag(tag)}
                    className="text-xs text-stamp-red"
                  >
                    刪除
                  </button>
                </li>
              ))}
              {tags.length === 0 && (
                <li className="text-sm text-ink-soft">尚無標籤</li>
              )}
            </ul>
            <form onSubmit={createTag} className="flex gap-2 mb-3">
              <input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="新標籤名稱"
                className="flex-1 border border-line rounded-sm px-3 py-2 text-sm bg-white"
                maxLength={40}
              />
              <button
                type="submit"
                disabled={loading || !newTagName.trim()}
                className="bg-ink text-cream text-sm px-3 py-2 rounded-sm disabled:opacity-60"
              >
                新增
              </button>
            </form>
            {error && <p className="text-sm text-stamp-red mb-3">{error}</p>}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setTagModal(false)}
                className="border border-line bg-white text-sm px-4 py-2 rounded-sm"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 重新命名 */}
      {renameOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <form
            onSubmit={renameWordbook}
            className="bg-cream border border-line rounded-lg p-6 w-full max-w-md shadow-xl"
          >
            <h2 className="font-serif font-bold text-lg mb-4">重新命名單字本</h2>
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className="w-full border border-line rounded-sm px-3 py-2 text-sm bg-white mb-3"
              maxLength={80}
              required
            />
            {error && <p className="text-sm text-stamp-red mb-3">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenameOpen(false)}
                className="border border-line bg-white text-sm px-4 py-2 rounded-sm"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={loading || !nameDraft.trim()}
                className="bg-ink text-cream text-sm font-medium px-4 py-2 rounded-sm disabled:opacity-60"
              >
                儲存
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
