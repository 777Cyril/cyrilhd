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

    const defaultSrc = 'assets/songs/Clairo Juna Live Ending.mp3';
    const hourlySources = {
        // Example: 19: 'assets/songs/Your-7pm-Track.mp3',
    };

    const specialRanges = [
        {
            startHour: 18, // 6pm
            endHour: 19,   // 7pm
            src: 'assets/songs/Taliban Music.mp3',
        },
        {
            startHour: 16, // 4pm
            endHour: 17,   // 5pm
            src: 'assets/songs/Swapa - Meeting God.mp3',
        },
        {
            startHour: 14, // 2pm
            endHour: 15,   // 3pm
            src: 'assets/songs/muimui.mp3',
        },
        {
            startHour: 17, // 5pm
            endHour: 18,   // 6pm
            src: 'assets/songs/Playboi Carti - Place.mp3',
        },
        {
            startHour: 20, // 8pm
            endHour: 21,   // 9pm
            src: "assets/songs/Pz' - Havana  (prod. rue.de.sevres).mp3",
        },
        {
            startHour: 19, // 7pm
            endHour: 20,   // 8pm
            src: 'assets/songs/Hiatus Kaiyote Building A Ladder Live.mp3',
        },
        {
            startHour: 22, // 10pm
            endHour: 23,   // 11pm
            src: 'assets/songs/Long Time (Intro).mp3',
        },
        {
            startHour: 23, // 11pm
            endHour: 24,   // midnight
            src: 'assets/songs/old habits - swapa.mp3',
        },
        {
            startHour: 1, // 1am
            endHour: 2,   // 2am
            src: 'assets/songs/old habits - swapa.mp3',
        },
        {
            startHour: 4, // 4am
            endHour: 5,   // 5am
            src: 'assets/songs/use to care - swapa.mp3',
        },
    ];

    const timeZone = 'America/New_York';

    function getHourInTimeZone() {
        const parts = new Intl.DateTimeFormat('en-US', {
            hour: '2-digit',
            hour12: false,
            timeZone,
        }).formatToParts(new Date());
        const hourPart = parts.find(function(p) { return p.type === 'hour'; });
        return hourPart ? parseInt(hourPart.value, 10) : new Date().getHours();
    }

    function getHourlySource() {
        const hour = getHourInTimeZone();
        for (let i = 0; i < specialRanges.length; i += 1) {
            const range = specialRanges[i];
            if (hour >= range.startHour && hour < range.endHour) {
                return range.src;
            }
        }
        return hourlySources[hour] || defaultSrc;
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

    updateAudioSourceIfNeeded();
    setInterval(updateAudioSourceIfNeeded, 60000);

    avi.addEventListener('click', function() {
        triggerTapFlash();
        if (audio.paused) {
            audio.play();
        } else {
            audio.pause();
        }
    });
});
