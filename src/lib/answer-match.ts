/**
 * 填空題判定（技術規格 v5 第五節 8.）：看中文、拼外文。
 * 比對前統一：NFKC（全形／半形）、頭尾空白、英文大小寫、片假名 → 平假名。
 * 日文單字可另填「讀音」，輸入與單字寫法或讀音任一個一致即正確。
 * Levenshtein 對齊用於結果頁紅字標記
 */

/** 片假名（ァ–ヶ）轉平假名；長音符等其他字元不變 */
function katakanaToHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
}

export function normalizeAnswer(s: string): string {
  return katakanaToHiragana(s.normalize('NFKC').trim().toLowerCase())
}

export function isExactAnswerMatch(userInput: string, correct: string): boolean {
  return normalizeAnswer(userInput) === normalizeAnswer(correct)
}

/** 填空題：與單字寫法或讀音（選填）任一個一致即正確 */
export function isFillAnswerCorrect(
  userInput: string,
  term: string,
  reading: string | null | undefined
): boolean {
  if (!normalizeAnswer(userInput)) return false
  if (isExactAnswerMatch(userInput, term)) return true
  return Boolean(reading && reading.trim()) && isExactAnswerMatch(userInput, reading!)
}

/** 編輯距離 */
export function levenshtein(a: string, b: string): number {
  return levenshteinOps(a, b).filter((op) => op !== 'eq').length
}

/** 紅字標記的比對對象：單字寫法與讀音中，和輸入較接近的那個 */
export function fillDiffTarget(
  userInput: string,
  term: string,
  reading: string | null | undefined
): string {
  const r = reading?.trim()
  if (!r) return term
  const u = userInput.trim()
  return levenshtein(u, r) < levenshtein(u, term.trim()) ? r : term
}

export type DiffPart =
  | { type: 'ok'; text: string }
  | { type: 'bad'; text: string }
  | { type: 'missing'; text: string }
  | { type: 'extra'; text: string }

function levenshteinOps(a: string, b: string): ('eq' | 'sub' | 'ins' | 'del')[] {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1]
      else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
      }
    }
  }

  const ops: ('eq' | 'sub' | 'ins' | 'del')[] = []
  let i = m
  let j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.push('eq')
      i--
      j--
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      ops.push('sub')
      i--
      j--
    } else if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
      ops.push('ins')
      j--
    } else {
      ops.push('del')
      i--
    }
  }
  return ops.reverse()
}

/** 以使用者輸入對齊正確答案，產生紅字標記片段；差異過大則回傳 null */
export function buildAnswerDiff(userInput: string, correct: string): DiffPart[] | null {
  const u = userInput.trim()
  const c = correct.trim()
  if (!u) {
    return [{ type: 'missing', text: '_'.repeat(Math.min(c.length, 8)) || '_' }]
  }

  const maxLen = Math.max(u.length, c.length)
  const ops = levenshteinOps(u, c)
  const distance = ops.filter((o) => o !== 'eq').length
  if (maxLen > 0 && distance / maxLen > 0.7) {
    return null
  }

  const parts: DiffPart[] = []
  let ui = 0
  let ci = 0
  for (const op of ops) {
    if (op === 'eq') {
      parts.push({ type: 'ok', text: u[ui] })
      ui++
      ci++
    } else if (op === 'sub') {
      parts.push({ type: 'bad', text: u[ui] })
      ui++
      ci++
    } else if (op === 'del') {
      parts.push({ type: 'extra', text: u[ui] })
      ui++
    } else {
      parts.push({ type: 'missing', text: '_' })
      ci++
    }
  }
  return parts
}

/** 正確答案顯示：有讀音時附在後面，例如「受ける（うける）」 */
export function formatTermWithReading(term: string, reading: string | null | undefined): string {
  const r = reading?.trim()
  return r && r !== term.trim() ? `${term}（${r}）` : term
}
