import CONFIG from './config.js'

export function computeSectionHeight(duration, minHeight) {
  if (duration) {
    return Math.max(minHeight, duration * CONFIG.pixelsPerSecond)
  }
  return minHeight
}
