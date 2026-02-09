// Hidden Keystroke Pattern Prototype
(function() {
    const bufferDisplay = document.getElementById('bufferDisplay');
    const statusText = document.getElementById('statusText');
    const lastTriggeredEl = document.getElementById('lastTriggered');
    const triggerCountEl = document.getElementById('triggerCount');
    const overlay = document.getElementById('easterEggOverlay');
    const avatarBox = document.querySelector('.placeholder-box');
    const easterEggArea = document.querySelector('.easter-egg-area');
    const test777Btn = document.getElementById('test777');
    const testBrrBtn = document.getElementById('testBrr');
    const resetBtn = document.getElementById('reset');

    let buffer = '';
    let triggerCount = 0;
    let lastCooldown = 0;
    const COOLDOWN_MS = 3000; // 3 seconds between triggers

    const patterns = {
        '777': trigger777,
        'brr': triggerBrr
    };

    function updateBuffer(char) {
        buffer += char.toLowerCase();

        // Keep only last 3 characters
        if (buffer.length > 3) {
            buffer = buffer.slice(-3);
        }

        bufferDisplay.textContent = buffer || '_';
    }

    function checkPatterns() {
        for (const pattern in patterns) {
            if (buffer.includes(pattern)) {
                const now = Date.now();

                // Check cooldown
                if (now - lastCooldown < COOLDOWN_MS) {
                    statusText.textContent = 'Pattern detected but on cooldown...';
                    return;
                }

                patterns[pattern](pattern);
                buffer = ''; // Clear buffer after trigger
                bufferDisplay.textContent = '_';
                lastCooldown = now;
                return;
            }
        }
    }

    function trigger777(pattern) {
        triggerCount++;
        updateStatus(pattern);

        // Option 1: Falling sevens (Matrix-style)
        createFallingSevens();

        // Option 4: Page flash
        document.body.classList.add('flashing');
        setTimeout(function() {
            document.body.classList.remove('flashing');
        }, 1050);

        // Option 2: Avatar triple spin
        if (avatarBox) {
            avatarBox.classList.add('spinning');
            setTimeout(function() {
                avatarBox.classList.remove('spinning');
            }, 1500);
        }
    }

    function triggerBrr(pattern) {
        triggerCount++;
        updateStatus(pattern);

        // Option 1: "compute go brr" text slides across
        createBrrText();

        // Option 4: Gentle shiver
        if (easterEggArea) {
            easterEggArea.classList.add('shivering');
            setTimeout(function() {
                easterEggArea.classList.remove('shivering');
            }, 800);
        }
    }

    function createFallingSevens() {
        const count = 15; // Number of falling 7s

        for (let i = 0; i < count; i++) {
            setTimeout(function() {
                const seven = document.createElement('div');
                seven.className = 'falling-seven';
                seven.textContent = '777';
                seven.style.left = Math.random() * 100 + '%';
                seven.style.animationDelay = '0s';
                seven.style.animationDuration = (2 + Math.random() * 2) + 's';

                overlay.appendChild(seven);

                // Remove after animation
                setTimeout(function() {
                    if (seven.parentNode) {
                        seven.parentNode.removeChild(seven);
                    }
                }, 4000);
            }, i * 100); // Stagger the appearance
        }
    }

    function createBrrText() {
        const brrText = document.createElement('div');
        brrText.className = 'brr-text';
        brrText.textContent = 'compute go brrrrr';

        overlay.appendChild(brrText);

        // Remove after animation
        setTimeout(function() {
            if (brrText.parentNode) {
                brrText.parentNode.removeChild(brrText);
            }
        }, 4000);
    }

    function updateStatus(pattern) {
        statusText.textContent = 'Easter egg triggered: "' + pattern + '"';
        lastTriggeredEl.textContent = pattern + ' at ' + new Date().toLocaleTimeString();
        triggerCountEl.textContent = triggerCount;
    }

    // Listen for keypress events
    document.addEventListener('keypress', function(e) {
        // Don't trigger if typing in an input/textarea
        if (e.target.tagName === 'INPUT' ||
            e.target.tagName === 'TEXTAREA' ||
            e.target.isContentEditable) {
            return;
        }

        const char = e.key;

        // Only track alphanumeric characters
        if (/^[a-z0-9]$/i.test(char)) {
            updateBuffer(char);
            checkPatterns();
        }
    });

    // Test buttons
    test777Btn.addEventListener('click', function() {
        buffer = '';
        trigger777('777');
    });

    testBrrBtn.addEventListener('click', function() {
        buffer = '';
        triggerBrr('brr');
    });

    resetBtn.addEventListener('click', function() {
        buffer = '';
        bufferDisplay.textContent = '_';
        statusText.textContent = 'Reset! Waiting for pattern...';
        lastCooldown = 0;
    });

    // Initial status
    statusText.textContent = 'Waiting for pattern... Type "777" or "brr"';
})();
