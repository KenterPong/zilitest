'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

import { AUTO_SPEAK_KEY, pickVoice, SPEECH_LOCALE } from '@/lib/speech'
import type { Language } from '@/types/vocab'

/** 整頁共用一份語音清單（語音常在頁面載入後才非同步出現） */
let voices: SpeechSynthesisVoice[] = []
const listeners = new Set<() => void>()
let started = false

function supported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

function start() {
  if (started || !supported()) return
  started = true
  const load = () => {
    voices = window.speechSynthesis.getVoices()
    listeners.forEach((l) => l())
  }
  load()
  window.speechSynthesis.addEventListener('voiceschanged', load)
}

function subscribe(listener: () => void) {
  start()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** 回傳可用的發音函式；瀏覽器不支援或沒有該語言語音時為 null */
export function useSpeaker(language: Language): ((text: string) => void) | null {
  const list = useSyncExternalStore(
    subscribe,
    () => voices,
    () => voices
  )
  const voice = supported() ? pickVoice(list, language) : null

  const speak = useCallback(
    (text: string) => {
      if (!voice || !text) return
      const synth = window.speechSynthesis
      synth.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.voice = voice
      u.lang = voice.lang || SPEECH_LOCALE[language]
      u.rate = 0.9
      synth.speak(u)
    },
    [voice, language]
  )

  return voice ? speak : null
}

function readAutoSpeak(): boolean {
  try {
    return window.localStorage.getItem(AUTO_SPEAK_KEY) === '1'
  } catch {
    return false
  }
}

/** 自動播放發音（預設關閉，只存在這台裝置） */
export function useAutoSpeak(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(false)
  useEffect(() => setOn(readAutoSpeak()), [])
  const update = useCallback((next: boolean) => {
    setOn(next)
    try {
      window.localStorage.setItem(AUTO_SPEAK_KEY, next ? '1' : '0')
    } catch {
      // 無痕模式等情況無法儲存，只影響這次
    }
  }, [])
  return [on, update]
}
