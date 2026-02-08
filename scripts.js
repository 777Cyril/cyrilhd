// Dark mode logic - switches at 7pm/7am
// Note: Initial theme is set by inline script in <head> for flash-free loading
function updateDarkMode() {
    const hour = new Date().getHours();
    const isDarkTime = hour >= 19 || hour < 7; // 7pm (19:00) to 7am

    // Apply to both html and body for maximum compatibility
    const elements = [document.documentElement, document.body];

    elements.forEach(function(el) {
        if (isDarkTime) {
            el.classList.add('dark-mode');
        } else {
            el.classList.remove('dark-mode');
        }
    });
}

// Re-check on page load (in case time changed during load)
updateDarkMode();

// Check every minute for seamless transitions
setInterval(updateDarkMode, 60000);

document.addEventListener('DOMContentLoaded', function() {
    const avi = document.querySelector('.avatar');
    const audio = document.getElementById('avi-audio');
    if (!avi || !audio) {
        return;
    }

    avi.style.cursor = 'pointer';
    let flashTimeoutId = null;

    function triggerTapFlash() {
        avi.classList.remove('tap-flash');
        // Force reflow so the animation restarts on repeated taps.
        void avi.offsetWidth;
        avi.classList.add('tap-flash');

        if (flashTimeoutId) {
            clearTimeout(flashTimeoutId);
        }
        flashTimeoutId = setTimeout(function() {
            avi.classList.remove('tap-flash');
        }, 650);
    }

    const fallbackSchedule = {
        timeZone: 'America/New_York',
        default: 'assets/songs/Clairo Juna Live Ending.mp3',
        ranges: [],
        slots: {},
    };
    let schedule = fallbackSchedule;

    function getTimePartsInTimeZone() {
        const parts = new Intl.DateTimeFormat('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: schedule.timeZone || fallbackSchedule.timeZone,
        }).formatToParts(new Date());
        const hourPart = parts.find(function(p) { return p.type === 'hour'; });
        const minutePart = parts.find(function(p) { return p.type === 'minute'; });
        return {
            hour: hourPart ? parseInt(hourPart.value, 10) : new Date().getHours(),
            minute: minutePart ? parseInt(minutePart.value, 10) : new Date().getMinutes(),
        };
    }

    function parseTimeToMinutes(value) {
        if (!value || typeof value !== 'string') {
            return null;
        }
        const parts = value.split(':');
        if (parts.length !== 2) {
            return null;
        }
        const hour = parseInt(parts[0], 10);
        const minute = parseInt(parts[1], 10);
        if (Number.isNaN(hour) || Number.isNaN(minute)) {
            return null;
        }
        if (hour < 0 || hour > 24 || minute < 0 || minute > 59) {
            return null;
        }
        if (hour === 24 && minute !== 0) {
            return null;
        }
        return hour * 60 + minute;
    }

    function getHourlySource() {
        const timeParts = getTimePartsInTimeZone();
        const minuteOfDay = timeParts.hour * 60 + timeParts.minute;
        const slotKey = String(timeParts.hour).padStart(2, '0') + ':' + String(timeParts.minute).padStart(2, '0');
        if (schedule.slots && schedule.slots[slotKey]) {
            return schedule.slots[slotKey];
        }
        if (Array.isArray(schedule.ranges)) {
            for (let i = 0; i < schedule.ranges.length; i += 1) {
                const range = schedule.ranges[i];
                const start = parseTimeToMinutes(range.start);
                const end = parseTimeToMinutes(range.end);
                if (start === null || end === null) {
                    continue;
                }
                if (start === end) {
                    continue;
                }
                if (start < end && minuteOfDay >= start && minuteOfDay < end) {
                    return range.src;
                }
                if (start > end && (minuteOfDay >= start || minuteOfDay < end)) {
                    return range.src;
                }
            }
        }
        return schedule.default || fallbackSchedule.default;
    }

    function updateAudioSourceIfNeeded() {
        const nextSrc = getHourlySource();
        if (audio.dataset.currentSrc !== nextSrc) {
            audio.pause();
            audio.src = nextSrc;
            audio.load();
            audio.dataset.currentSrc = nextSrc;
        }
    }

    fetch('assets/songs/schedule.json', { cache: 'no-store' })
        .then(function(res) {
            if (!res.ok) {
                throw new Error('schedule fetch failed');
            }
            return res.json();
        })
        .then(function(data) {
            if (data && typeof data === 'object') {
                schedule = {
                    timeZone: data.timeZone || fallbackSchedule.timeZone,
                    default: data.default || fallbackSchedule.default,
                    ranges: Array.isArray(data.ranges) ? data.ranges : [],
                    slots: data.slots && typeof data.slots === 'object' ? data.slots : {},
                };
            }
        })
        .catch(function() {
            schedule = fallbackSchedule;
        })
        .finally(function() {
            updateAudioSourceIfNeeded();
            setInterval(updateAudioSourceIfNeeded, 60000);
        });

    avi.addEventListener('click', function() {
        triggerTapFlash();
        if (audio.paused) {
            if (typeof mcStopAndClose === 'function') {
                mcStopAndClose();
            }
            audio.play();
        } else {
            audio.pause();
        }
    });

    // ── Inline Music Controls ──
    var mcStopAndClose;
    var mcIsPlaying = false;
    var mcCurrentTrack = 0;
    var mcIsOpen = false;
    var mcTypewriterTimeout = null;
    var mcTracks = [
        { title: 'get it together', src: 'assets/songs/Get it together v2 pitched up.mp3' },
        { title: 'all the way', src: 'assets/songs/All the way (so crazy) v2 @lifecrzy.mp3' },
        { title: '50 Stater', src: 'assets/songs/50 Stater.mp3' },
        { title: 'caught up', src: 'assets/songs/SOF v2.mp3' },
        { title: 'doin me dirty', src: 'assets/songs/doin me dirty @lifecrzy.mp3' },
        { title: '4u', src: 'assets/songs/atlanta v2.mp3' },
        { title: 'roxanne', src: 'assets/songs/roxannne v2 @lifecrzy.mp3' },
        { title: 'mulino prime', src: 'assets/songs/MULINO PRIME @lifecrzy.mp3' },
        { title: 'touchdown', src: 'assets/songs/Khalil Lifestyle x Boofinesse - Touchdown Prod. LIFECRZY.mp3' },
        { title: 'diamond', src: 'assets/songs/DIAMOND v2.mp3' },
        { title: 'share', src: 'assets/songs/share.mp3' },
        { title: 'in the garden', src: 'assets/songs/sex in the garden.mp3' },
        { title: 'choosey lover', src: 'assets/songs/choosey lover (atlanta).mp3' },
        { title: 'know you', src: 'assets/songs/cayman @lifecrzy.mp3' },
        { title: 'familiar', src: 'assets/songs/familiar @lifecrzy.mp3' },
        { title: 'lovely day in may', src: 'assets/songs/Lovely Day in May.mp3' },
        { title: 'broken hearts', src: 'assets/songs/broken hearts 87 bpm.mp3' },
        { title: 'teezn u', src: 'assets/songs/Teezn u @jlitt @lifecrzy.mp3' },
        { title: 'motorola', src: 'assets/songs/Motorola.wav' },
        { title: 'love me no more', src: 'assets/songs/love me nomore (mixed and mastered).m4a' },
        { title: 'hella options', src: 'assets/songs/hella options @lifecrzy @fggy.mp3' },
        { title: 'good company', src: 'assets/songs/goodcompany.mp3' },
        { title: 'nicaraguay', src: 'assets/songs/nicaraguay v2 @lifecrzy.mp3' },
        { title: 'you send me', src: 'assets/songs/you send me v3.mp3' },
        { title: 'in order', src: 'assets/songs/in order.mp3' },
        { title: 'miu miu', src: 'assets/songs/muimui.mp3' },
        { title: 'money dance', src: 'assets/songs/01 Khalil.Lifestyle - Money Dance.mp3' }
    ];

    var songsLink = document.getElementById('songsLink');
    var mcControls = document.getElementById('musicControls');
    var playPauseBtn = document.getElementById('playPauseBtn');
    var prevBtn = document.getElementById('prevBtn');
    var nextBtn = document.getElementById('nextBtn');
    var nowPlaying = document.getElementById('nowPlaying');

    if (songsLink && mcControls && playPauseBtn && prevBtn && nextBtn && nowPlaying) {
        var playIcon = playPauseBtn.querySelector('.play-icon');
        var pauseIcon = playPauseBtn.querySelector('.pause-icon');
        var mcAudio = new Audio();
        mcAudio.preload = 'none';

        function mcLoadTrack() {
            mcAudio.src = mcTracks[mcCurrentTrack].src;
            mcAudio.load();
        }

        mcAudio.addEventListener('ended', function() {
            mcCurrentTrack = (mcCurrentTrack + 1) % mcTracks.length;
            mcLoadTrack();
            mcAudio.play();
            mcUpdateNowPlaying(true);
        });

        function mcTypewriter(text, startDelay) {
            if (mcTypewriterTimeout) {
                clearTimeout(mcTypewriterTimeout);
            }
            nowPlaying.textContent = '';
            nowPlaying.classList.add('typing');
            var charIndex = 0;

            function typeNext() {
                if (charIndex < text.length && mcIsOpen) {
                    nowPlaying.textContent = text.substring(0, charIndex + 1);
                    charIndex++;
                    mcTypewriterTimeout = setTimeout(typeNext, 35);
                } else {
                    nowPlaying.classList.remove('typing');
                }
            }

            mcTypewriterTimeout = setTimeout(typeNext, startDelay || 400);
        }

        function mcUpdateNowPlaying(useTypewriter) {
            var text;
            if (mcIsPlaying) {
                text = mcTracks[mcCurrentTrack].title;
            } else {
                text = '';
            }

            if (useTypewriter && mcIsOpen) {
                mcTypewriter(text);
            } else if (!mcIsOpen) {
                nowPlaying.textContent = '';
            } else {
                nowPlaying.textContent = text;
                nowPlaying.classList.remove('typing');
            }
        }

        function mcClose() {
            mcControls.classList.add('closing');
            mcControls.classList.remove('active');
            nowPlaying.textContent = '';
            nowPlaying.classList.remove('typing');
            if (mcTypewriterTimeout) {
                clearTimeout(mcTypewriterTimeout);
            }
            setTimeout(function() {
                mcControls.classList.remove('closing');
            }, 500);
            mcIsOpen = false;
        }

        function mcResetPlayback() {
            mcAudio.pause();
            mcAudio.currentTime = 0;
            mcIsPlaying = false;
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
        }

        // Exposed so avi click can stop music controls and close them
        mcStopAndClose = function() {
            mcResetPlayback();
            if (mcIsOpen) {
                mcClose();
            }
        };

        function stopAviAudio() {
            audio.pause();
            audio.currentTime = 0;
        }

        songsLink.addEventListener('click', function(e) {
            e.preventDefault();
            if (mcIsOpen) {
                mcClose();
            } else {
                mcControls.classList.remove('closing');
                mcControls.classList.add('active');
                mcIsOpen = true;
                mcUpdateNowPlaying(true);
            }
        });

        playPauseBtn.addEventListener('click', function() {
            mcIsPlaying = !mcIsPlaying;
            playIcon.style.display = mcIsPlaying ? 'none' : 'block';
            pauseIcon.style.display = mcIsPlaying ? 'block' : 'none';
            if (mcIsPlaying) {
                stopAviAudio();
                if (!mcAudio.src || mcAudio.src === location.href) {
                    mcLoadTrack();
                }
                mcAudio.play();
            } else {
                mcAudio.pause();
            }
            mcUpdateNowPlaying(true);
        });

        prevBtn.addEventListener('click', function() {
            mcCurrentTrack = (mcCurrentTrack - 1 + mcTracks.length) % mcTracks.length;
            mcLoadTrack();
            if (mcIsPlaying) {
                mcAudio.play();
            }
            mcUpdateNowPlaying(true);
        });

        nextBtn.addEventListener('click', function() {
            mcCurrentTrack = (mcCurrentTrack + 1) % mcTracks.length;
            mcLoadTrack();
            if (mcIsPlaying) {
                mcAudio.play();
            }
            mcUpdateNowPlaying(true);
        });

        document.addEventListener('click', function(e) {
            if (!e.target.closest('.songs-item') && mcIsOpen) {
                mcClose();
            }
        });
    }
});
