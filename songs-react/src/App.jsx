import { useState, useEffect, useRef, useCallback } from 'react'

const songs = [
  {
    id: 0,
    title: 'Motorola',
    audio: '/assets/songs/Motorola.wav',
    covers: [
      '/assets/covers/Motorola-Cover-Art-Final.JPEG',
      '/assets/covers/cyril-w-abla.jpg'
    ]
  },
  {
    id: 1,
    title: 'Melotron RSQ8 v1',
    audio: '/assets/songs/Melotron-RSQ8-v1.mp3',
    covers: [
      '/assets/covers/p4k-pixelated.PNG',
      '/assets/covers/Play4-Keeps-delux-cover.jpeg'
    ]
  },
  {
    id: 2,
    title: 'Good Company',
    audio: '/assets/songs/goodcompany.mp3',
    covers: [
      '/assets/covers/yillz-alt-1.PNG',
      '/assets/covers/Motorola-Cover-Art-Final.JPEG'
    ]
  },
  {
    id: 3,
    title: 'Rubies',
    audio: '/assets/songs/Rubies.mp3',
    covers: [
      '/assets/covers/Play4-Keeps-delux-cover.jpeg',
      '/assets/covers/cyril-w-abla.jpg'
    ]
  },
  {
    id: 4,
    title: 'IMMATURE',
    audio: '/assets/songs/IMMATURE-.wav',
    covers: [
      '/assets/covers/p4k-pixelated.PNG',
      '/assets/covers/yillz-alt-1.PNG'
    ]
  }
]

const CONFIG = {
  autoScrollSpeed: 0.5,
  pixelsPerSecond: 150
}

