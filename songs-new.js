// Configuration
const CONFIG = {
    autoScrollSpeed: 150, // pixels per second (match pixelsPerSecond for sync)
    pixelsPerSecond: 150,
    fadeOutSeconds: 1.2
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
    lastScrollTop: 0,
    lastAutoScrollTime: null
};

// DOM elements
const splash = document.getElementById('splash');
const experience = document.getElementById('experience');
const backgroundLayer = document.getElementById('backgroundLayer');
const foregroundLayer = document.getElementById('foregroundLayer');
const sections = document.querySelectorAll('.song-section');
const backdropPane = backgroundLayer.querySelector('.backdrop-pane');
const audioElements = Array.from(document.querySelectorAll('audio[id^="audio"]'));
const songCount = Math.min(sections.length, audioElements.length);

if (sections.length !== audioElements.length) {
    console.warn(
        `Songs page: ${sections.length} sections but ${audioElements.length} audio elements. ` +
        'Only the matching pairs will be used.'
    );
}

// Initialize audio elements
for (let i = 0; i < songCount; i++) {
    const audio = audioElements[i];
    state.songs.push({
        audio: audio,
        duration: 0,
        loaded: false,
        ended: false
    });

    if (!audio) continue;

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

        populate777Tags();
    });

    // When audio plays naturally (not scrolling), update progress
    audio.addEventListener('timeupdate', () => {
        if (!state.isScrolling && state.currentSongIndex === i && state.songs[i].loaded) {
            state.scrollProgress = audio.currentTime / state.songs[i].duration;
        }
        applyFadeOut(i);
    });

    audio.addEventListener('error', () => {
        console.error('Audio failed to load:', audio.src);
    });

    audio.addEventListener('ended', () => {
        state.songs[i].ended = true;
    });

    audio.addEventListener('play', () => {
        state.songs[i].ended = false;
        if (!audio.muted) {
            audio.volume = 1;
        }
    });
}

// Start experience
splash.addEventListener('click', () => {
    if (state.started) return;
    state.started = true;
    splash.classList.add('hidden');

    // Unlock other audio elements for iOS/Safari autoplay policies
    unlockOtherSongs();

    // Play first song
    const firstSong = state.songs[0];
    if (firstSong && firstSong.audio) {
        firstSong.audio.currentTime = 0;
        firstSong.audio.play().catch(e => console.error('Play error:', e));
    }

    // Start auto-scroll
    setTimeout(() => {
        state.autoScrolling = true;
        requestAnimationFrame(autoScroll);
    }, 500);
});

// Auto-scroll
function autoScroll() {
    if (!state.autoScrolling || state.paused || state.isScrolling) {
        if (state.autoScrolling && !state.paused) {
            state.lastAutoScrollTime = null;
            requestAnimationFrame(autoScroll);
        }
        return;
    }

    const now = performance.now();
    if (state.lastAutoScrollTime === null) {
        state.lastAutoScrollTime = now;
    }
    const deltaSeconds = (now - state.lastAutoScrollTime) / 1000;
    state.lastAutoScrollTime = now;

    experience.scrollTop += CONFIG.autoScrollSpeed * deltaSeconds;
    requestAnimationFrame(autoScroll);
}

// Detect manual scrolling
let scrollTimeout;
experience.addEventListener('wheel', () => {
    state.isScrolling = true;
    state.lastAutoScrollTime = null;
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        state.isScrolling = false;
        // Resume auto-scroll
        if (state.autoScrolling && !state.paused) {
            requestAnimationFrame(autoScroll);
        }
    }, 150);
}, { passive: true });

// Touch devices: treat touch scroll as manual scrolling
experience.addEventListener('touchstart', () => {
    state.isScrolling = true;
    state.lastAutoScrollTime = null;
}, { passive: true });

experience.addEventListener('touchend', () => {
    state.isScrolling = false;
    if (state.autoScrolling && !state.paused) {
        requestAnimationFrame(autoScroll);
    }
}, { passive: true });

// Main scroll handler - matches lostscribe pattern
experience.addEventListener('scroll', () => {
    if (!state.started) return;

    const scrollTop = experience.scrollTop;

    // Find current section and position within it
    let cumulativeHeight = 0;
    let currentSection = 0;
    let sectionStartHeight = 0;
    let foundSection = false;

    for (let i = 0; i < sections.length; i++) {
        const sectionHeight = sections[i].offsetHeight;
        if (scrollTop < cumulativeHeight + sectionHeight) {
            currentSection = i;
            sectionStartHeight = cumulativeHeight;
            foundSection = true;
            break;
        }
        cumulativeHeight += sectionHeight;
    }

    if (!foundSection) {
        currentSection = Math.max(0, sections.length - 1);
        const lastSection = sections[currentSection];
        sectionStartHeight = cumulativeHeight - (lastSection ? lastSection.offsetHeight : 0);
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
            newSong.audio.volume = 1;
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
                if (targetTime < currentSong.duration - CONFIG.fadeOutSeconds) {
                    currentSong.audio.volume = 1;
                }
            }
        }

        // Ensure audio is playing
        const nearEnd = currentSong.audio.currentTime >= Math.max(0, currentSong.duration - 0.05);
        if (currentSong.audio.paused && !state.paused && (state.isScrolling || !nearEnd)) {
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
            currentSong.audio.volume = 1;
            currentSong.audio.play().catch(e => console.error('Play error:', e));
            if (state.autoScrolling) {
                requestAnimationFrame(autoScroll);
            }
        }
    }
});

function unlockAudioElement(audio) {
    if (!audio) return;
    const wasMuted = audio.muted;
    audio.muted = true;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.then === 'function') {
        playPromise
            .then(() => {
                audio.pause();
                audio.currentTime = 0;
                audio.muted = wasMuted;
            })
            .catch(() => {
                audio.muted = wasMuted;
            });
    } else {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = wasMuted;
    }
}

function unlockOtherSongs() {
    for (let i = 1; i < state.songs.length; i++) {
        unlockAudioElement(state.songs[i].audio);
    }
}

function applyFadeOut(index) {
    const song = state.songs[index];
    if (!song || !song.loaded || !song.audio) return;
    if (song.audio.paused || state.paused) return;

    const remaining = song.duration - song.audio.currentTime;
    if (!Number.isFinite(remaining)) return;

    if (remaining <= CONFIG.fadeOutSeconds) {
        const fadeProgress = Math.max(0, remaining / CONFIG.fadeOutSeconds);
        song.audio.volume = Math.min(1, fadeProgress);
    } else if (!song.audio.muted && song.audio.volume !== 1) {
        song.audio.volume = 1;
    }
}

// Populate 777 producer tags in the backdrop pane
function populate777Tags() {
    const totalHeight = foregroundLayer.scrollHeight;
    if (totalHeight <= 0) return;

    backgroundLayer.style.height = totalHeight + 'px';
    backdropPane.style.height = totalHeight + 'px';
    backdropPane.innerHTML = '';

    const tagCount = songCount + 1;
    const spacing = totalHeight / (tagCount + 1);

    for (let i = 0; i < tagCount; i++) {
        const tag = document.createElement('div');
        tag.className = 'seven-tag';
        tag.innerHTML = '<span>7</span><span>7</span><span>7</span>';
        tag.style.top = Math.round(spacing * (i + 1)) + 'px';
        backdropPane.appendChild(tag);
    }
}

window.addEventListener('resize', populate777Tags);
