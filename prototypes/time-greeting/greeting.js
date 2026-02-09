// Time-of-Day Greeting Prototype
(function() {
    const greetingContainer = document.getElementById('timeGreeting');
    const greetingTextEl = document.getElementById('greetingText');
    const statusText = document.getElementById('statusText');
    const lastShownEl = document.getElementById('lastShown');
    const timeUntilEl = document.getElementById('timeUntil');
    const testBtn = document.getElementById('testBtn');
    const resetBtn = document.getElementById('resetBtn');
    const simulateRefreshBtn = document.getElementById('simulateRefresh');
    const timeSelector = document.getElementById('timeSelector');

    const STORAGE_KEY = 'lastGreetingShown';
    const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
    let typewriterTimeout = null;
    let fadeTimeout = null;

    function getTimeOfDay(hour) {
        if (hour >= 5 && hour < 12) return 'morning';
        if (hour >= 12 && hour < 18) return 'afternoon';
        if (hour >= 18 && hour < 22) return 'evening';
        return 'night';
    }

    function getGreetingText(timeOfDay) {
        const greetings = {
            morning: 'good morning',
            afternoon: 'good afternoon',
            evening: 'good evening',
            night: 'burning the midnight oil'
        };
        return greetings[timeOfDay] || 'hello';
    }

    function typewriter(text, onComplete) {
        if (typewriterTimeout) {
            clearTimeout(typewriterTimeout);
        }

        greetingTextEl.textContent = '';
        greetingTextEl.classList.add('typing');
        let charIndex = 0;

        function typeNext() {
            if (charIndex < text.length) {
                greetingTextEl.textContent = text.substring(0, charIndex + 1);
                charIndex++;
                typewriterTimeout = setTimeout(typeNext, 35); // Same speed as music player
            } else {
                greetingTextEl.classList.remove('typing');
                if (onComplete) onComplete();
            }
        }

        // Start after a short delay
        typewriterTimeout = setTimeout(typeNext, 400);
    }

    function showGreeting(forceShow, customTimeOfDay) {
        const now = Date.now();
        const lastShown = localStorage.getItem(STORAGE_KEY);

        // Check if we should show the greeting
        if (!forceShow && lastShown) {
            const timeSinceLastShown = now - parseInt(lastShown, 10);
            if (timeSinceLastShown < COOLDOWN_MS) {
                statusText.textContent = 'Skipped (shown recently)';
                updateStatus();
                return false;
            }
        }

        // Determine greeting based on time
        const hour = new Date().getHours();
        const timeOfDay = customTimeOfDay || getTimeOfDay(hour);
        const greetingText = getGreetingText(timeOfDay);

        // Show with typewriter effect
        greetingContainer.classList.add('visible');
        greetingContainer.classList.remove('fade-out');

        typewriter(greetingText, function() {
            // Fade out after 3 seconds
            fadeTimeout = setTimeout(function() {
                greetingContainer.classList.add('fade-out');
            }, 3000);
        });

        // Store timestamp
        localStorage.setItem(STORAGE_KEY, now.toString());
        statusText.textContent = 'Shown successfully!';
        updateStatus();
        return true;
    }

    function updateStatus() {
        const lastShown = localStorage.getItem(STORAGE_KEY);

        if (lastShown) {
            const date = new Date(parseInt(lastShown, 10));
            lastShownEl.textContent = date.toLocaleTimeString();

            const now = Date.now();
            const timeSinceLastShown = now - parseInt(lastShown, 10);
            const timeUntilNext = COOLDOWN_MS - timeSinceLastShown;

            if (timeUntilNext > 0) {
                const minutes = Math.ceil(timeUntilNext / 60000);
                timeUntilEl.textContent = minutes + ' minute' + (minutes !== 1 ? 's' : '');
            } else {
                timeUntilEl.textContent = 'Ready to show!';
            }
        } else {
            lastShownEl.textContent = 'Never';
            timeUntilEl.textContent = 'Ready to show!';
        }
    }

    function simulatePageLoad() {
        greetingContainer.classList.remove('visible', 'fade-out');
        greetingTextEl.textContent = '';
        greetingTextEl.classList.remove('typing');

        if (typewriterTimeout) clearTimeout(typewriterTimeout);
        if (fadeTimeout) clearTimeout(fadeTimeout);

        statusText.textContent = 'Simulating page load...';

        setTimeout(function() {
            showGreeting(false);
        }, 300);
    }

    // Event listeners
    testBtn.addEventListener('click', function() {
        const customTime = timeSelector.value;
        showGreeting(true, customTime);
    });

    resetBtn.addEventListener('click', function() {
        localStorage.removeItem(STORAGE_KEY);
        statusText.textContent = 'Session cleared!';
        updateStatus();
        greetingContainer.classList.remove('visible', 'fade-out');
        greetingTextEl.textContent = '';
    });

    simulateRefreshBtn.addEventListener('click', simulatePageLoad);

    // Update status every second
    setInterval(updateStatus, 1000);

    // Initial page load behavior
    updateStatus();
    setTimeout(function() {
        showGreeting(false);
    }, 500);
})();
