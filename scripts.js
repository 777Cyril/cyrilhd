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
    const aviShell = document.querySelector('.avatar-shell');
    const audio = document.getElementById('avi-audio');
    if (!avi || !audio || !aviShell) {
        return;
    }

    avi.style.cursor = 'pointer';
    let flashTimeoutId = null;

    // ── Time-of-Day Greeting ──
    var greetingDismissed = false;
    (function() {
        var GREETING_KEY = 'cyrilhd_greeting_ts';
        var GREETING_INTERVAL = 30 * 60 * 1000;

        var lastShown = localStorage.getItem(GREETING_KEY);
        if (lastShown && (Date.now() - parseInt(lastShown, 10)) < GREETING_INTERVAL) {
            var gt = document.getElementById('greetingText');
            if (gt) gt.classList.add('hidden');
            greetingDismissed = true;
            return;
        }

        var greetingText = document.getElementById('greetingText');
        if (!greetingText) return;

        var hour = new Date().getHours();
        var message;
        if (hour >= 6 && hour < 12) {
            message = 'good morning';
        } else if (hour >= 12 && hour < 17) {
            message = 'good afternoon';
        } else {
            message = 'good evening';
        }

        var charIndex = 0;
        greetingText.classList.add('typing');

        function typeGreeting() {
            if (charIndex < message.length && !greetingDismissed) {
                greetingText.textContent = message.substring(0, charIndex + 1);
                charIndex++;
                setTimeout(typeGreeting, 35);
            } else {
                greetingText.classList.remove('typing');
                if (!greetingDismissed) {
                    setTimeout(function() {
                        greetingText.classList.add('fade-out');
                        setTimeout(function() {
                            greetingText.classList.add('hidden');
                            greetingDismissed = true;
                        }, 800);
                    }, 3000);
                }
            }
        }

        setTimeout(typeGreeting, 500);
        localStorage.setItem(GREETING_KEY, String(Date.now()));
    })();

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

    // ── Wink Interaction (manual trigger during prototyping) ──
    function triggerWink() {
        aviShell.classList.remove('wink');
        void aviShell.offsetWidth;
        aviShell.classList.add('wink');
        setTimeout(function() {
            aviShell.classList.remove('wink');
        }, 280);
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
        { title: '4u', src: 'assets/songs/atlanta v2.mp3' },
        { title: '50 Stater', src: 'assets/songs/50 Stater.mp3' },
        { title: 'caught up', src: 'assets/songs/SOF v2.mp3' },
        { title: 'doin me dirty', src: 'assets/songs/doin me dirty @lifecrzy.mp3' },
        { title: 'all the way', src: 'assets/songs/All the way (so crazy) v2 @lifecrzy.mp3' },
        { title: 'choosey lover', src: 'assets/songs/choosey lover (atlanta).mp3' },
        { title: 'mulino prime', src: 'assets/songs/MULINO PRIME @lifecrzy.mp3' },
        { title: 'touchdown', src: 'assets/songs/Khalil Lifestyle x Boofinesse - Touchdown Prod. LIFECRZY.mp3' },
        { title: 'diamond', src: 'assets/songs/DIAMOND v2.mp3' },
        { title: 'share', src: 'assets/songs/share.mp3' },
        { title: 'in the garden', src: 'assets/songs/sex in the garden.mp3' },
        { title: 'roxanne', src: 'assets/songs/roxannne v2 @lifecrzy.mp3' },
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

    // Fisher-Yates shuffle
    function mcShuffle() {
        for (var i = mcTracks.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = mcTracks[i];
            mcTracks[i] = mcTracks[j];
            mcTracks[j] = temp;
        }
    }
    mcShuffle();

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
            mcCurrentTrack = mcCurrentTrack + 1;
            if (mcCurrentTrack >= mcTracks.length) {
                var lastTrack = mcTracks[mcTracks.length - 1];
                mcShuffle();
                // Avoid repeating the same song across shuffle boundary
                if (mcTracks[0] === lastTrack && mcTracks.length > 1) {
                    var swap = 1 + Math.floor(Math.random() * (mcTracks.length - 1));
                    mcTracks[0] = mcTracks[swap];
                    mcTracks[swap] = lastTrack;
                }
                mcCurrentTrack = 0;
            }
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

            // Sync banner carousel
            carouselUpdate();
        }

        // ── Banner Carousel (Claude Code status line style) ──
        var carouselViewport = document.getElementById('carouselViewport');
        var carouselTrack = document.getElementById('carouselTrack');
        var CAROUSEL_SPEED = 50; // pixels per second

        function carouselUpdate() {
            if (mcIsPlaying) {
                var title = 'you are now listening to ' + mcTracks[mcCurrentTrack].title;
                carouselShow(title);
            } else {
                carouselHide();
            }
        }

        function carouselShow(text) {
            if (!carouselViewport || !carouselTrack) return;

            // Dismiss greeting if still visible
            if (!greetingDismissed) {
                var gt = document.getElementById('greetingText');
                if (gt) {
                    gt.classList.add('hidden');
                    gt.classList.remove('typing', 'fade-out');
                }
                greetingDismissed = true;
            }

            carouselTrack.classList.remove('scrolling');
            void carouselTrack.offsetWidth;

            carouselTrack.textContent = text;
            carouselViewport.classList.add('active');

            // Measure after making visible
            var textWidth = carouselTrack.offsetWidth;
            var vpWidth = carouselViewport.offsetWidth;
            var totalDistance = vpWidth + textWidth;
            var duration = totalDistance / CAROUSEL_SPEED;

            carouselTrack.style.setProperty('--carousel-start', vpWidth + 'px');
            carouselTrack.style.setProperty('--carousel-end', '-' + textWidth + 'px');
            carouselTrack.style.setProperty('--carousel-duration', duration + 's');

            carouselTrack.classList.add('scrolling');
        }

        function carouselHide() {
            if (!carouselViewport || !carouselTrack) return;
            carouselTrack.classList.remove('scrolling');
            carouselTrack.textContent = '';
            carouselViewport.classList.remove('active');
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
            carouselUpdate();
        }

        function mcResetPlayback() {
            mcAudio.pause();
            mcAudio.currentTime = 0;
            mcIsPlaying = false;
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
            carouselHide();
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

    // ── Link Preview Whispers ──
    (function() {
        var preview = document.getElementById('linkPreview');
        var previewTitle = document.getElementById('linkPreviewTitle');
        var previewDesc = document.getElementById('linkPreviewDesc');
        var previewCat = document.getElementById('linkPreviewCat');
        if (!preview) return;

        var hoverTimeout = null;

        var previewLinks = document.querySelectorAll('a[data-preview-title]');

        previewLinks.forEach(function(link) {
            link.addEventListener('mouseenter', function(e) {
                hoverTimeout = setTimeout(function() {
                    showPreview(link, e);
                }, 500);
            });

            link.addEventListener('mouseleave', function() {
                clearTimeout(hoverTimeout);
                hidePreview();
            });

            link.addEventListener('mousemove', function(e) {
                if (preview.classList.contains('visible')) {
                    positionPreview(e);
                }
            });
        });

        function showPreview(link, e) {
            previewTitle.textContent = link.getAttribute('data-preview-title') || '';
            previewDesc.textContent = link.getAttribute('data-preview-desc') || '';
            previewCat.textContent = link.getAttribute('data-preview-cat') || '';
            positionPreview(e);
            preview.classList.add('visible');
        }

        function hidePreview() {
            preview.classList.remove('visible');
        }

        function positionPreview(e) {
            var x = e.clientX + 16;
            var y = e.clientY + 16;
            var vw = window.innerWidth;
            var vh = window.innerHeight;

            if (x + 230 > vw) {
                x = e.clientX - 230;
            }
            if (y + 80 > vh) {
                y = e.clientY - 80;
            }

            preview.style.left = x + 'px';
            preview.style.top = y + 'px';
        }
    })();

    // ── Hidden Keystroke Patterns (Easter Eggs) ──
    (function() {
        var keyBuffer = '';
        var cooldownActive = false;
        var COOLDOWN_MS = 3000;
        var BUFFER_MAX = 10;

        var patterns = {
            '777': triggerWink,
            'brr': triggerBrr
        };

        document.addEventListener('keydown', function(e) {
            var tag = e.target.tagName.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) {
                return;
            }

            if (cooldownActive) return;

            keyBuffer += e.key.toLowerCase();
            if (keyBuffer.length > BUFFER_MAX) {
                keyBuffer = keyBuffer.slice(-BUFFER_MAX);
            }

            for (var pattern in patterns) {
                if (keyBuffer.endsWith(pattern)) {
                    cooldownActive = true;
                    keyBuffer = '';
                    patterns[pattern]();
                    setTimeout(function() {
                        cooldownActive = false;
                    }, COOLDOWN_MS);
                    break;
                }
            }
        });

        function triggerBrr() {
            var avi = document.querySelector('.avatar');
            var brrTarget = document.getElementById('brrTarget');

            // Typewriter re-animation on the existing "compute go brr" text
            if (brrTarget) {
                var originalText = 'compute go brr';
                brrTarget.textContent = '';
                var charIdx = 0;

                function typeBrr() {
                    if (charIdx < originalText.length) {
                        brrTarget.textContent = originalText.substring(0, charIdx + 1);
                        charIdx++;
                        setTimeout(typeBrr, 35);
                    }
                }

                typeBrr();
            }

            // Avatar shiver
            if (avi) {
                avi.classList.remove('shiver');
                void avi.offsetWidth;
                avi.classList.add('shiver');
                setTimeout(function() { avi.classList.remove('shiver'); }, 1000);
            }
        }
    })();
});
