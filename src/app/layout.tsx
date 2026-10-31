import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Mono, Noto_Sans_TC, Noto_Serif_TC } from 'next/font/google'

import { AppDialogProvider } from '@/components/AppDialog'
import { InstallPromptListener } from '@/components/InstallAppSection'
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
  title: '字力測驗｜英日韓多語自學的單字成長系統',
  description:
    '用自己的單字同時自學英文、日文、韓文。系統依熟練度每天安排複習任務，掌握字數、等級、連續天數與成就讓你看見成長。免下載 App，LINE 登入即可開始。',
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
    title: '字力測驗｜英日韓多語自學的單字成長系統',
    description:
      '用自己的單字同時自學英文、日文、韓文。系統依熟練度每天安排複習任務，掌握字數、等級、連續天數與成就讓你看見成長。免下載 App，LINE 登入即可開始。',
    images: [{ url: '/logo.png', width: 512, height: 512, alt: '字力測驗' }],
  },
  icons: {
    icon: '/favicon.ico',
    // logo.png 背景透明，iOS 主畫面會補成黑底，改用合成紙色底的版本
    apple: '/icons/apple-touch-icon.png',
  },
  // iPhone「加入主畫面」後以全螢幕開啟（manifest 見 src/app/manifest.ts）
  appleWebApp: {
    capable: true,
    title: '字力測驗',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  themeColor: '#f6f3ea',
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
        <InstallPromptListener />
        <AppDialogProvider>{children}</AppDialogProvider>
      </body>
    </html>
  )
}
