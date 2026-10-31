import type { MetadataRoute } from 'next'

/**
 * 加到手機主畫面（PWA）：以獨立視窗開啟、從今日任務進入。
 * 不使用 service worker，不支援離線（每次都取最新的任務與熟練度）。
 * 圖示由 public/logo.png 合成到紙色底（--paper）上；maskable 版縮小以落在安全區內
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/app',
    name: '字力測驗',
    short_name: '字力測驗',
    description: '英文、日文、韓文自學者的單字成長系統',
    lang: 'zh-Hant',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f6f3ea',
    theme_color: '#f6f3ea',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
