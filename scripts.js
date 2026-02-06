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

    const defaultSrc = 'assets/songs/Clairo Juna Live Ending.mp3';
    const hourlySources = {
        // Example: 19: 'assets/songs/Your-7pm-Track.mp3',
    };

    const specialRange = {
        startHour: 19, // 7pm
        endHour: 20,   // 8pm
        src: 'assets/songs/My Search Is Over.mp3',
    };

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
        if (hour >= specialRange.startHour && hour < specialRange.endHour) {
            return specialRange.src;
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
        if (audio.paused) {
            audio.play();
        } else {
            audio.pause();
        }
    });
});
