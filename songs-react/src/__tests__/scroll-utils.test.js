import { describe, it, expect } from 'vitest'
import { computeSectionHeight } from '../scroll-utils.js'
import CONFIG from '../config.js'

describe('computeSectionHeight', () => {
  const viewportMin = 2000 // simulate window.innerHeight * 2

  it('returns duration * pixelsPerSecond when result exceeds minHeight', () => {
    const duration = 200
    const expected = duration * CONFIG.pixelsPerSecond
    expect(computeSectionHeight(duration, viewportMin)).toBe(expected)
  })

  it('returns minHeight when duration-based height is smaller', () => {
    const duration = 5 // 5 * 112 = 560 < 2000
    expect(computeSectionHeight(duration, viewportMin)).toBe(viewportMin)
  })

  it('returns minHeight when duration is undefined', () => {
    expect(computeSectionHeight(undefined, viewportMin)).toBe(viewportMin)
  })

  it('returns minHeight when duration is 0', () => {
    expect(computeSectionHeight(0, viewportMin)).toBe(viewportMin)
  })

  it('section height equals duration * pixelsPerSecond for typical tracks', () => {
    const duration = 180 // 3-minute song
    const result = computeSectionHeight(duration, viewportMin)
    expect(result).toBe(duration * 112)
  })

  it('audio-scroll sync: scroll time matches audio duration', () => {
    // KEY INVARIANT: scrollTime = sectionHeight / autoScrollSpeed
    // sectionHeight = duration * pixelsPerSecond
    // Since pixelsPerSecond === autoScrollSpeed, scrollTime === duration
    const duration = 240
    const sectionHeight = computeSectionHeight(duration, 0)
    const scrollTime = sectionHeight / CONFIG.autoScrollSpeed
    expect(scrollTime).toBeCloseTo(duration, 5)
  })
})
