import type { Metadata } from 'next'

import { AppDialogProvider } from '@/components/AppDialog'

import './globals.css'

export const metadata: Metadata = {
  title: '字力測驗｜英文日文檢定單字背誦與測驗',
  description:
    '英文、日文檢定單字神器。把單字，練成你的字力。功能完整、價格合理，LINE 登入即可背單字與測驗。',
  icons: {
    icon: '/favicon.ico',
    apple: '/logo.png',
  },
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

