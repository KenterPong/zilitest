'use client'

/**
 * 安裝到主畫面（PWA）：
 * Chrome 系瀏覽器在頁面載入時發出 beforeinstallprompt，之後切換頁面不會再發，
 * 因此由根 layout 的 InstallPromptListener 全站先接住，設定頁再取用。
 */
import { useEffect, useSyncExternalStore } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** 根 layout 掛一次，全站接住安裝事件 */
export function useInstallPromptCapture() {
  useEffect(() => {
    const onPrompt = (e: Event) => {
      // 不讓瀏覽器自己跳出安裝列，改由設定頁的按鈕觸發
      e.preventDefault()
      deferred = e as BeforeInstallPromptEvent
      emit()
    }
    const onInstalled = () => {
      deferred = null
      installed = true
      emit()
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])
}

/** 目前是否可用按鈕安裝、是否剛安裝完成 */
export function useInstallPrompt(): { canPrompt: boolean; installed: boolean } {
  const canPrompt = useSyncExternalStore(subscribe, () => deferred !== null, () => false)
  const justInstalled = useSyncExternalStore(subscribe, () => installed, () => false)
  return { canPrompt, installed: justInstalled }
}

/** 開啟瀏覽器的安裝視窗；回傳是否接受安裝 */
export async function promptInstall(): Promise<boolean> {
  const e = deferred
  if (!e) return false
  // 每個事件只能 prompt 一次
  deferred = null
  emit()
  await e.prompt()
  const { outcome } = await e.userChoice
  return outcome === 'accepted'
}

export type InstallPlatform = 'standalone' | 'ios' | 'in-app' | 'other'

/** 依 UA 判斷要顯示哪種安裝說明（只在瀏覽器端呼叫） */
export function detectInstallPlatform(): InstallPlatform {
  const nav = navigator as Navigator & { standalone?: boolean }
  if (window.matchMedia('(display-mode: standalone)').matches || nav.standalone) return 'standalone'
  const ua = nav.userAgent
  // LINE、Facebook、Instagram 的內建瀏覽器不能加到主畫面
  if (/\bLine\/|FBAN|FBAV|Instagram/i.test(ua)) return 'in-app'
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1)
  // iOS 16.4 起 Safari 以外的瀏覽器也能從分享選單加入主畫面
  return ios ? 'ios' : 'other'
}
