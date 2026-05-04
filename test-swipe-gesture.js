// Swipe-up gesture detector — unit tests
// Run via: node test-swipe-gesture.js
// Or load in browser and check console.

'use strict';

// ── Module under test ────────────────────────────────────────────────────────
// Pure function extracted from the gesture handler so it can be tested
// without a DOM or touch events.
//
// Returns true when a touchmove delta represents an intentional upward swipe:
//   • deltaY (startY - currentY) must reach Y_THRESHOLD (finger moved up enough)
//   • |deltaX| must stay within X_MAX (not a sideways scroll)
//
// deltaY convention: negative = finger moved UP (clientY decreased)
function isSwipeUp(deltaY, deltaX, yThreshold, xMax) {
    return deltaY <= -yThreshold && Math.abs(deltaX) <= xMax;
}

// ── Tiny test runner ─────────────────────────────────────────────────────────
var passed = 0;
var failed = 0;

function expect(condition, description) {
    if (condition) {
        passed++;
        console.log('  ✓  ' + description);
    } else {
        failed++;
        console.error('  ✗  ' + description);
    }
}

// ── Constants matching the production values ─────────────────────────────────
var Y_THRESHOLD = 40;   // px — minimum upward travel to fire
var X_MAX       = 35;   // px — maximum horizontal drift allowed

// ── Test suite ───────────────────────────────────────────────────────────────

console.log('\nSuite: isSwipeUp — fires correctly\n');

expect(
    isSwipeUp(-40,  0, Y_THRESHOLD, X_MAX) === true,
    'exactly at Y threshold, no drift → fires'
);
expect(
    isSwipeUp(-80, 10, Y_THRESHOLD, X_MAX) === true,
    'large upward swipe, small drift → fires'
);
expect(
    isSwipeUp(-80, 35, Y_THRESHOLD, X_MAX) === true,
    'large upward swipe, drift exactly at X_MAX → fires'
);
expect(
    isSwipeUp(-80, -35, Y_THRESHOLD, X_MAX) === true,
    'large upward swipe, leftward drift exactly at X_MAX → fires'
);

console.log('\nSuite: isSwipeUp — does NOT fire\n');

expect(
    isSwipeUp(-39,  0, Y_THRESHOLD, X_MAX) === false,
    'one pixel below Y threshold → no fire'
);
expect(
    isSwipeUp(  0,  0, Y_THRESHOLD, X_MAX) === false,
    'no movement at all → no fire'
);
expect(
    isSwipeUp( 50,  0, Y_THRESHOLD, X_MAX) === false,
    'downward swipe (positive deltaY) → no fire'
);
expect(
    isSwipeUp(-80, 36, Y_THRESHOLD, X_MAX) === false,
    'upward swipe but one pixel over X_MAX drift → no fire'
);
expect(
    isSwipeUp(-80, -36, Y_THRESHOLD, X_MAX) === false,
    'upward swipe but leftward drift one pixel over X_MAX → no fire'
);
expect(
    isSwipeUp(-80, 100, Y_THRESHOLD, X_MAX) === false,
    'upward swipe but large horizontal drift (sideways scroll) → no fire'
);
expect(
    isSwipeUp( 80, 0, Y_THRESHOLD, X_MAX) === false,
    'swipe-down gesture → no fire'
);

console.log('\nSuite: fires at most once per gesture\n');

// Simulates touchstart → multiple touchmove events → touchend
(function() {
    var fired = 0;
    var startX = 200, startY = 400;
    var swipeFired = false;

    function simulateMove(currentX, currentY) {
        var deltaY = currentY - startY;
        var deltaX = currentX - startX;
        if (!swipeFired && isSwipeUp(deltaY, deltaX, Y_THRESHOLD, X_MAX)) {
            swipeFired = true;
            fired++;
        }
    }

    // Simulate finger moving up 10px at a time
    simulateMove(200, 390); // -10px — below threshold
    simulateMove(200, 380); // -20px — below threshold
    simulateMove(200, 370); // -30px — below threshold
    simulateMove(200, 360); // -40px — AT threshold, fires
    simulateMove(200, 350); // -50px — already fired, skipped
    simulateMove(200, 340); // -60px — already fired, skipped

    // Reset on touchend
    swipeFired = false;

    // Second gesture fires again
    simulateMove(200, 360); // -40px — fires again after reset
    simulateMove(200, 350); // already fired

    expect(fired === 2, 'fires exactly once per gesture across two gestures (total: ' + fired + ')');
})();

console.log('\nSuite: does not interfere with tap (play/pause)\n');

(function() {
    // A tap: touchstart → touchend with < 10px total movement
    var startX = 200, startY = 400;
    var swipeFired = false;
    var tapFired = false;

    function simulateEnd(endX, endY) {
        var totalMove = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        if (!swipeFired && totalMove < 10) tapFired = true;
    }

    simulateEnd(202, 401); // 2.2px movement — tap
    expect(tapFired === true && swipeFired === false, 'small movement → tap fires, swipe does not');

    tapFired = false;
    // Simulate a swipe: swipeFired gets set before touchend
    swipeFired = isSwipeUp(-400 - 40 - 400, 0, Y_THRESHOLD, X_MAX); // deltaY = -40, fires
    // Actually simulate correctly:
    swipeFired = false;
    var swipeDetected = isSwipeUp(-45, 5, Y_THRESHOLD, X_MAX);
    if (swipeDetected) swipeFired = true;
    simulateEnd(205, 355); // moved ~45px but swipe already handled it
    expect(swipeFired === true && tapFired === false, 'swipe movement → swipe fires, tap does not');
})();

// ── Summary ──────────────────────────────────────────────────────────────────
console.log('\n─────────────────────────────────────────────');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
if (failed === 0) {
    console.log('All tests passed ✓');
} else {
    console.error(failed + ' test(s) FAILED');
    if (typeof process !== 'undefined') process.exit(1);
}

// Export for Node.js
if (typeof module !== 'undefined') module.exports = { isSwipeUp };