function App() {
  const [started, setStarted] = useState(false)
  const [paused, setPaused] = useState(false)
  const [currentSongIndex, setCurrentSongIndex] = useState(0)
  const [isScrolling, setIsScrolling] = useState(false)
  const [layersFlipped, setLayersFlipped] = useState(false)
  const [songDurations, setSongDurations] = useState({})

  const containerRef = useRef(null)
  const audioRefs = useRef([])
  const autoScrollRAF = useRef(null)
  const scrollTimeout = useRef(null)

  // Auto-scroll function
  const autoScroll = useCallback(() => {
    if (!started || paused || isScrolling) {
      if (started && !paused) {
        autoScrollRAF.current = requestAnimationFrame(autoScroll)
      }
      return
    }

    if (containerRef.current) {
      containerRef.current.scrollTop += CONFIG.autoScrollSpeed
    }
    autoScrollRAF.current = requestAnimationFrame(autoScroll)
  }, [started, paused, isScrolling])

  // Start experience
  const handleStart = () => {
    setStarted(true)

    // Play first song
    if (audioRefs.current[0]) {
      audioRefs.current[0].play().catch(e => console.error('Play error:', e))
    }

    // Start auto-scroll
    setTimeout(() => {
      autoScrollRAF.current = requestAnimationFrame(autoScroll)
    }, 500)
  }

  // Handle scroll
  const handleScroll = useCallback(() => {
    if (!started || !containerRef.current) return

    const scrollTop = containerRef.current.scrollTop
    const sections = containerRef.current.querySelectorAll('.song-section')

    // Find current section
    let cumulativeHeight = 0
    let currentSection = 0
    let sectionStartHeight = 0

    for (let i = 0; i < sections.length; i++) {
      const sectionHeight = sections[i].offsetHeight
      if (scrollTop < cumulativeHeight + sectionHeight) {
        currentSection = i
        sectionStartHeight = cumulativeHeight
        break
      }
      cumulativeHeight += sectionHeight
    }

    // Switch songs if needed
    if (currentSection !== currentSongIndex) {
      // Pause old song
      if (audioRefs.current[currentSongIndex]) {
        audioRefs.current[currentSongIndex].pause()
      }

      setCurrentSongIndex(currentSection)

      // Play new song
      if (audioRefs.current[currentSection]) {
        audioRefs.current[currentSection].currentTime = 0
        audioRefs.current[currentSection].play().catch(e => console.error('Play error:', e))
      }
    }

    // Update audio time based on scroll (ONLY when manually scrolling)
    if (isScrolling && audioRefs.current[currentSection]) {
      const section = sections[currentSection]
      const sectionHeight = section.offsetHeight
      const scrollInSection = scrollTop - sectionStartHeight
      const progress = Math.max(0, Math.min(1, scrollInSection / sectionHeight))

      const audio = audioRefs.current[currentSection]
      const duration = songDurations[currentSection]

      if (duration && Number.isFinite(duration)) {
        const targetTime = progress * duration
        if (Number.isFinite(targetTime) && targetTime >= 0 && targetTime <= duration) {
          audio.currentTime = targetTime
        }
      }
    }

    // Ensure audio is playing
    if (audioRefs.current[currentSection] && audioRefs.current[currentSection].paused && !paused) {
      audioRefs.current[currentSection].play().catch(e => console.error('Play error:', e))
    }
  }, [started, currentSongIndex, isScrolling, paused, songDurations])

  // Detect manual scrolling (wheel event)
  const handleWheel = useCallback(() => {
    setIsScrolling(true)
    clearTimeout(scrollTimeout.current)
    scrollTimeout.current = setTimeout(() => {
      setIsScrolling(false)
      // Resume auto-scroll
      if (started && !paused) {
        autoScrollRAF.current = requestAnimationFrame(autoScroll)
      }
    }, 150)
  }, [started, paused, autoScroll])

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && started) {
        e.preventDefault()
        setPaused(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [started])

  // Pause/play audio
  useEffect(() => {
    const audio = audioRefs.current[currentSongIndex]
    if (!audio) return

    if (paused) {
      audio.pause()
    } else if (started) {
      audio.play().catch(e => console.error('Play error:', e))
      if (autoScrollRAF.current === null) {
        autoScrollRAF.current = requestAnimationFrame(autoScroll)
      }
    }
  }, [paused, started, currentSongIndex, autoScroll])

  // Cleanup
  useEffect(() => {
    return () => {
      if (autoScrollRAF.current) {
        cancelAnimationFrame(autoScrollRAF.current)
      }
    }
  }, [])

  return (
    <>
      {/* Splash screen */}
      <div className={`splash ${started ? 'hidden' : ''}`} onClick={handleStart}>
        <img
          src="/assets/covers/Motorola-Cover-Art-Final.JPEG"
          alt="Motorola"
          className="splash-image"
        />
      </div>

      {/* Main experience */}
      <div
        ref={containerRef}
        className="experience-container"
        onScroll={handleScroll}
        onWheel={handleWheel}
      >
        {/* Background layer */}
        <div className={`background-layer ${layersFlipped ? 'front' : ''}`} />

        {/* Foreground layer */}
        <div
          className={`foreground-layer ${layersFlipped ? 'back' : ''}`}
          onClick={() => setLayersFlipped(prev => !prev)}
        >
          {songs.map((song, index) => (
            <section
              key={song.id}
              className="song-section"
              style={{
                minHeight: songDurations[index]
                  ? `${Math.max(window.innerHeight * 2, songDurations[index] * CONFIG.pixelsPerSecond)}px`
                  : `${window.innerHeight * 2}px`
              }}
            >
              <div className="collage">
                <img src={song.covers[0]} alt={song.title} className="cover-art main" />
                {song.covers[1] && (
                  <img src={song.covers[1]} alt={song.title} className="cover-art secondary" />
                )}
              </div>

              {/* Hidden audio element */}
              <audio
                ref={el => audioRefs.current[index] = el}
                src={song.audio}
                preload="auto"
                onLoadedMetadata={(e) => {
                  setSongDurations(prev => ({
                    ...prev,
                    [index]: e.target.duration
                  }))
                }}
              />
            </section>
          ))}
        </div>
      </div>
    </>
  )
}

export default App
