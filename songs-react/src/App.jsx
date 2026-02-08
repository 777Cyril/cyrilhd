import { useState, useEffect, useRef, useCallback } from 'react'
import collageLayout from './collage-layout.json'
import CONFIG from './config.js'
import { computeSectionHeight } from './scroll-utils.js'

const assetUrl = (path) => {
  // Keep absolute shared asset paths stable in production.
  if (path.startsWith('/assets/')) return path
  if (path.startsWith('assets/')) return `/${path}`
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`
}

const songs = [
  {
    id: 0,
    title: 'Muimui',
    audio: assetUrl('assets/songs/muimui.mp3')
  },
  {
    id: 1,
    title: 'Motorola',
    audio: assetUrl('assets/songs/Motorola.wav')
  },
  {
    id: 2,
    title: 'Good Company',
    audio: assetUrl('assets/songs/goodcompany.mp3')
  },
  {
    id: 3,
    title: 'Atlanta v2',
    audio: assetUrl('assets/songs/atlanta v2.mp3')
  },
  {
    id: 4,
    title: 'Melotron RSQ8 v1',
    audio: assetUrl('assets/songs/Melotron RSQ8 v1.mp3')
  },
  {
    id: 5,
    title: 'Rubies',
    audio: assetUrl('assets/songs/Rubies.mp3')
  },
  {
    id: 6,
    title: 'IMMATURE',
    audio: assetUrl('assets/songs/IMMATURE .wav')
  }
]

function App() {
  const [started, setStarted] = useState(false)
  const [layersFlipped, setLayersFlipped] = useState(false)

  // Refs for performance-critical values (avoid state re-renders on scroll)
  const containerRef = useRef(null)
  const backgroundRef = useRef(null)
  const backdropRef = useRef(null)
  const foregroundRef = useRef(null)
  const audioRefs = useRef([])
  const sectionRefs = useRef([])

  const collageLayouts = useRef([])

  const isAutoScrolling = useRef(false)
  const isPaused = useRef(false)
  const isManualScrolling = useRef(false)
  const currentSongIndex = useRef(0)
  const lastAutoScrollTime = useRef(null)
  const rafId = useRef(null)
  const scrollTimeout = useRef(null)
  const durations = useRef({})
  const loadedCount = useRef(0)
  const audioHandled = useRef({})

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)

  // Unlock audio for iOS/Safari
  const unlockAudio = useCallback((audio) => {
    if (!audio) return
    const wasMuted = audio.muted
    audio.muted = true
    const p = audio.play()
    if (p && p.then) {
      p.then(() => {
        audio.pause()
        audio.currentTime = 0
        audio.muted = wasMuted
      }).catch(() => {
        audio.muted = wasMuted
      })
    }
  }, [])

  // Populate 777 tags in the backdrop pane
  const populate777Tags = useCallback(() => {
    const container = containerRef.current
    const bg = backgroundRef.current
    const pane = backdropRef.current
    if (!container || !bg || !pane) return

    const totalHeight = Math.max(container.scrollHeight, container.clientHeight)
    if (totalHeight <= 0) return

    bg.style.height = totalHeight + 'px'
    pane.style.height = totalHeight + 'px'
    pane.innerHTML = ''

    // One 777 tag per half viewport so at least one is always visible
    const spacing = window.innerHeight / 2
    const tagCount = Math.floor(totalHeight / spacing)

    for (let i = 0; i < tagCount; i++) {
      const tag = document.createElement('div')
      tag.className = 'seven-tag'
      tag.innerHTML = '<span>7</span><span>7</span><span>7</span>'
      tag.style.top = Math.round(spacing * (i + 1)) + 'px'
      pane.appendChild(tag)
    }
  }, [])

  const markAudioHandled = useCallback((index) => {
    if (audioHandled.current[index]) return false
    audioHandled.current[index] = true
    loadedCount.current++
    return true
  }, [])

  const playSafely = useCallback((audio, label) => {
    if (!audio) return
    audio.play().catch((err) => {
      console.error(`Play error (${label}):`, err)
    })
  }, [])

  const playExclusive = useCallback((index, startAt = 0, label = 'exclusive-play') => {
    audioRefs.current.forEach((audio, i) => {
      if (!audio) return
      if (i !== index) {
        audio.pause()
        audio.currentTime = 0
        return
      }
      audio.volume = 1
      audio.muted = false
      audio.currentTime = startAt
      playSafely(audio, label)
    })
  }, [playSafely])

  // Auto-scroll using RAF with delta-time
  const autoScroll = useCallback(() => {
    if (!isAutoScrolling.current || isPaused.current || isManualScrolling.current) {
      lastAutoScrollTime.current = null
      rafId.current = null
      return // Stop loop — resumeFromScroll or unpause will restart
    }

    const now = performance.now()
    if (lastAutoScrollTime.current === null) {
      lastAutoScrollTime.current = now
    }
    const delta = (now - lastAutoScrollTime.current) / 1000
    lastAutoScrollTime.current = now

    if (containerRef.current) {
      containerRef.current.scrollTop += CONFIG.autoScrollSpeed * delta
    }
    rafId.current = requestAnimationFrame(autoScroll)
  }, [])

  // Resume from manual scroll
  const resumeFromScroll = useCallback(() => {
    isManualScrolling.current = false

    // Ensure audio is playing when scroll ends
    const audio = audioRefs.current[currentSongIndex.current]
    if (audio && !isPaused.current && audio.paused) {
      playExclusive(currentSongIndex.current, audio.currentTime, 'resume-from-scroll')
    }

    // Restart auto-scroll
    if (isAutoScrolling.current && !isPaused.current) {
      lastAutoScrollTime.current = null
      rafId.current = requestAnimationFrame(autoScroll)
    }
  }, [autoScroll, playExclusive])

  // Fade out near end of track
  const applyFadeOut = useCallback((audio, duration) => {
    if (!audio || audio.paused || isPaused.current) return
    const remaining = duration - audio.currentTime
    if (!Number.isFinite(remaining)) return

    if (remaining <= CONFIG.fadeOutSeconds) {
      audio.volume = Math.max(0, Math.min(1, remaining / CONFIG.fadeOutSeconds))
    } else if (!audio.muted && audio.volume !== 1) {
      audio.volume = 1
    }
  }, [])

  const buildCollageLayout = useCallback((songIndex) => {
    const base = Array.isArray(collageLayout.base) ? collageLayout.base : []
    const overrides = collageLayout.overrides?.[String(songIndex)] || []
    const overrideMap = new Map(overrides.map(item => [item.src, item]))

    const merged = base.map(item => ({
      ...item,
      src: assetUrl(item.src),
      ...(overrideMap.get(item.src) || {})
    }))

    // Allow per-song additions not in base
    overrides.forEach(item => {
      if (!merged.find(entry => entry.src === item.src)) {
        merged.push({ ...item, src: assetUrl(item.src) })
      }
    })

    collageLayouts.current[songIndex] = merged
  }, [])

  // Handle scroll — find current section, sync audio
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return

    const scrollTop = containerRef.current.scrollTop
    const sections = sectionRefs.current

    // Find current section
    let cumHeight = 0
    let section = 0
    let sectionStart = 0
    let found = false

    for (let i = 0; i < sections.length; i++) {
      if (!sections[i]) continue
      const h = sections[i].offsetHeight
      if (scrollTop < cumHeight + h) {
        section = i
        sectionStart = cumHeight
        found = true
        break
      }
      cumHeight += h
    }

    if (!found) {
      section = Math.max(0, sections.length - 1)
      const last = sections[section]
      sectionStart = cumHeight - (last ? last.offsetHeight : 0)
    }

    // Switch songs if section changed
    if (section !== currentSongIndex.current) {
      const oldAudio = audioRefs.current[currentSongIndex.current]
      if (oldAudio) oldAudio.pause()

      currentSongIndex.current = section
      const newAudio = audioRefs.current[section]
      const dur = durations.current[section]
      if (newAudio && dur) {
        playExclusive(section, 0, 'section-switch')
      }
    }

    // Calculate progress within current section
    const currentAudio = audioRefs.current[section]
    const currentDur = durations.current[section]
    if (currentAudio && currentDur) {
      const sectionEl = sections[section]
      if (!sectionEl) return
      const sectionHeight = sectionEl.offsetHeight
      const scrollInSection = scrollTop - sectionStart
      const progress = Math.max(0, Math.min(1, scrollInSection / sectionHeight))

      // DJ scrub: only update currentTime during manual scroll
      if (isManualScrolling.current) {
        const targetTime = progress * currentDur
        if (Number.isFinite(targetTime) && targetTime >= 0 && targetTime <= currentDur) {
          // Throttle: only update if delta > 50ms to avoid thrashing
          if (Math.abs(currentAudio.currentTime - targetTime) > 0.05) {
            currentAudio.currentTime = targetTime
          }
          if (targetTime < currentDur - CONFIG.fadeOutSeconds) {
            currentAudio.volume = 1
          }
        }
      }

      // Only restart audio during auto-scroll (not during manual scrub)
      if (!isManualScrolling.current) {
        const nearEnd = currentAudio.currentTime >= Math.max(0, currentDur - 0.05)
        if (currentAudio.paused && !isPaused.current && !nearEnd) {
          playExclusive(section, currentAudio.currentTime, 'ensure-playing')
        }
      }

      applyFadeOut(currentAudio, currentDur)
    }
    populate777Tags()
  }, [applyFadeOut, playExclusive, populate777Tags])

  // Start experience on splash click
  const handleStart = useCallback(() => {
    if (started) return
    setStarted(true)

    // Play first song
    const first = audioRefs.current[0]
    if (first) {
      playExclusive(0, 0, 'start-first-song')
    }

    // iOS unlock for remaining tracks after first track has started.
    if (isIOS) {
      setTimeout(() => {
        audioRefs.current.forEach((a, i) => {
          if (i > 0) unlockAudio(a)
        })
      }, 250)
    }

    // Start auto-scroll after brief delay
    setTimeout(() => {
      isAutoScrolling.current = true
      rafId.current = requestAnimationFrame(autoScroll)
      populate777Tags()
    }, 500)
  }, [started, autoScroll, unlockAudio, playExclusive, populate777Tags, isIOS])

  // Toggle layers on click (after started)
  const handleExperienceClick = useCallback(() => {
    if (!started) return
    setLayersFlipped(prev => !prev)
  }, [started])

  // Wheel event — flag manual scrolling
  const handleWheel = useCallback(() => {
    isManualScrolling.current = true
    clearTimeout(scrollTimeout.current)
    scrollTimeout.current = setTimeout(resumeFromScroll, CONFIG.scrollResumeDelay)
  }, [resumeFromScroll])

  // Touch events — flag manual scrolling
  const handleTouchStart = useCallback(() => {
    isManualScrolling.current = true
    clearTimeout(scrollTimeout.current)
  }, [])

  const handleTouchEnd = useCallback(() => {
    clearTimeout(scrollTimeout.current)
    scrollTimeout.current = setTimeout(resumeFromScroll, CONFIG.scrollResumeDelay)
  }, [resumeFromScroll])

  // Keyboard: spacebar pause/play
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && started) {
        e.preventDefault()
        isPaused.current = !isPaused.current

        const audio = audioRefs.current[currentSongIndex.current]
        if (isPaused.current) {
          if (audio) audio.pause()
        } else {
          if (audio) {
            playExclusive(currentSongIndex.current, audio.currentTime, 'spacebar-resume')
          }
          if (isAutoScrolling.current) {
            lastAutoScrollTime.current = null
            rafId.current = requestAnimationFrame(autoScroll)
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [started, autoScroll, playExclusive])

  // Resize handler — recompute 777 tags
  useEffect(() => {
    const onResize = () => populate777Tags()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [populate777Tags])

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current)
      clearTimeout(scrollTimeout.current)
    }
  }, [])

  // Keep backdrop sizing in sync even before metadata is loaded.
  useEffect(() => {
    populate777Tags()
  }, [populate777Tags])

  // Audio metadata loaded handler
  const handleMetadata = useCallback((index, e) => {
    durations.current[index] = e.target.duration
    markAudioHandled(index)

    if (!collageLayouts.current[index]) {
      buildCollageLayout(index)
    }

    // Let section heights settle, then repopulate
    requestAnimationFrame(() => {
      populate777Tags()
      setTimeout(populate777Tags, 100)
    })
  }, [populate777Tags, buildCollageLayout, markAudioHandled])

  const handleAudioError = useCallback((index, songSrc) => {
    markAudioHandled(index)
    console.error('Audio failed to load:', songSrc)
    populate777Tags()
  }, [markAudioHandled, populate777Tags])

  // Compute section height from duration
  const getSectionHeight = (index) => {
    return computeSectionHeight(durations.current[index], window.innerHeight * 2)
  }

  return (
    <>
      {/* Splash screen */}
      <div className={`splash ${started ? 'hidden' : ''}`} onClick={handleStart}>
        <img
          src={assetUrl('assets/covers/hideout.png')}
          alt="Hideout"
          className="splash-image"
        />
      </div>

      {/* Main experience */}
      <div
        ref={containerRef}
        className="experience-container"
        onScroll={handleScroll}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={handleExperienceClick}
      >
        {/* Background layer (777 backdrop) */}
        <div
          ref={backgroundRef}
          className={`background-layer ${layersFlipped ? 'front' : ''}`}
        >
          <div ref={backdropRef} className="backdrop-pane" />
        </div>

        {/* Foreground layer (cover art) */}
        <div
          ref={foregroundRef}
          className={`foreground-layer ${layersFlipped ? 'back' : ''}`}
        >
          {songs.map((song, index) => (
            <section
              key={song.id}
              ref={el => sectionRefs.current[index] = el}
              className="song-section"
              style={{ minHeight: getSectionHeight(index) }}
            >
              <div className="collage">
                {(() => {
                  // Recompute from JSON on render so x/y edits hot-reload reliably in dev.
                  buildCollageLayout(index)
                  return (collageLayouts.current[index] || []).map((item, itemIndex) => (
                    <img
                      key={`${song.id}-${itemIndex}`}
                      src={item.src}
                      alt=""
                      aria-hidden="true"
                      className="cover-art collage-item"
                      onError={() => {
                        console.error('Cover failed to load:', item.src)
                      }}
                      style={{
                        '--x': `${item.x}%`,
                        '--y': `${item.y}%`,
                        '--r': `${item.rot}deg`,
                        '--s': item.scale,
                        '--z': item.z
                      }}
                    />
                  ))
                })()}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* Hidden audio elements */}
      {songs.map((song, index) => (
        <audio
          key={song.id}
          ref={el => audioRefs.current[index] = el}
          src={song.audio}
          preload="auto"
          onLoadedMetadata={(e) => handleMetadata(index, e)}
          onError={() => handleAudioError(index, song.audio)}
          onTimeUpdate={() => {
            const dur = durations.current[index]
            if (dur) applyFadeOut(audioRefs.current[index], dur)
          }}
        />
      ))}
    </>
  )
}

export default App
