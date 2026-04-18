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

// ── IndexedDB Audio Store ──
var songDB = (function() {
    var DB_NAME = 'cyril_songs', STORE = 'blobs', VERSION = 1;
    var _db = null;

    function open(cb) {
        if (_db) { cb(_db); return; }
        var req = indexedDB.open(DB_NAME, VERSION);
        req.onupgradeneeded = function(e) {
            e.target.result.createObjectStore(STORE);
        };
        req.onsuccess = function(e) {
            _db = e.target.result;
            cb(_db);
        };
        req.onerror = function() { cb(null); };
    }

    function save(key, blob, cb) {
        open(function(db) {
            if (!db) { if (cb) cb(false); return; }
            var tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put(blob, key);
            tx.oncomplete = function() { if (cb) cb(true); };
            tx.onerror = function() { if (cb) cb(false); };
        });
    }

    function load(key, cb) {
        open(function(db) {
            if (!db) { cb(null); return; }
            var tx = db.transaction(STORE, 'readonly');
            var req = tx.objectStore(STORE).get(key);
            req.onsuccess = function() { cb(req.result || null); };
            req.onerror = function() { cb(null); };
        });
    }

    function remove(key, cb) {
        open(function(db) {
            if (!db) { if (cb) cb(); return; }
            var tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).delete(key);
            tx.oncomplete = function() { if (cb) cb(); };
        });
    }

    function clear(cb) {
        open(function(db) {
            if (!db) { if (cb) cb(); return; }
            var tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).clear();
            tx.oncomplete = function() { if (cb) cb(); };
        });
    }

    return { save: save, load: load, remove: remove, clear: clear };
})();

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

    // Restarts a CSS animation class on an element (force-reflow pattern).
    function triggerAnimation(el, cls, ms) {
        el.classList.remove(cls);
        void el.offsetWidth;
        el.classList.add(cls);
        setTimeout(function() { el.classList.remove(cls); }, ms);
    }

    function triggerTapFlash() {
        if (flashTimeoutId) clearTimeout(flashTimeoutId);
        avi.classList.remove('tap-flash');
        void avi.offsetWidth;
        avi.classList.add('tap-flash');
        flashTimeoutId = setTimeout(function() {
            avi.classList.remove('tap-flash');
        }, 650);
    }

    // Avatar audio: favorite songs playlist (shuffled on page load)
    const fallbackFavorites = [
        'assets/audio/favorites/Clairo Juna Live Ending.mp3'
    ];
    var AVI_TRACKS_KEY = 'cyril_avi_tracks';
    var aviTracksDefault = null; // set after schedule.json loads
    var aviObjectURLs = {}; // localKey → object url

    // Generic localStorage JSON store — returns { load, save } bound to a key.
    function makeTracksStorage(key) {
        return {
            load: function() {
                try { var s = localStorage.getItem(key); if (s) return JSON.parse(s); } catch (e) {}
                return null;
            },
            save: function(tracks) {
                try { localStorage.setItem(key, JSON.stringify(tracks)); } catch (e) {}
            },
        };
    }

    var _aviStorage  = makeTracksStorage(AVI_TRACKS_KEY);
    function aviTracksLoad()         { return _aviStorage.load(); }
    function aviTracksSave(tracks)   { _aviStorage.save(tracks); }

    let favoriteTracks = [];
    let currentAviTrack = null;
    let aviIsPlaying = false;
    let aviIsPaused = false;
    let aviNextBtnTimeout = null;
    let aviNextBtnHovering = false;
    const aviNextBtn = document.getElementById('aviNextBtn');
    const aviPrevBtn = document.getElementById('aviPrevBtn');
    const aviPauseBtn = document.getElementById('aviPauseBtn');
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
        loadAviTrack(currentAviTrack);
    }

    // Shared track loader — resolves src/localKey/plain-string to a URL,
    // sets it on audioEl, calls .load(), and optionally .play().
    // Used by both the avatar audio element and the music controls player.
    function resolveTrackToAudio(track, audioEl, urlCache, thenPlay) {
        var src = typeof track === 'object' ? (track.src || null) : track;
        var localKey = track && track.localKey;

        function applyAndLoad(url) {
            audioEl.src = url;
            if (audioEl.dataset) audioEl.dataset.currentSrc = url;
            audioEl.load();
            if (thenPlay) audioEl.play();
        }

        if (src) {
            applyAndLoad(src);
        } else if (localKey) {
            if (urlCache[localKey]) {
                applyAndLoad(urlCache[localKey]);
            } else {
                songDB.load(localKey, function(blob) {
                    if (blob) {
                        urlCache[localKey] = URL.createObjectURL(blob);
                        applyAndLoad(urlCache[localKey]);
                    }
                });
            }
        }
    }

    function loadAviTrack(track) {
        resolveTrackToAudio(track, audio, aviObjectURLs, false);
    }

    function isAviActive() {
        return aviIsPlaying || aviIsPaused;
    }

    function updateAviPauseButton() {
        if (!aviPauseBtn) return;
        var playIcon = aviPauseBtn.querySelector('.avi-play-icon');
        var pauseIcon = aviPauseBtn.querySelector('.avi-pause-icon');
        var isPaused = audio.paused;
        if (playIcon) playIcon.style.display = isPaused ? 'block' : 'none';
        if (pauseIcon) pauseIcon.style.display = isPaused ? 'none' : 'block';
        aviPauseBtn.setAttribute('aria-label', isPaused ? 'Resume track' : 'Pause track');
    }

    function playAviAudio() {
        if (typeof mcStopAndClose === 'function') {
            mcStopAndClose();
        }
        aviIsPlaying = true;
        aviIsPaused = false;
        setAviWired(true);
        audio.play().then(function() {
            aviUpdateCarousel();
            showAviNextButton();
            updateAviPauseButton();
        }).catch(function(err) {
            aviIsPlaying = false;
            setAviWired(false);
            updateAviPauseButton();
            console.error('Avatar play error:', err);
        });
    }

    function pauseAviAudio() {
        aviIsPlaying = false;
        aviIsPaused = true;
        audio.pause();
        setAviWired(true);
        aviUpdateCarousel();
        showAviNextButton();
        updateAviPauseButton();
    }

    function toggleAviPlayback() {
        if (audio.paused) {
            playAviAudio();
        } else {
            pauseAviAudio();
        }
    }

    function playPrevAviTrack() {
        if (aviPlaylist.length === 0 || !isAviActive()) return;

        if (aviCursor <= 0) {
            // Already at the start — just rewind
            audio.currentTime = 0;
            return;
        }

        triggerAnimation(avi, 'nod', 400);

        // Step back in the same playlist — no reshuffle
        aviCursor--;
        currentAviTrack = aviPlaylist[aviCursor];
        loadAviTrack(currentAviTrack);
        aviIsPlaying = true;
        aviIsPaused = false;
        audio.play().then(function() {
            aviUpdateCarousel();
            showAviNextButton();
        }).catch(function(err) {
            console.error('Prev avi track error:', err);
        });
    }

    function showAviNextButton() {
        if (!isAviActive()) return;

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
        if (aviPauseBtn) {
            aviPauseBtn.classList.add('show');
            void aviPauseBtn.offsetWidth;
            aviPauseBtn.classList.add('visible');
        }
        updateAviPauseButton();

        // Clear existing timeout
        if (aviNextBtnTimeout) {
            clearTimeout(aviNextBtnTimeout);
        }

        if (aviIsPaused) {
            return;
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
                if (aviPauseBtn) {
                    aviPauseBtn.classList.remove('visible');
                    setTimeout(function() { aviPauseBtn.classList.remove('show'); }, 300);
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
        if (aviPauseBtn) {
            aviPauseBtn.classList.remove('visible');
            setTimeout(function() { aviPauseBtn.classList.remove('show'); }, 300);
        }
    }

    function playNextAviTrack() {
        if (!isAviActive()) return;
        triggerAnimation(avi, 'nod', 400);

        selectRandomAvatarTrack();
        aviIsPlaying = true;
        aviIsPaused = false;
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
            var fromSchedule = (data && Array.isArray(data.favorites) && data.favorites.length > 0)
                ? data.favorites
                : fallbackFavorites;
            aviTracksDefault = fromSchedule.slice();
            var savedAvi = aviTracksLoad();
            favoriteTracks = savedAvi || fromSchedule;
        })
        .catch(function() {
            aviTracksDefault = fallbackFavorites.slice();
            var savedAvi = aviTracksLoad();
            favoriteTracks = savedAvi || fallbackFavorites;
        })
        .finally(function() {
            selectRandomAvatarTrack();
        });

    // Define aviUpdateCarousel - will be set after music controls are initialized
    var aviUpdateCarousel = function() {};

    avi.addEventListener('click', function() {
        triggerTapFlash();
        toggleAviPlayback();
    });

    // Avatar ended event - play next random track
    audio.addEventListener('ended', function() {
        if (aviIsPlaying) {
            selectRandomAvatarTrack();
            audio.play().then(function() {
                aviUpdateCarousel();
                showAviNextButton();
                updateAviPauseButton();
            }).catch(function(err) {
                console.error('Auto-play error:', err);
            });
        }
    });

    audio.addEventListener('play', updateAviPauseButton);
    audio.addEventListener('pause', updateAviPauseButton);

    // Next track button click handler
    if (aviNextBtn) {
        aviNextBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            playNextAviTrack();
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
            playPrevAviTrack();
        });

        aviPrevBtn.addEventListener('mouseenter', function() {
            aviNextBtnHovering = true;
        });

        aviPrevBtn.addEventListener('mouseleave', function() {
            aviNextBtnHovering = false;
            showAviNextButton();
        });
    }

    if (aviPauseBtn) {
        aviPauseBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleAviPlayback();
        });

        aviPauseBtn.addEventListener('mouseenter', function() {
            aviNextBtnHovering = true;
        });

        aviPauseBtn.addEventListener('mouseleave', function() {
            aviNextBtnHovering = false;
            showAviNextButton();
        });
    }

    // ── Inline Music Controls ──
    var MC_TRACKS_KEY = 'cyril_mc_tracks';
    var mcObjectURLs = {}; // localKey → object url

    var _mcStorage   = makeTracksStorage(MC_TRACKS_KEY);
    function mcTracksLoad()          { return _mcStorage.load(); }
    function mcTracksSave(tracks)    { _mcStorage.save(tracks); }

    var mcStopAndClose;
    var mcIsPlaying = false;
    var mcCurrentTrack = 0;
    var mcIsOpen = false;
    var mcTypewriterTimeout = null;
    var mcTracksDefault = [
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

    var mcTracks = mcTracksLoad() || mcTracksDefault.slice();

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

    fetch('assets/songs/produced.json', { cache: 'no-store' })
        .then(function(res) { if (!res.ok) throw new Error('produced fetch failed'); return res.json(); })
        .then(function(data) {
            if (data && Array.isArray(data.produced) && data.produced.length > 0) {
                mcTracksDefault = data.produced.slice();
                if (!mcTracksLoad()) {
                    mcTracks = mcTracksDefault.slice();
                    mcShuffle();
                }
            }
        })
        .catch(function() {});

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

        function mcLoadTrack(thenPlay) {
            resolveTrackToAudio(mcTracks[mcCurrentTrack], mcAudio, mcObjectURLs, thenPlay);
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
            mcLoadTrack(true);
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
                document.title = '♪ ' + trackName;
                _intervalId = setInterval(function() {
                    _phase = !_phase;
                    document.title = _phase ? BASE_TITLE : '♪ ' + trackName;
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
                if (isAviActive() && currentAviTrack) {
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
            if (isAviActive() && currentAviTrack) {
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

        function getAviTrackName(track) {
            // Handle both plain path strings and {title, localKey, src} objects
            if (track && typeof track === 'object') {
                return track.title || track.localKey || 'unknown';
            }
            // Extract filename from path (e.g., "juna by clairo.mp3")
            var filename = track.split('/').pop();
            // Remove extension
            filename = filename.replace('.mp3', '').replace('.wav', '').replace('.m4a', '');
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
            if (!isAviActive() && !mcIsPlaying) setAviWired(false);
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
            aviIsPaused = false;
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
                    if (isAviActive()) {
                        showAviNextButton();
                    }
                });
            } else {
                // On desktop: use hover
                carouselViewport.addEventListener('mouseenter', function() {
                    if (isAviActive()) {
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
                    if (isAviActive()) {
                        showAviNextButton();
                    }
                });
            } else {
                // On desktop: use hover
                bannerSlot.addEventListener('mouseenter', function() {
                    if (isAviActive()) {
                        showAviNextButton();
                    }
                });
            }
        }

        function triggerAvatarSongsReaction() {
            triggerAnimation(avi, 'react-songs', 260);
        }

        songsLink.addEventListener('mouseenter', triggerAvatarSongsReaction);
        songsLink.addEventListener('focus', triggerAvatarSongsReaction);

        songsLink.addEventListener('click', function(e) {
            e.preventDefault();
            if (mcIsOpen) {
                mcClose();
                if (!isAviActive()) setAviWired(false);
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
                    mcLoadTrack(true);
                } else {
                    mcAudio.play();
                }
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
            progressReset();
            mcLoadTrack(mcIsPlaying);
            if (mcIsPlaying) progressStart();
            mcUpdateNowPlaying(true);
        });

        nextBtn.addEventListener('click', function() {
            mcCurrentTrack = (mcCurrentTrack + 1) % mcTracks.length;
            progressReset();
            mcLoadTrack(mcIsPlaying);
            if (mcIsPlaying) progressStart();
            mcUpdateNowPlaying(true);
        });

        document.addEventListener('click', function(e) {
            if (!e.target.closest('.songs-item') && !e.target.closest('#songsPanel') && mcIsOpen) {
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
                        mcLoadTrack(true);
                        progressStart();
                        mcUpdateNowPlaying(true);
                    }
                } else {
                    // Right: skip to next
                    mcCurrentTrack = (mcCurrentTrack + 1) % mcTracks.length;
                    progressReset();
                    mcLoadTrack(true);
                    progressStart();
                    mcUpdateNowPlaying(true);
                }
            } else if (isAviActive()) {
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

    // ── MP3 Downloader Panel ──
    (function() {
        var mp3Panel = document.getElementById('mp3Panel');
        var mp3UrlInput = document.getElementById('mp3Url');
        var mp3ConvertBtn = document.getElementById('mp3ConvertBtn');
        var mp3Status = document.getElementById('mp3Status');

        if (!mp3Panel) return;

        function showPanel() {
            mp3Panel.classList.add('active');
            mp3Panel.setAttribute('aria-hidden', 'false');
            // Focus input after slide-in animation
            setTimeout(function() {
                if (mp3UrlInput) mp3UrlInput.focus();
            }, 450);
        }

        function hidePanel() {
            mp3Panel.classList.remove('active');
            mp3Panel.setAttribute('aria-hidden', 'true');
        }

        // Expose toggle for the keystroke pattern listener
        window._toggleMp3Panel = function() {
            if (mp3Panel.classList.contains('active')) {
                hidePanel();
            } else {
                showPanel();
            }
        };

        // Close on Escape
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && mp3Panel.classList.contains('active')) {
                hidePanel();
            }
        });

        // Close when clicking outside the panel
        document.addEventListener('click', function(e) {
            if (mp3Panel.classList.contains('active') && !e.target.closest('#mp3Panel')) {
                hidePanel();
            }
        });

        function setStatus(msg, isError) {
            if (!mp3Status) return;
            mp3Status.textContent = msg;
            mp3Status.classList.toggle('error', !!isError);
        }

        function triggerDownload(url) {
            var a = document.createElement('a');
            a.href = '/api/download?url=' + encodeURIComponent(url);
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }

        function startConversion(url) {
            if (mp3ConvertBtn) mp3ConvertBtn.disabled = true;
            setStatus('fetching info...', false);

            fetch('/api/metadata?url=' + encodeURIComponent(url))
                .then(function(res) {
                    if (!res.ok) {
                        return res.json().then(function(d) { throw new Error(d.error || 'Not found'); });
                    }
                    return res.json();
                })
                .then(function(meta) {
                    var label = meta.title ? meta.title : 'downloading...';
                    setStatus(label, false);
                    triggerDownload(url);
                    setTimeout(function() {
                        if (mp3ConvertBtn) mp3ConvertBtn.disabled = false;
                        setStatus('', false);
                    }, 4000);
                })
                .catch(function(err) {
                    // Metadata fetch failed — still attempt the download
                    setStatus('downloading...', false);
                    triggerDownload(url);
                    setTimeout(function() {
                        if (mp3ConvertBtn) mp3ConvertBtn.disabled = false;
                        setStatus('', false);
                    }, 4000);
                });
        }

        function handleConvert() {
            var url = mp3UrlInput ? mp3UrlInput.value.trim() : '';
            if (!url) {
                setStatus('paste a url first', false);
                return;
            }
            startConversion(url);
        }

        if (mp3ConvertBtn) {
            mp3ConvertBtn.addEventListener('click', handleConvert);
        }

        if (mp3UrlInput) {
            mp3UrlInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConvert();
                }
            });
        }
    })();

    // ── Songs Manager Panel ──
    (function() {
        var songsPanel = document.getElementById('songsPanel');
        if (!songsPanel) return;

        var activeTab = 'avatar';

        // ── Upload secret ──
        var SECRET_KEY = 'cyril_upload_secret';

        function getUploadSecret() {
            try { return localStorage.getItem(SECRET_KEY) || ''; } catch (e) { return ''; }
        }

        function setUploadSecret(val) {
            try { localStorage.setItem(SECRET_KEY, val); } catch (e) {}
        }

        function clearUploadSecret() {
            try { localStorage.removeItem(SECRET_KEY); } catch (e) {}
        }

        // Prompt for the secret if it's not stored. Returns true if we have one.
        function ensureSecret() {
            if (getUploadSecret()) return true;
            var s = window.prompt('Enter upload secret:');
            if (s && s.trim()) { setUploadSecret(s.trim()); return true; }
            return false;
        }

        // ── Open / Close ──
        function showSongsPanel() {
            if (!ensureSecret()) return; // abort open if no secret entered
            songsPanel.classList.add('active');
            songsPanel.setAttribute('aria-hidden', 'false');
            renderBoth();
        }

        function hideSongsPanel() {
            songsPanel.classList.remove('active');
            ['Avatar', 'Produced'].forEach(function(tab) {
                var input = document.getElementById('songsSearch' + tab);
                if (input) input.value = '';
            });
            songsPanel.setAttribute('aria-hidden', 'true');
            // Reset any mid-confirm reset buttons back to their default state
            var rA = document.getElementById('songsResetAvatar');
            var rP = document.getElementById('songsResetProduced');
            if (rA) { rA.textContent = 'reset to defaults'; rA.classList.remove('confirming'); }
            if (rP) { rP.textContent = 'reset to defaults'; rP.classList.remove('confirming'); }
        }

        window._toggleSongsPanel = function() {
            if (songsPanel.classList.contains('active')) {
                hideSongsPanel();
            } else {
                showSongsPanel();
            }
        };

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && songsPanel.classList.contains('active')) {
                hideSongsPanel();
            }
        });

        document.addEventListener('click', function(e) {
            if (!songsPanel.classList.contains('active')) return;
            // Use composedPath so clicks on elements removed from DOM (e.g. deleted rows)
            // don't falsely appear as outside-clicks and close the panel.
            var path = e.composedPath ? e.composedPath() : [];
            var insidePanel = path.some(function(el) { return el === songsPanel; });
            if (!insidePanel && !e.target.closest('#songsPanel')) {
                hideSongsPanel();
            }
        });

        // ── Tab switching ──
        var tabs = songsPanel.querySelectorAll('.songs-tab');
        tabs.forEach(function(btn) {
            btn.addEventListener('click', function() {
                activeTab = btn.dataset.tab;
                tabs.forEach(function(t) { t.classList.toggle('active', t === btn); });
                var tabAvatar = document.getElementById('songsTabAvatar');
                var tabProduced = document.getElementById('songsTabProduced');
                if (tabAvatar) tabAvatar.style.display = activeTab === 'avatar' ? '' : 'none';
                if (tabProduced) tabProduced.style.display = activeTab === 'produced' ? '' : 'none';
            });
        });

        // ── Helpers ──
        function fileNameToTitle(filename) {
            return filename.replace(/\.[^/.]+$/, '');
        }

        function getAviDisplayName(track) {
            if (track && typeof track === 'object') {
                return track.title || track.localKey || 'unknown';
            }
            return track.split('/').pop().replace(/\.[^/.]+$/, '');
        }

        // ── Search filter ──
        function applySearch(listElId, query) {
            var q = query.toLowerCase().trim();
            var rows = document.querySelectorAll('#' + listElId + ' .songs-row');
            rows.forEach(function(row) {
                var title = (row.querySelector('.songs-row-title') || {}).textContent || '';
                row.style.display = (!q || title.toLowerCase().includes(q)) ? '' : 'none';
            });
        }

        ['Avatar', 'Produced'].forEach(function(tab) {
            var input = document.getElementById('songsSearch' + tab);
            if (!input) return;
            input.addEventListener('input', function() {
                applySearch('songsList' + tab, input.value);
            });
        });

        // ── Render lists ──
        function renderBoth() {
            renderAvatarList();
            renderProducedList();
        }

        // Shared row builder — both tabs use this; reorder buttons removed since
        // both playlists are Fisher-Yates shuffled on playback (order never matters).
        function renderTrackList(config) {
            var listEl = document.getElementById(config.listElId);
            if (!listEl) return;
            listEl.innerHTML = '';
            config.tracks.forEach(function(track, i) {
                var row = document.createElement('div');
                row.className = 'songs-row';

                var titleSpan = document.createElement('span');
                titleSpan.className = 'songs-row-title';
                titleSpan.setAttribute('contenteditable', 'true');
                titleSpan.setAttribute('spellcheck', 'false');
                titleSpan.textContent = config.getTitle(track);
                titleSpan.addEventListener('blur', function() {
                    var newTitle = titleSpan.textContent.trim();
                    if (!newTitle) return;
                    config.setTitle(config.tracks, i, newTitle);
                    config.saveFn(config.tracks);
                    var trackSrc = typeof track === 'object' ? track.src : track;
                    if (trackSrc && trackSrc.startsWith('assets/audio/')) {
                        fetch('/api/rename', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'x-upload-secret': getUploadSecret() },
                            body: JSON.stringify({ target: config.apiTarget, src: trackSrc, title: newTitle }),
                        }).catch(function(err) { console.error('Rename API error:', err); });
                    }
                });
                titleSpan.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') { e.preventDefault(); titleSpan.blur(); }
                });

                var delBtn = document.createElement('button');
                delBtn.className = 'songs-row-btn';
                delBtn.textContent = '✕';
                delBtn.title = 'remove';
                delBtn.addEventListener('click', function() {
                    var removed = config.tracks.splice(i, 1)[0];
                    if (removed && removed.localKey) {
                        if (config.objectURLs[removed.localKey]) {
                            URL.revokeObjectURL(config.objectURLs[removed.localKey]);
                            delete config.objectURLs[removed.localKey];
                        }
                        songDB.remove(removed.localKey);
                    }
                    config.saveFn(config.tracks);
                    config.rerenderFn();
                    var repoPath = removed && (typeof removed === 'object' ? (removed.src || null) : removed);
                    if (repoPath && repoPath.startsWith('assets/audio/')) {
                        fetch('/api/delete', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'x-upload-secret': getUploadSecret() },
                            body: JSON.stringify({ path: repoPath, target: config.apiTarget }),
                        }).catch(function(err) { console.error('Delete API error:', err); });
                    }
                });

                row.appendChild(titleSpan);
                row.appendChild(delBtn);
                listEl.appendChild(row);
            });
        }

        function renderAvatarList() {
            renderTrackList({
                listElId:   'songsListAvatar',
                tracks:     favoriteTracks,
                objectURLs: aviObjectURLs,
                saveFn:     aviTracksSave,
                rerenderFn: renderAvatarList,
                getTitle:   function(track) { return getAviDisplayName(track); },
                setTitle:   function(tracks, i, val) {
                    if (typeof tracks[i] === 'object') { tracks[i].title = val; }
                    else { tracks[i] = { title: val, src: tracks[i] }; }
                },
                apiTarget: 'avatar',
            });
        }

        function renderProducedList() {
            renderTrackList({
                listElId:   'songsListProduced',
                tracks:     mcTracks,
                objectURLs: mcObjectURLs,
                saveFn:     mcTracksSave,
                rerenderFn: renderProducedList,
                getTitle:   function(track) { return track.title; },
                setTitle:   function(tracks, i, val) { tracks[i].title = val; },
                apiTarget: 'produced',
            });
        }

        // ── Upload handling ──
        // Uploads POST to /api/upload which commits the file to GitHub.
        // Vercel auto-deploys, making it a real static asset for all visitors in ~30s.
        // While waiting for deploy, the track is also cached in IndexedDB locally
        // so it plays immediately in your browser without waiting.
        function handleUpload(file, type, zone) {
            var title = fileNameToTitle(file.name);
            if (zone) zone.textContent = 'uploading…';

            // Cache file in IndexedDB immediately for local playback while deploy happens
            var localKey = 'local_' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            songDB.save(localKey, file);

            // Phase 1: ask the server for the upload target (filePath, SHA, token)
            // Only { filename, target } go through Vercel — no file data, no size limit hit.
            fetch('/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-upload-secret': getUploadSecret() },
                body: JSON.stringify({ filename: file.name, target: type }),
            })
            .then(function(r) {
                if (r.status === 401) { clearUploadSecret(); throw new Error('Wrong secret — re-open panel to try again'); }
                return r.json();
            })
            .then(function(prep) {
                if (prep.error) throw new Error(prep.error);

                // Phase 2: read file as base64 and PUT directly to GitHub from the browser.
                // This bypasses Vercel entirely — no 4.5mb limit.
                return new Promise(function(resolve, reject) {
                    var reader = new FileReader();
                    reader.onload = function(e) {
                        var base64 = e.target.result.split(',')[1];
                        var commitBody = {
                            message: 'upload: add ' + file.name,
                            content: base64,
                            branch: prep.branch,
                        };
                        if (prep.existingSha) commitBody.sha = prep.existingSha;

                        fetch(
                            'https://api.github.com/repos/' + prep.repoOwner + '/' + prep.repoName + '/contents/' + prep.filePath,
                            {
                                method: 'PUT',
                                headers: {
                                    'Authorization': 'token ' + prep.token,
                                    'Accept': 'application/vnd.github.v3+json',
                                    'Content-Type': 'application/json',
                                    'User-Agent': 'cyrilhd-upload',
                                },
                                body: JSON.stringify(commitBody),
                            }
                        )
                        .then(function(ghRes) {
                            if (!ghRes.ok) {
                                return ghRes.json().then(function(e) {
                                    throw new Error('GitHub error (' + ghRes.status + '): ' + (e.message || 'unknown'));
                                });
                            }
                            return ghRes.json();
                        })
                        .then(function() {
                            // Phase 3: tell the server to update schedule.json (tiny call, no file)
                            return fetch('/api/upload', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'x-upload-secret': getUploadSecret() },
                                body: JSON.stringify({ target: type, filePath: prep.filePath, finalize: true }),
                            }).then(function(r) { return r.json(); });
                        })
                        .then(resolve)
                        .catch(reject);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            })
            .then(function(data) {
                if (data.error) throw new Error(data.error);

                // Show confirmation, then restore upload zone
                var pickId = type === 'avatar' ? 'songsPickAvatar' : 'songsPickProduced';
                var inputId = type === 'avatar' ? 'songsFileAvatar' : 'songsFileProduced';
                var confirmMsg = 'uploaded successfully';
                if (zone) zone.textContent = confirmMsg;
                setTimeout(function() {
                    if (zone) zone.innerHTML = '<span>drop a file or <button class="songs-pick-btn" id="' + pickId + '">pick one</button></span>';
                    var newPick = document.getElementById(pickId);
                    if (newPick) newPick.addEventListener('click', function(e) {
                        e.stopPropagation();
                        var inp = document.getElementById(inputId);
                        if (inp) inp.click();
                    });
                }, 3000);

                // Add track to the live list
                if (type === 'avatar') {
                    favoriteTracks.push({ title: data.title || title, src: data.path, localKey: localKey });
                    aviTracksSave(favoriteTracks);
                    renderAvatarList();
                } else {
                    mcTracks.push({ title: data.title || title, src: data.path, localKey: localKey });
                    mcTracksSave(mcTracks);
                    renderProducedList();
                }
            })
            .catch(function(err) {
                if (zone) zone.textContent = 'error: ' + (err.message || 'upload failed');
                console.error('Upload error:', err);
            });
        }

        function setupUploadZone(zoneId, inputId, pickBtnId, type) {
            var zone = document.getElementById(zoneId);
            var input = document.getElementById(inputId);
            var pickBtn = document.getElementById(pickBtnId);
            if (!zone || !input || !pickBtn) return;

            pickBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                input.click();
            });

            input.addEventListener('change', function() {
                if (input.files && input.files[0]) {
                    handleUpload(input.files[0], type, zone);
                    input.value = '';
                }
            });

            zone.addEventListener('dragover', function(e) {
                e.preventDefault();
                zone.classList.add('drag-over');
            });

            zone.addEventListener('dragleave', function() {
                zone.classList.remove('drag-over');
            });

            zone.addEventListener('drop', function(e) {
                e.preventDefault();
                zone.classList.remove('drag-over');
                var file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('audio/')) {
                    handleUpload(file, type, zone);
                }
            });
        }

        setupUploadZone('songsUploadAvatar', 'songsFileAvatar', 'songsPickAvatar', 'avatar');
        setupUploadZone('songsUploadProduced', 'songsFileProduced', 'songsPickProduced', 'produced');

        // ── Reset buttons ──
        // setupReset wires a double-confirm reset button.
        // onConfirm() contains the type-specific cleanup; the confirm/cancel
        // UI flow is shared across both tabs.
        function setupReset(btnId, pendingRef, onConfirm) {
            var btn = document.getElementById(btnId);
            if (!btn) return;
            btn.addEventListener('click', function() {
                if (!pendingRef.v) {
                    pendingRef.v = true;
                    btn.textContent = 'sure? click again';
                    btn.classList.add('confirming');
                    setTimeout(function() {
                        pendingRef.v = false;
                        btn.textContent = 'reset to defaults';
                        btn.classList.remove('confirming');
                    }, 3500);
                } else {
                    onConfirm();
                    pendingRef.v = false;
                    btn.textContent = 'reset to defaults';
                    btn.classList.remove('confirming');
                }
            });
        }

        setupReset('songsResetAvatar', { v: false }, function() {
            // Clear IDB entries for any local avatar tracks
            favoriteTracks.forEach(function(t) {
                if (t && t.localKey) {
                    if (aviObjectURLs[t.localKey]) { URL.revokeObjectURL(aviObjectURLs[t.localKey]); delete aviObjectURLs[t.localKey]; }
                    songDB.remove(t.localKey);
                }
            });
            favoriteTracks = aviTracksDefault ? aviTracksDefault.slice() : fallbackFavorites.slice();
            localStorage.removeItem(AVI_TRACKS_KEY);
            renderAvatarList();
        });

        setupReset('songsResetProduced', { v: false }, function() {
            // Clear IDB entries for any local produced tracks
            mcTracks.forEach(function(t) {
                if (t && t.localKey) {
                    if (mcObjectURLs[t.localKey]) { URL.revokeObjectURL(mcObjectURLs[t.localKey]); delete mcObjectURLs[t.localKey]; }
                    songDB.remove(t.localKey);
                }
            });
            mcTracks.length = 0;
            mcTracksDefault.forEach(function(t) { mcTracks.push({ title: t.title, src: t.src }); });
            localStorage.removeItem(MC_TRACKS_KEY);
            renderProducedList();
        });

    })();

    (function() {
        var keyBuffer = '';
        var cooldownActive = false;
        var COOLDOWN_MS = 3000;
        var BUFFER_MAX = 10;

        var patterns = {
            'brr': triggerBrr,
            'mp3': function() { if (typeof window._toggleMp3Panel === 'function') window._toggleMp3Panel(); },
            'songs': function() { if (typeof window._toggleSongsPanel === 'function') window._toggleSongsPanel(); }
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
