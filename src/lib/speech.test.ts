import { describe, expect, it } from 'vitest'

import { pickVoice, speechText } from '@/lib/speech'

const voices = [
  { name: 'Microsoft David', lang: 'en-US', default: true },
  { name: 'Google UK English Female', lang: 'en-GB' },
  { name: 'Google US English', lang: 'en-US' },
  { name: 'Kyoko', lang: 'ja-JP' },
  { name: 'Google 日本語', lang: 'ja_JP' },
]

describe('pickVoice', () => {
  it('同地區且高品質的語音優先', () => {
    expect(pickVoice(voices, 'en')?.name).toBe('Google US English')
  })

  it('接受底線格式的語言代碼', () => {
    expect(pickVoice(voices, 'ja')?.name).toBe('Google 日本語')
  })

  it('沒有地區完全符合時，仍可用同語言的其他地區', () => {
    expect(pickVoice([{ name: 'Daniel', lang: 'en-GB' }], 'en')?.name).toBe('Daniel')
  })

  it('沒有該語言語音時回傳 null', () => {
    expect(pickVoice(voices, 'ko')).toBeNull()
    expect(pickVoice([], 'en')).toBeNull()
  })
})

describe('speechText', () => {
  it('日文有讀音時唸讀音', () => {
    expect(speechText('受ける', 'うける', 'ja')).toBe('うける')
  })

  it('日文沒有讀音、或其他語言時唸單字', () => {
    expect(speechText('受ける', null, 'ja')).toBe('受ける')
    expect(speechText(' journey ', 'x', 'en')).toBe('journey')
    expect(speechText('꾸준히', null, 'ko')).toBe('꾸준히')
  })
})
