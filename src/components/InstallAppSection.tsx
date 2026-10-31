'use client'

import { useEffect, useState } from 'react'

import {
  detectInstallPlatform,
  promptInstall,
  useInstallPrompt,
  useInstallPromptCapture,
  type InstallPlatform,
} from '@/lib/install-prompt'

/** 根 layout 掛一次：接住 Chrome 的安裝事件，供設定頁使用 */
export function InstallPromptListener() {
  useInstallPromptCapture()
  return null
}

/**
 * 設定頁「安裝到手機桌面」：Chrome 系顯示安裝按鈕；iPhone 顯示「分享 → 加入主畫面」步驟；
 * App 內建瀏覽器提示改用瀏覽器開啟；已從主畫面開啟時不顯示
 */
export function InstallAppSection() {
  const [platform, setPlatform] = useState<InstallPlatform | null>(null)
  const { canPrompt, installed } = useInstallPrompt()

  useEffect(() => setPlatform(detectInstallPlatform()), [])

  if (platform === null || platform === 'standalone') return null

  return (
    <div className="bg-cream border border-line rounded-lg p-6 mb-4">
      <h2 className="font-serif font-bold mb-1">安裝到手機桌面</h2>
      <p className="text-sm text-ink-soft mb-3">
        加到主畫面後，點圖示就能直接開啟，畫面像 App 一樣沒有網址列。不需要到商店下載，也不占空間。
      </p>

      {installed ? (
        <p className="text-sm">已安裝，之後可以從主畫面的「字力測驗」圖示開啟。</p>
      ) : platform === 'in-app' ? (
        <p className="text-sm">
          目前在 LINE 等 App 的內建瀏覽器中，無法加到主畫面。請點右上角選單，選擇「用瀏覽器開啟」（iPhone 用
          Safari、Android 用 Chrome），再回到這一頁安裝。
        </p>
      ) : platform === 'ios' ? (
        <ol className="text-sm list-decimal pl-5 space-y-1">
          <li>
            點瀏覽器的<span className="font-semibold">分享</span>按鈕（Safari 在畫面下方，Chrome 在網址列右側）
          </li>
          <li>
            往下找到並點<span className="font-semibold">「加入主畫面」</span>
          </li>
          <li>點右上角「新增」</li>
        </ol>
      ) : canPrompt ? (
        <button
          type="button"
          onClick={() => void promptInstall()}
          className="inline-block bg-ink text-cream font-semibold text-sm px-4 py-2 rounded hover:bg-stamp-red-deep"
        >
          安裝
        </button>
      ) : (
        <p className="text-sm">
          點瀏覽器右上角的選單 ⋮，選擇「安裝應用程式」或「加到主畫面」。若沒有這個選項，請改用手機的 Chrome 開啟
          www.zilitest.com。
        </p>
      )}

      {platform === 'ios' && !installed && (
        <p className="text-[12.5px] text-ink-soft mt-3">
          從主畫面開啟時需要重新用 LINE 登入一次，之後 30 天內不用再登入。
        </p>
      )}
    </div>
  )
}
