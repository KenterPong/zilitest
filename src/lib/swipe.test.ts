import { describe, expect, it } from 'vitest'

import { isTap, swipeDecision, swipeHintOpacity, swipeThreshold } from '@/lib/swipe'

describe('swipeThreshold', () => {
  it('卡片寬度 25%，至少 80px', () => {
    expect(swipeThreshold(400)).toBe(100)
    expect(swipeThreshold(240)).toBe(80)
  })
})

describe('swipeDecision', () => {
  it('右滑超過門檻為認得，左滑為不認得', () => {
    expect(swipeDecision(100, 400)).toBe('known')
    expect(swipeDecision(-130, 400)).toBe('unknown')
  })

  it('未達門檻彈回', () => {
    expect(swipeDecision(99, 400)).toBeNull()
    expect(swipeDecision(-40, 400)).toBeNull()
  })
})

describe('isTap / swipeHintOpacity', () => {
  it('幾乎沒移動視為點擊', () => {
    expect(isTap(3, -2)).toBe(true)
    expect(isTap(12, 0)).toBe(false)
  })

  it('提示透明度隨距離增加，上限 1', () => {
    expect(swipeHintOpacity(50, 400)).toBe(0.5)
    expect(swipeHintOpacity(-300, 400)).toBe(1)
  })
})
