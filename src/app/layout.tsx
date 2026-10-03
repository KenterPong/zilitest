import type { Metadata } from 'next'
import { IBM_Plex_Mono, Noto_Sans_TC, Noto_Serif_TC } from 'next/font/google'

import { AppDialogProvider } from '@/components/AppDialog'
import { SITE_URL } from '@/lib/site'

import './globals.css'

// CJK 字型檔案大，不預載；next/font 自行託管並避免版面跳動
const notoSans = Noto_Sans_TC({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--font-sans',
})
const notoSerif = Noto_Serif_TC({
  weight: ['500', '700', '900'],
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--font-serif',
})
const plexMono = IBM_Plex_Mono({
  weight: ['500', '600'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: '字力測驗｜多益 TOEIC・JLPT 日檢單字背誦與測驗App',
  description:
    '多益 TOEIC、JLPT 日檢背單字神器。內建錯誤率分析、卡牌背誦、Excel 匯入，功能完整、價格合理，LINE 登入即可開始背單字。',
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    locale: 'zh_TW',
    url: SITE_URL,
    siteName: '字力測驗',
    title: '字力測驗｜多益 TOEIC・JLPT 日檢單字背誦與測驗App',
    description:
      '多益 TOEIC、JLPT 日檢背單字神器。內建錯誤率分析、卡牌背誦、Excel 匯入，功能完整、價格合理，LINE 登入即可開始背單字。',
    images: [{ url: '/logo.png', width: 512, height: 512, alt: '字力測驗' }],
  },
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
    <html
      lang="zh-Hant"
      className={`${notoSans.variable} ${notoSerif.variable} ${plexMono.variable}`}
    >
      <body>
        <AppDialogProvider>{children}</AppDialogProvider>
      </body>
    </html>
  )
}
