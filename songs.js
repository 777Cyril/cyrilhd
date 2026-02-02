// Configuration
const CONFIG = {
    autoScrollSpeed: 0.5, // pixels per frame (slow, smooth)
    spacebarSkip: 30, // seconds to skip with spacebar
    scrollScrubSensitivity: 0.001, // how much scroll affects audio time
    pixelsPerSecond: 100 // how many pixels of scroll per second of audio
};

// State
let state = {
    started: false,
    autoScrolling: false,
    paused: false,
    currentSongIndex: 0,
    layersFlipped: false,
    songs: [],
    lastScrollTop: 0,
    isUserScrolling: false,
    userScrollTimeout: null
};

// DOM elements
const splash = document.getElementById('splash');
const experience = document.getElementById('experience');
const backgroundLayer = document.getElementById('backgroundLayer');
const foregroundLayer = document.getElementById('foregroundLayer');
const sections = document.querySelectorAll('.song-section');

// Initialize audio elements
for (let i = 0; i < 5; i++) {
    const audio = document.getElementById(`audio${i}`);
    state.songs.push({
        audio: audio,
        duration: 0,
        loaded: false
    });

    // Load audio duration
    audio.addEventListener('loadedmetadata', () => {
        state.songs[i].duration = audio.duration;
        state.songs[i].loaded = true;
        console.log(`Song ${i} loaded: ${audio.duration}s`);

        // Set section height based on song duration
        const section = sections[i];
        if (section) {
            const height = Math.max(
                window.innerHeight * 2, // minimum 2x viewport
                audio.duration * CONFIG.pixelsPerSecond // or based on duration
            );
            section.style.minHeight = `${height}px`;
            console.log(`Section ${i} height set to ${height}px for ${audio.duration}s song`);
        }
    });
}

// Start experience on splash click
splash.addEventListener('click', startExperience);

function startExperience() {
    if (state.started) return;

    state.started = true;
    splash.classList.add('hidden');

    // Start playing first song
    const firstAudio = state.songs[0].audio;
    firstAudio.play().catch(e => console.error('Playback error:', e));

    // Start auto-scroll after a brief delay
    setTimeout(() => {
        state.autoScrolling = true;
        requestAnimationFrame(autoScroll);
    }, 500);
}

// Auto-scroll function
function autoScroll() {
    if (!state.autoScrolling || state.isUserScrolling || state.paused) {
        if (state.autoScrolling && !state.paused) {
            requestAnimationFrame(autoScroll);
        }
        return;
    }

    experience.scrollTop += CONFIG.autoScrollSpeed;
    requestAnimationFrame(autoScroll);
}

// Scroll handling - scroll position drives audio time
let isManualScrolling = false;
let scrollTimeout = null;
let lastScrollPosition = 0;

experience.addEventListener('scroll', handleScroll);
experience.addEventListener('wheel', () => {
    // Detect manual scrolling
    isManualScrolling = true;
    state.isUserScrolling = true;

    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        isManualScrolling = false;
        state.isUserScrolling = false;
        // Resume auto-scroll
        if (state.autoScrolling && !state.paused) {
            requestAnimationFrame(autoScroll);
        }
    }, 150);
}, { passive: true });

function handleScroll() {
    if (!state.started) return;

    const scrollTop = experience.scrollTop;
    const scrollDelta = scrollTop - lastScrollPosition;
    lastScrollPosition = scrollTop;

    // Find which section we're in and position within it
    let cumulativeHeight = 0;
    let currentSection = 0;
    let sectionStartHeight = 0;

    for (let i = 0; i < sections.length; i++) {
        const sectionHeight = sections[i].offsetHeight;
        if (scrollTop < cumulativeHeight + sectionHeight) {
            currentSection = i;
            sectionStartHeight = cumulativeHeight;
            break;
        }
        cumulativeHeight += sectionHeight;
    }

    // Switch songs if section changed
    if (currentSection !== state.currentSongIndex) {
        switchToSong(currentSection);
    }

    // Update audio time ONLY during manual scrolling (DJ effect)
    const currentSong = state.songs[currentSection];
    if (currentSong && currentSong.loaded && currentSong.duration > 0) {
        if (isManualScrolling) {
            // DJ scrubbing: map scroll position to audio time
            const section = sections[currentSection];
            const sectionHeight = section.offsetHeight;
            const scrollInSection = scrollTop - sectionStartHeight;

            const progress = Math.max(0, Math.min(1, scrollInSection / sectionHeight));
            const targetTime = progress * currentSong.duration;

            currentSong.audio.currentTime = targetTime;
        }

        // Play if paused
        if (currentSong.audio.paused && !state.paused) {
            currentSong.audio.play().catch(err => console.error('Playback error:', err));
        }
    }
}

// Switch to a different song
function switchToSong(index) {
    if (index === state.currentSongIndex || index >= state.songs.length) return;

    // Pause current song
    if (state.currentSongIndex >= 0 && state.currentSongIndex < state.songs.length) {
        state.songs[state.currentSongIndex].audio.pause();
    }

    // Start new song
    state.currentSongIndex = index;
    const newSong = state.songs[index];
    if (newSong.loaded) {
        newSong.audio.currentTime = 0;
        newSong.audio.play().catch(e => console.error('Playback error:', e));
    }

    console.log(`Switched to song ${index}`);
}

// Toggle layers on click
experience.addEventListener('click', () => {
    if (!state.started) return;

    state.layersFlipped = !state.layersFlipped;

    if (state.layersFlipped) {
        backgroundLayer.classList.add('front');
        foregroundLayer.classList.add('back');
    } else {
        backgroundLayer.classList.remove('front');
        foregroundLayer.classList.remove('back');
    }
});

// Spacebar to pause/play
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && state.started) {
        e.preventDefault();

        state.paused = !state.paused;
        const currentSong = state.songs[state.currentSongIndex];

        if (state.paused) {
            // Pause audio and stop auto-scroll
            if (currentSong.loaded && currentSong.audio) {
                currentSong.audio.pause();
            }
            console.log('Paused');
        } else {
            // Resume audio and auto-scroll
            if (currentSong.loaded && currentSong.audio) {
                currentSong.audio.play().catch(e => console.error('Resume error:', e));
            }
            // Resume auto-scroll
            if (state.autoScrolling) {
                requestAnimationFrame(autoScroll);
            }
            console.log('Playing');
        }
    }
});

// Prevent body scrolling when not started
document.body.style.overflow = 'hidden';
