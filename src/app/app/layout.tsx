import { redirect } from 'next/navigation'

import { AppNav } from '@/components/AppNav'
import { SiteFooter } from '@/components/SiteChrome'
import { getSessionUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  if (!user || user.status === 'cancelled') {
    redirect('/auth/login')
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <AppNav user={user} />
      <div className="flex-1 w-full">{children}</div>
      <SiteFooter />
    </div>
  )
}
