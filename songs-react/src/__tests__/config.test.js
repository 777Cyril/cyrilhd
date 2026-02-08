import { describe, it, expect } from 'vitest'
import CONFIG from '../config.js'

describe('CONFIG', () => {
  it('autoScrollSpeed and pixelsPerSecond are equal (sync invariant)', () => {
    expect(CONFIG.autoScrollSpeed).toBe(CONFIG.pixelsPerSecond)
  })

  it('autoScrollSpeed is 112 px/sec (~25% reduction from 150)', () => {
    expect(CONFIG.autoScrollSpeed).toBe(112)
  })

  it('pixelsPerSecond is 112 px/sec (~25% reduction from 150)', () => {
    expect(CONFIG.pixelsPerSecond).toBe(112)
  })

  it('fadeOutSeconds is unchanged at 1.2', () => {
    expect(CONFIG.fadeOutSeconds).toBe(1.2)
  })

  it('scrollResumeDelay is unchanged at 150ms', () => {
    expect(CONFIG.scrollResumeDelay).toBe(150)
  })
})
