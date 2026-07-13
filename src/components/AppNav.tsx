import Link from 'next/link'

import type { DbUser } from '@/types/user'

interface AppNavProps {
  user: DbUser
}

export function AppNav({ user }: AppNavProps) {
  const initial = (user.display_name ?? '用')[0]

  return (
    <nav className="flex items-center justify-between px-8 py-4 border-b border-line bg-paper/90">
      <Link href="/app" className="font-serif font-black text-xl text-ink">
        字力測驗
      </Link>
      <div className="flex items-center gap-2.5 text-sm text-ink-soft">
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
      </div>
    </nav>
  )
}
