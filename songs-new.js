// Configuration
const CONFIG = {
    autoScrollSpeed: 0.5,
    pixelsPerSecond: 150
};

// State
let state = {
    started: false,
    autoScrolling: false,
    paused: false,
    currentSongIndex: 0,
    isScrolling: false, // q flag from lostscribe
    scrollProgress: 0, // A from lostscribe
    layersFlipped: false,
    songs: [],
    lastScrollTop: 0
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

    audio.addEventListener('loadedmetadata', () => {
        state.songs[i].duration = audio.duration;
        state.songs[i].loaded = true;

        // Set section height based on duration
        const section = sections[i];
        if (section) {
            const height = Math.max(
                window.innerHeight * 2,
                audio.duration * CONFIG.pixelsPerSecond
            );
            section.style.minHeight = `${height}px`;
        }
    });

    // When audio plays naturally (not scrolling), update progress
    audio.addEventListener('timeupdate', () => {
        if (!state.isScrolling && state.currentSongIndex === i && state.songs[i].loaded) {
            state.scrollProgress = audio.currentTime / state.songs[i].duration;
        }
    });
}

// Start experience
splash.addEventListener('click', () => {
    if (state.started) return;
    state.started = true;
    splash.classList.add('hidden');

    // Play first song
    const firstSong = state.songs[0];
    firstSong.audio.play().catch(e => console.error('Play error:', e));

    // Start auto-scroll
    setTimeout(() => {
        state.autoScrolling = true;
        requestAnimationFrame(autoScroll);
    }, 500);
});

// Auto-scroll
function autoScroll() {
    if (!state.autoScrolling || state.paused) {
        if (state.autoScrolling && !state.paused) {
            requestAnimationFrame(autoScroll);
        }
        return;
    }

    experience.scrollTop += CONFIG.autoScrollSpeed;
    requestAnimationFrame(autoScroll);
}

// Detect manual scrolling
let scrollTimeout;
experience.addEventListener('wheel', () => {
    state.isScrolling = true;
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        state.isScrolling = false;
        // Resume auto-scroll
        if (state.autoScrolling && !state.paused) {
            requestAnimationFrame(autoScroll);
        }
    }, 150);
}, { passive: true });

// Main scroll handler - matches lostscribe pattern
experience.addEventListener('scroll', () => {
    if (!state.started) return;

    const scrollTop = experience.scrollTop;

    // Find current section and position within it
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
        // Pause old song
        if (state.songs[state.currentSongIndex].audio) {
            state.songs[state.currentSongIndex].audio.pause();
        }

        state.currentSongIndex = currentSection;

        // Start new song
        const newSong = state.songs[currentSection];
        if (newSong.loaded) {
            newSong.audio.currentTime = 0;
            newSong.audio.play().catch(e => console.error('Play error:', e));
        }
    }

    // Calculate scroll progress (0-1) within current section
    const currentSong = state.songs[currentSection];
    if (currentSong && currentSong.loaded) {
        const section = sections[currentSection];
        const sectionHeight = section.offsetHeight;
        const scrollInSection = scrollTop - sectionStartHeight;
        const progress = Math.max(0, Math.min(1, scrollInSection / sectionHeight));

        state.scrollProgress = progress;

        // ONLY update audio.currentTime when user is scrolling (q flag)
        if (state.isScrolling) {
            const targetTime = progress * currentSong.duration;
            if (Number.isFinite(targetTime) && targetTime >= 0 && targetTime <= currentSong.duration) {
                currentSong.audio.currentTime = targetTime;
            }
        }

        // Ensure audio is playing
        if (currentSong.audio.paused && !state.paused) {
            currentSong.audio.play().catch(e => console.error('Play error:', e));
        }
    }

    state.lastScrollTop = scrollTop;
});

// Toggle layers
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

// Spacebar pause/play
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && state.started) {
        e.preventDefault();
        state.paused = !state.paused;

        const currentSong = state.songs[state.currentSongIndex];
        if (state.paused) {
            currentSong.audio.pause();
        } else {
            currentSong.audio.play().catch(e => console.error('Play error:', e));
            if (state.autoScrolling) {
                requestAnimationFrame(autoScroll);
            }
        }
    }
});
