'use client'

import { useEffect, useRef, useState } from 'react'

import { clearLineOAuthState, readLineOAuthState } from '@/lib/line-oauth-state'

const callbackPostByCode = new Map<string, Promise<Response>>()

function postAuthCallback(code: string): Promise<Response> {
  let p = callbackPostByCode.get(code)
  if (!p) {
    p = fetch('/api/auth/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    }).finally(() => {
      callbackPostByCode.delete(code)
    })
    callbackPostByCode.set(code, p)
  }
  return p
}

function CallbackHandler() {
  const [isError, setIsError] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const urlParams = new URLSearchParams(window.location.search)
    const lineError = urlParams.get('error')
    const lineErrorDesc = urlParams.get('error_description')

    if (lineError) {
      setIsError(true)
      const decodedDesc = lineErrorDesc
        ? decodeURIComponent(lineErrorDesc.replace(/\+/g, ' '))
        : ''
      setErrorMessage(
        lineError === 'access_denied'
          ? '你已取消或未同意 LINE 登入，請再試一次。'
          : decodedDesc || `LINE 回傳錯誤：${lineError}`,
      )
      return
    }

    const code = urlParams.get('code')
    const state = urlParams.get('state')
    const savedState = readLineOAuthState()

    if (!code || !state) {
      setIsError(true)
      setErrorMessage('缺少授權參數（code 或 state）。請從登入重新開始。')
      return
    }

    if (state !== savedState) {
      clearLineOAuthState()
      setIsError(true)
      setErrorMessage('狀態驗證失敗（state 不一致）。請從同一瀏覽器完成登入。')
      return
    }

    postAuthCallback(code)
      .then(async (res) => {
        if (!aliveRef.current) return
        clearLineOAuthState()
        if (res.ok) {
          window.location.assign('/app')
        } else {
          setIsError(true)
          try {
            const data = await res.json()
            const detail =
              data?.details != null
                ? typeof data.details === 'string'
                  ? data.details
                  : JSON.stringify(data.details)
                : ''
            setErrorMessage(
              [data?.error ?? `登入失敗（HTTP ${res.status}）`, detail]
                .filter(Boolean)
                .join(' — '),
            )
          } catch {
            setErrorMessage(`登入失敗（HTTP ${res.status}）`)
          }
        }
      })
      .catch(() => {
        if (!aliveRef.current) return
        clearLineOAuthState()
        setIsError(true)
        setErrorMessage('連線失敗，請稍後再試')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, [])

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="text-center space-y-4 px-6">
          <p className="text-stamp-red font-medium">登入失敗，請重試</p>
          {errorMessage ? (
            <p className="text-ink-soft text-sm">{errorMessage}</p>
          ) : null}
          <a
            href="/api/auth/line-bootstrap"
            className="text-stamp-red-deep text-sm underline"
          >
            返回登入
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <p className="text-ink-soft text-sm">登入中，請稍候...</p>
    </div>
  )
}

export default function CallbackPage() {
  return <CallbackHandler />
}
