'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import type { DbUser } from '@/types/user'

interface AppNavProps {
  user: DbUser
}

const DESKTOP_LINKS = [
  { href: '/app/cards', label: '背誦' },
  { href: '/app/quiz', label: '測驗' },
  { href: '/app/settings', label: '設定' },
] as const

const MOBILE_LINKS = [
  { href: '/app/cards', label: '背誦' },
  { href: '/app/quiz', label: '測驗' },
  { href: '/app', label: '回單字本列表' },
  { href: '/app/settings', label: '帳號設定' },
] as const

export function AppNav({ user }: AppNavProps) {
  const router = useRouter()
  const initial = (user.display_name ?? '用')[0]
  const [menuOpen, setMenuOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function onPointerDown(e: PointerEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  async function logout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      setMenuOpen(false)
      router.replace('/auth/login')
      router.refresh()
    } catch {
      setLoggingOut(false)
    }
  }

  return (
    <nav ref={navRef} className="relative border-b border-line bg-paper/90">
      <div className="flex items-center justify-between px-4 sm:px-8 py-4">
        <div className="flex items-center gap-6 min-w-0">
          <Link
            href="/app"
            className="font-serif font-black text-xl text-ink flex items-center gap-2.5 shrink-0"
            onClick={() => setMenuOpen(false)}
          >
            <Image src="/logo.png" alt="字力測驗" width={32} height={32} className="rounded-sm" />
            字力測驗
          </Link>
          <div className="hidden sm:flex items-center gap-4 text-sm text-ink-soft">
            {DESKTOP_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-ink">
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/app/settings"
            className="hidden sm:flex items-center gap-2.5 text-sm text-ink-soft hover:text-ink"
          >
            {user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatar_url}
                alt=""
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-stamp-red text-white flex items-center justify-center font-serif font-bold text-sm">
                {initial}
              </div>
            )}
            <span>{user.display_name ?? '使用者'}</span>
          </Link>

          <button
            type="button"
            className="sm:hidden inline-flex items-center justify-center w-10 h-10 rounded-sm border border-line text-ink"
            aria-label={menuOpen ? '關閉選單' : '開啟選單'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? (
              <span className="text-xl leading-none" aria-hidden>
                ×
              </span>
            ) : (
              <span className="flex flex-col gap-1.5" aria-hidden>
                <span className="block w-4 h-0.5 bg-ink" />
                <span className="block w-4 h-0.5 bg-ink" />
                <span className="block w-4 h-0.5 bg-ink" />
              </span>
            )}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="sm:hidden absolute inset-x-0 top-full z-50 border-b border-line bg-cream shadow-lg">
          <div className="px-4 py-3 border-b border-line flex items-center gap-2.5">
            {user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatar_url}
                alt=""
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-stamp-red text-white flex items-center justify-center font-serif font-bold text-sm">
                {initial}
              </div>
            )}
            <span className="text-sm text-ink">{user.display_name ?? '使用者'}</span>
          </div>
          <ul className="py-1">
            {MOBILE_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="block px-4 py-3 text-sm text-ink hover:bg-paper-deep"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => void logout()}
                disabled={loggingOut}
                className="w-full text-left px-4 py-3 text-sm text-stamp-red hover:bg-paper-deep disabled:opacity-60"
              >
                {loggingOut ? '登出中…' : '登出'}
              </button>
            </li>
          </ul>
        </div>
      )}
    </nav>
  )
}
