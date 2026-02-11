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
    const bannerSlot = document.getElementById('bannerSlot');
    const hintsOverlay = document.getElementById('hintsOverlay');
    if (!avi || !audio) {
        return;
    }

    avi.style.cursor = 'pointer';
    let flashTimeoutId = null;
    let bannerPulseTimeoutId = null;

    var AVI_DEFAULT = 'assets/Cyril Cryptopunk Avi Click Me.png';
    var AVI_WIRED   = 'assets/cyril-cryptopunk-avi-wired headphones.png';

    var _aviWiredState = false;
    function setAviWired(wired) {
        if (wired === _aviWiredState) return;
        _aviWiredState = wired;
        var next = wired ? AVI_WIRED : AVI_DEFAULT;
        avi.style.transition = 'opacity 0.25s ease';
        avi.style.opacity = '0';
        setTimeout(function() {
            avi.src = next;
            avi.style.opacity = '1';
        }, 150);
    }

    function pulseBanner() {
        if (!bannerSlot) return;
        bannerSlot.classList.remove('pulsing');
        void bannerSlot.offsetWidth;
        bannerSlot.classList.add('pulsing');
        if (bannerPulseTimeoutId) {
            clearTimeout(bannerPulseTimeoutId);
        }
        bannerPulseTimeoutId = setTimeout(function() {
            bannerSlot.classList.remove('pulsing');
        }, 420);
    }

    var magnetLinks = Array.prototype.slice.call(document.querySelectorAll('a'));
    magnetLinks.forEach(function(link) {
        link.classList.add('magnet-link');
    });

    var magnetCursorX = 0;
    var magnetCursorY = 0;
    var magnetNeedsFrame = false;
    var MAGNET_RADIUS = 120;
    var MAGNET_MAX_SHIFT = 2;

    function resetMagnetLinks() {
        magnetLinks.forEach(function(link) {
            link.style.transform = '';
        });
    }

    function updateMagnetLinks() {
        magnetNeedsFrame = false;
        magnetLinks.forEach(function(link) {
            var rect = link.getBoundingClientRect();
            var centerX = rect.left + rect.width / 2;
            var centerY = rect.top + rect.height / 2;
            var vx = magnetCursorX - centerX;
            var vy = magnetCursorY - centerY;
            var dist = Math.sqrt(vx * vx + vy * vy);

            if (dist <= 0.01 || dist > MAGNET_RADIUS) {
                link.style.transform = '';
                return;
            }

            var strength = Math.pow(1 - dist / MAGNET_RADIUS, 1.35);
            var shift = MAGNET_MAX_SHIFT * strength;
            var tx = (vx / dist) * shift;
            var ty = (vy / dist) * shift;
            link.style.transform = 'translate(' + tx.toFixed(2) + 'px, ' + ty.toFixed(2) + 'px)';
        });
    }

    document.addEventListener('mousemove', function(e) {
        magnetCursorX = e.clientX;
        magnetCursorY = e.clientY;
        if (!magnetNeedsFrame) {
            magnetNeedsFrame = true;
            requestAnimationFrame(updateMagnetLinks);
        }
    }, { passive: true });

    document.addEventListener('mouseout', function(e) {
        if (!e.relatedTarget) {
            resetMagnetLinks();
        }
    });
    window.addEventListener('blur', resetMagnetLinks);

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
        if (hour >= 4 && hour < 12) {
            message = 'good morning';
        } else if (hour >= 12 && hour < 19) {
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
                pulseBanner();
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

    // Avatar audio: favorite songs playlist (shuffled on page load)
    const fallbackFavorites = [
        'assets/audio/favorites/Clairo Juna Live Ending.mp3'
    ];
    let favoriteTracks = [];
    let currentAviTrack = null;
    let aviIsPlaying = false;
    let aviNextBtnTimeout = null;
    let aviNextBtnHovering = false;
    const aviNextBtn = document.getElementById('aviNextBtn');
    const aviPrevBtn = document.getElementById('aviPrevBtn');
    // Fisher-Yates shuffle
    function shuffleArray(array) {
        const shuffled = array.slice();
        for (var i = shuffled.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = shuffled[i];
            shuffled[i] = shuffled[j];
            shuffled[j] = temp;
        }
        return shuffled;
    }

    // Single shuffled playlist with a cursor — never reshuffles mid-session.
    // Going next advances the cursor, going prev decrements it.
    // Only initialised once on first load; refreshing the page gives a new shuffle.
    var aviPlaylist = [];   // shuffled once on load
    var aviCursor = -1;     // index of currently playing track in aviPlaylist

    function initAviPlaylist() {
        aviPlaylist = shuffleArray(favoriteTracks);
        aviCursor = -1; // will be incremented to 0 on first selectRandomAvatarTrack call
    }

    function selectRandomAvatarTrack() {
        if (favoriteTracks.length === 0) return;

        // If playlist hasn't been built yet, build it now
        if (aviPlaylist.length === 0) {
            initAviPlaylist();
        }

        // Advance cursor; wrap around to start of a fresh shuffle when exhausted
        aviCursor++;
        if (aviCursor >= aviPlaylist.length) {
            var lastTrack = aviPlaylist[aviPlaylist.length - 1];
            aviPlaylist = shuffleArray(favoriteTracks);
            // Avoid repeating the last track at the seam between cycles
            if (aviPlaylist.length > 1 && aviPlaylist[0] === lastTrack) {
                aviPlaylist.push(aviPlaylist.shift());
            }
            aviCursor = 0;
        }

        currentAviTrack = aviPlaylist[aviCursor];
        audio.src = currentAviTrack;
        audio.load();
        audio.dataset.currentSrc = currentAviTrack;
    }

    function playPrevAviTrack() {
        if (aviPlaylist.length === 0) return;

        if (aviCursor <= 0) {
            // Already at the start — just rewind
            audio.currentTime = 0;
            return;
        }

        // Nod animation
        avi.classList.remove('nod');
        void avi.offsetWidth;
        avi.classList.add('nod');
        setTimeout(function() { avi.classList.remove('nod'); }, 400);

        // Step back in the same playlist — no reshuffle
        aviCursor--;
        currentAviTrack = aviPlaylist[aviCursor];
        audio.src = currentAviTrack;
        audio.dataset.currentSrc = currentAviTrack;
        audio.play().then(function() {
            aviUpdateCarousel();
            showAviNextButton();
        }).catch(function(err) {
            console.error('Prev avi track error:', err);
        });
    }

    function showAviNextButton() {
        if (!aviIsPlaying) return;

        if (aviNextBtn) {
            aviNextBtn.classList.add('show');
            void aviNextBtn.offsetWidth;
            aviNextBtn.classList.add('visible');
        }
        if (aviPrevBtn) {
            aviPrevBtn.classList.add('show');
            void aviPrevBtn.offsetWidth;
            aviPrevBtn.classList.add('visible');
        }

        // Clear existing timeout
        if (aviNextBtnTimeout) {
            clearTimeout(aviNextBtnTimeout);
        }

        // Hide after 4 seconds (unless hovering)
        aviNextBtnTimeout = setTimeout(function() {
            if (!aviNextBtnHovering) {
                if (aviNextBtn) {
                    aviNextBtn.classList.remove('visible');
                    setTimeout(function() { aviNextBtn.classList.remove('show'); }, 300);
                }
                if (aviPrevBtn) {
                    aviPrevBtn.classList.remove('visible');
                    setTimeout(function() { aviPrevBtn.classList.remove('show'); }, 300);
                }
            }
        }, 4000);
    }

    function hideAviNextButton() {
        if (aviNextBtnTimeout) {
            clearTimeout(aviNextBtnTimeout);
        }
        if (aviNextBtn) {
            aviNextBtn.classList.remove('visible');
            setTimeout(function() { aviNextBtn.classList.remove('show'); }, 300);
        }
        if (aviPrevBtn) {
            aviPrevBtn.classList.remove('visible');
            setTimeout(function() { aviPrevBtn.classList.remove('show'); }, 300);
        }
    }

    function playNextAviTrack() {
        // Trigger nod animation
        avi.classList.remove('nod');
        void avi.offsetWidth; // Force reflow
        avi.classList.add('nod');
        setTimeout(function() {
            avi.classList.remove('nod');
        }, 400);

        selectRandomAvatarTrack();
        audio.play().then(function() {
            aviUpdateCarousel();
            showAviNextButton(); // Show button again after skip
        }).catch(function(err) {
            console.error('Play next error:', err);
        });
    }

    fetch('assets/songs/schedule.json', { cache: 'no-store' })
        .then(function(res) {
            if (!res.ok) {
                throw new Error('schedule fetch failed');
            }
            return res.json();
        })
        .then(function(data) {
            if (data && Array.isArray(data.favorites) && data.favorites.length > 0) {
                favoriteTracks = data.favorites;
            } else {
                favoriteTracks = fallbackFavorites;
            }
        })
        .catch(function() {
            favoriteTracks = fallbackFavorites;
        })
        .finally(function() {
            selectRandomAvatarTrack();
        });

    // Define aviUpdateCarousel - will be set after music controls are initialized
    var aviUpdateCarousel = function() {};

    avi.addEventListener('click', function() {
        triggerTapFlash();
        if (audio.paused) {
            if (typeof mcStopAndClose === 'function') {
                mcStopAndClose();
            }
            aviIsPlaying = true;
            setAviWired(true);
            audio.play().then(function() {
                aviUpdateCarousel();
                showAviNextButton();
            }).catch(function(err) {
                aviIsPlaying = false;
                setAviWired(false);
                console.error('Avatar play error:', err);
            });
        } else {
            aviIsPlaying = false;
            audio.pause();
            setAviWired(false);
            aviUpdateCarousel();
            hideAviNextButton();
        }
    });

    // Avatar ended event - play next random track
    audio.addEventListener('ended', function() {
        if (aviIsPlaying) {
            selectRandomAvatarTrack();
            audio.play().then(function() {
                aviUpdateCarousel();
                showAviNextButton();
            }).catch(function(err) {
                console.error('Auto-play error:', err);
            });
        }
    });

    // Next track button click handler
    if (aviNextBtn) {
        aviNextBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (aviIsPlaying) {
                playNextAviTrack();
            }
        });

        // Track hover state to prevent auto-fade while hovering
        aviNextBtn.addEventListener('mouseenter', function() {
            aviNextBtnHovering = true;
        });

        aviNextBtn.addEventListener('mouseleave', function() {
            aviNextBtnHovering = false;
            // Restart fade timer when mouse leaves
            showAviNextButton();
        });
    }

    // Prev track button click handler
    if (aviPrevBtn) {
        aviPrevBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (aviIsPlaying) {
                playPrevAviTrack();
            }
        });

        aviPrevBtn.addEventListener('mouseenter', function() {
            aviNextBtnHovering = true;
        });

        aviPrevBtn.addEventListener('mouseleave', function() {
            aviNextBtnHovering = false;
            showAviNextButton();
        });
    }

    // ── Inline Music Controls ──
    var mcStopAndClose;
    var mcIsPlaying = false;
    var mcCurrentTrack = 0;
    var mcIsOpen = false;
    var mcTypewriterTimeout = null;
    var mcTracks = [
        { title: 'get it together', src: 'assets/audio/produced/Get it together v2 pitched up.mp3' },
        { title: '4u', src: 'assets/audio/produced/atlanta v2.mp3' },
        { title: '50 Stater', src: 'assets/audio/produced/50 Stater.mp3' },
        { title: 'caught up', src: 'assets/audio/produced/SOF v2.mp3' },
        { title: 'doin me dirty', src: 'assets/audio/produced/doin me dirty @lifecrzy.mp3' },
        { title: 'all the way', src: 'assets/audio/produced/All the way (so crazy) v2 @lifecrzy.mp3' },
        { title: 'choosey lover', src: 'assets/audio/produced/choosey lover (atlanta).mp3' },
        { title: 'mulino prime', src: 'assets/audio/produced/MULINO PRIME @lifecrzy.mp3' },
        { title: 'touchdown', src: 'assets/audio/produced/Khalil Lifestyle x Boofinesse - Touchdown Prod. LIFECRZY.mp3' },
        { title: 'diamond', src: 'assets/audio/produced/DIAMOND v2.mp3' },
        { title: 'share', src: 'assets/audio/produced/share.mp3' },
        { title: 'in the garden', src: 'assets/audio/produced/sex in the garden.mp3' },
        { title: 'know you', src: 'assets/audio/produced/cayman @lifecrzy.mp3' },
        { title: 'familiar', src: 'assets/audio/produced/familiar @lifecrzy.mp3' },
        { title: 'lovely day in may', src: 'assets/audio/produced/Lovely Day in May.mp3' },
        { title: 'broken hearts', src: 'assets/audio/produced/broken hearts 87 bpm.mp3' },
        { title: 'teezn u', src: 'assets/audio/produced/Teezn u @jlitt @lifecrzy.mp3' },
        { title: 'motorola', src: 'assets/audio/produced/Motorola.wav' },
        { title: 'immature', src: 'assets/audio/produced/IMMATURE.wav' },
        { title: 'love me no more', src: 'assets/audio/produced/love me nomore (mixed and mastered).m4a' },
        { title: 'hella options', src: 'assets/audio/produced/hella options @lifecrzy @fggy.mp3' },
        { title: 'rubies', src: 'assets/audio/produced/Rubies.mp3' },
        { title: 'good company', src: 'assets/audio/produced/goodcompany.mp3' },
        { title: 'nicaraguay', src: 'assets/audio/produced/nicaraguay v2 @lifecrzy.mp3' },
        { title: 'you send me', src: 'assets/audio/produced/you send me v3.mp3' },
        { title: 'in order', src: 'assets/audio/produced/in order.mp3' },
        { title: 'miu miu', src: 'assets/audio/produced/miu miu.mp3' },
        { title: 'money dance', src: 'assets/audio/produced/01 Khalil.Lifestyle - Money Dance.mp3' },
        { title: 'something soft', src: 'assets/audio/produced/something soft v2.mp3' },
        { title: 'poison my soda', src: 'assets/audio/produced/01 poison my soda.mp3' },
        { title: 'more more less green', src: 'assets/audio/produced/more more less green.mp3' }
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

        // ── Progress Bar ──
        var progressRow   = document.getElementById('progressRow');
        var progressFill  = document.getElementById('progressFill');
        var progressThumb = document.getElementById('progressThumb');
        var progressElapsed = document.getElementById('progressElapsed');
        var progressTotal   = document.getElementById('progressTotal');
        var progressRafId   = null;

        function formatTime(secs) {
            if (!isFinite(secs) || secs < 0) return '0:00';
            var m = Math.floor(secs / 60);
            var s = Math.floor(secs % 60);
            return m + ':' + (s < 10 ? '0' : '') + s;
        }

        function progressTick() {
            if (!mcAudio.duration) {
                progressRafId = requestAnimationFrame(progressTick);
                return;
            }
            var pct = (mcAudio.currentTime / mcAudio.duration) * 100;
            progressFill.style.width  = pct + '%';
            progressThumb.style.left  = pct + '%';
            progressElapsed.textContent = formatTime(mcAudio.currentTime);
            progressTotal.textContent   = formatTime(mcAudio.duration);
            progressRafId = requestAnimationFrame(progressTick);
        }

        function progressStart() {
            if (progressRow) {
                progressRow.classList.add('visible');
            }
            if (progressRafId) cancelAnimationFrame(progressRafId);
            progressRafId = requestAnimationFrame(progressTick);
        }

        function progressStop() {
            if (progressRafId) {
                cancelAnimationFrame(progressRafId);
                progressRafId = null;
            }
        }

        function progressReset() {
            progressStop();
            if (progressFill)   progressFill.style.width  = '0%';
            if (progressThumb)  progressThumb.style.left  = '0%';
            if (progressElapsed) progressElapsed.textContent = '0:00';
            if (progressTotal)   progressTotal.textContent   = '0:00';
        }

        function progressHide() {
            progressReset();
            if (progressRow) progressRow.classList.remove('visible');
        }

        // Scrub on drag — mousedown + mousemove until mouseup
        if (progressRow) {
            var progressTrackEl = progressRow.querySelector('.progress-track');
            var isScrubbing = false;

            function scrubTo(clientX) {
                if (!mcAudio.duration) return;
                // Use the track element — fill width is 0 at start which breaks division
                var rect = progressTrackEl.getBoundingClientRect();
                var pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                mcAudio.currentTime = pct * mcAudio.duration;
            }

            progressTrackEl.addEventListener('mousedown', function(e) {
                e.preventDefault();
                isScrubbing = true;
                scrubTo(e.clientX);
            });

            document.addEventListener('mousemove', function(e) {
                if (!isScrubbing) return;
                scrubTo(e.clientX);
            });

            document.addEventListener('mouseup', function() {
                isScrubbing = false;
            });

            // Touch scrubbing
            progressTrackEl.addEventListener('touchstart', function(e) {
                e.preventDefault();
                isScrubbing = true;
                scrubTo(e.touches[0].clientX);
            }, { passive: false });

            document.addEventListener('touchmove', function(e) {
                if (!isScrubbing) return;
                scrubTo(e.touches[0].clientX);
            }, { passive: true });

            document.addEventListener('touchend', function() {
                isScrubbing = false;
            });
        }

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
            progressReset();
            progressStart();
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
                    pulseBanner();
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

        // ── Page Title Tick ──
        var titleTick = (function() {
            var BASE_TITLE = document.title;
            var _intervalId = null;
            var _phase = false; // false = track name, true = base title

            function start(trackName) {
                stop();
                _phase = false;
                document.title = '♪ ' + trackName + ' — cyril';
                _intervalId = setInterval(function() {
                    _phase = !_phase;
                    document.title = _phase ? BASE_TITLE : '♪ ' + trackName + ' — cyril';
                }, 3000);
            }

            function stop() {
                if (_intervalId) {
                    clearInterval(_intervalId);
                    _intervalId = null;
                }
                document.title = BASE_TITLE;
            }

            function sync() {
                if (aviIsPlaying && currentAviTrack) {
                    start(getAviTrackName(currentAviTrack));
                } else if (mcIsPlaying) {
                    start(mcTracks[mcCurrentTrack].title);
                } else {
                    stop();
                }
            }

            return { sync: sync, stop: stop };
        })();

        function carouselUpdate() {
            // Avatar takes priority over music controls
            if (aviIsPlaying && currentAviTrack) {
                var trackName = getAviTrackName(currentAviTrack);
                var title = 'you are now listening to ' + trackName;
                carouselShow(title);
            } else if (mcIsPlaying) {
                var title = 'you are now listening to ' + mcTracks[mcCurrentTrack].title;
                carouselShow(title);
            } else {
                carouselHide();
            }
            titleTick.sync();
        }

        function getAviTrackName(src) {
            // Extract filename from path (e.g., "juna by clairo.mp3")
            var filename = src.split('/').pop();
            // Remove extension
            filename = filename.replace('.mp3', '').replace('.wav', '');
            // Filename is already in format "song name by artist"
            return filename;
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
            if (bannerSlot) {
                bannerSlot.classList.add('carousel-live');
            }
            pulseBanner();
        }

        function carouselHide() {
            if (!carouselViewport || !carouselTrack) return;
            carouselTrack.classList.remove('scrolling');
            carouselTrack.textContent = '';
            carouselViewport.classList.remove('active');
            if (bannerSlot) {
                bannerSlot.classList.remove('carousel-live');
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
            progressHide();
            if (!aviIsPlaying && !mcIsPlaying) setAviWired(false);
            carouselUpdate();
        }

        function mcResetPlayback() {
            mcAudio.pause();
            mcAudio.currentTime = 0;
            mcIsPlaying = false;
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
            setAviWired(false);
            progressHide();
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
            aviIsPlaying = false;
            setAviWired(false);
            carouselUpdate();
            hideAviNextButton();
        }

        // Expose carousel update for avatar
        aviUpdateCarousel = carouselUpdate;

        // Detect mobile/touch devices
        var isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        // Carousel interaction to show next button
        if (carouselViewport) {
            if (isTouchDevice) {
                // On mobile: use click
                carouselViewport.addEventListener('click', function() {
                    if (aviIsPlaying) {
                        showAviNextButton();
                    }
                });
            } else {
                // On desktop: use hover
                carouselViewport.addEventListener('mouseenter', function() {
                    if (aviIsPlaying) {
                        showAviNextButton();
                    }
                });
            }
        }

        // Banner slot interaction to show next button (includes carousel area)
        if (bannerSlot) {
            if (isTouchDevice) {
                // On mobile: use click
                bannerSlot.addEventListener('click', function() {
                    if (aviIsPlaying) {
                        showAviNextButton();
                    }
                });
            } else {
                // On desktop: use hover
                bannerSlot.addEventListener('mouseenter', function() {
                    if (aviIsPlaying) {
                        showAviNextButton();
                    }
                });
            }
        }

        function triggerAvatarSongsReaction() {
            avi.classList.remove('react-songs');
            void avi.offsetWidth;
            avi.classList.add('react-songs');
            setTimeout(function() {
                avi.classList.remove('react-songs');
            }, 260);
        }

        songsLink.addEventListener('mouseenter', triggerAvatarSongsReaction);
        songsLink.addEventListener('focus', triggerAvatarSongsReaction);

        songsLink.addEventListener('click', function(e) {
            e.preventDefault();
            if (mcIsOpen) {
                mcClose();
                if (!aviIsPlaying) setAviWired(false);
            } else {
                mcControls.classList.remove('closing');
                mcControls.classList.add('active');
                mcIsOpen = true;
                setAviWired(true);
                if (mcIsPlaying) progressStart();
                mcUpdateNowPlaying(true);
            }
        });

        playPauseBtn.addEventListener('click', function() {
            mcIsPlaying = !mcIsPlaying;
            playIcon.style.display = mcIsPlaying ? 'none' : 'block';
            pauseIcon.style.display = mcIsPlaying ? 'block' : 'none';
            if (mcIsPlaying) {
                stopAviAudio();
                setAviWired(true);
                if (!mcAudio.src || mcAudio.src === location.href) {
                    mcLoadTrack();
                }
                mcAudio.play();
                progressStart();
            } else {
                mcAudio.pause();
                setAviWired(false);
                progressStop();
            }
            mcUpdateNowPlaying(true);
        });

        prevBtn.addEventListener('click', function() {
            mcCurrentTrack = (mcCurrentTrack - 1 + mcTracks.length) % mcTracks.length;
            mcLoadTrack();
            progressReset();
            if (mcIsPlaying) {
                mcAudio.play();
                progressStart();
            }
            mcUpdateNowPlaying(true);
        });

        nextBtn.addEventListener('click', function() {
            mcCurrentTrack = (mcCurrentTrack + 1) % mcTracks.length;
            mcLoadTrack();
            progressReset();
            if (mcIsPlaying) {
                mcAudio.play();
                progressStart();
            }
            mcUpdateNowPlaying(true);
        });

        document.addEventListener('click', function(e) {
            if (!e.target.closest('.songs-item') && mcIsOpen) {
                mcClose();
            }
        });

        // ── D-Pad Arrow Key Controls ──
        document.addEventListener('keydown', function(e) {
            var tag = e.target.tagName.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

            if (mcIsPlaying) {
                e.preventDefault();
                if (e.key === 'ArrowLeft') {
                    // Rewind if > 3s into track, else go to previous
                    if (mcAudio.currentTime > 3) {
                        mcAudio.currentTime = 0;
                        progressReset();
                        progressStart();
                    } else {
                        mcCurrentTrack = (mcCurrentTrack - 1 + mcTracks.length) % mcTracks.length;
                        progressReset();
                        mcAudio.src = mcTracks[mcCurrentTrack].src;
                        mcAudio.play();
                        progressStart();
                        mcUpdateNowPlaying(true);
                    }
                } else {
                    // Right: skip to next
                    mcCurrentTrack = (mcCurrentTrack + 1) % mcTracks.length;
                    progressReset();
                    mcAudio.src = mcTracks[mcCurrentTrack].src;
                    mcAudio.play();
                    progressStart();
                    mcUpdateNowPlaying(true);
                }
            } else if (aviIsPlaying) {
                e.preventDefault();
                if (e.key === 'ArrowLeft') {
                    // Rewind if > 3s in, else go to previous in history
                    if (audio.currentTime > 3) {
                        audio.currentTime = 0;
                    } else {
                        playPrevAviTrack();
                    }
                } else {
                    // Right: next random avi track
                    playNextAviTrack();
                }
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
    document.addEventListener('keydown', function(e) {
        var tag = e.target.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) {
            return;
        }

        if (e.key === '?') {
            e.preventDefault();
            if (hintsOverlay) {
                var shouldOpen = !hintsOverlay.classList.contains('active');
                hintsOverlay.classList.toggle('active', shouldOpen);
                hintsOverlay.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
            }
        } else if (e.key === 'Escape' && hintsOverlay && hintsOverlay.classList.contains('active')) {
            hintsOverlay.classList.remove('active');
            hintsOverlay.setAttribute('aria-hidden', 'true');
        }
    });

    if (hintsOverlay) {
        hintsOverlay.addEventListener('click', function(e) {
            if (e.target === hintsOverlay) {
                hintsOverlay.classList.remove('active');
                hintsOverlay.setAttribute('aria-hidden', 'true');
            }
        });
    }

    (function() {
        var keyBuffer = '';
        var cooldownActive = false;
        var COOLDOWN_MS = 3000;
        var BUFFER_MAX = 10;

        var patterns = {
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
