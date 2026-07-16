import type { Metadata } from 'next'

import { AppDialogProvider } from '@/components/AppDialog'

import './globals.css'

export const metadata: Metadata = {
  title: '字力測驗 zilitest',
  description: '英文、日文檢定單字背誦與測驗工具，LINE 登入即可使用。',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-Hant">
      <body>
        <AppDialogProvider>{children}</AppDialogProvider>
      </body>
    </html>
  )
}

