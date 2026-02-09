// Song Carousel Prototype
(function() {
    const carousel = document.getElementById('songCarousel');
    const track = document.getElementById('carouselTrack');
    const songName = document.getElementById('songName');
    const playBtn = document.getElementById('playBtn');
    const stopBtn = document.getElementById('stopBtn');
    const songSelector = document.getElementById('songSelector');
    const speedSlider = document.getElementById('speedSlider');
    const speedValue = document.getElementById('speedValue');
    const widthSlider = document.getElementById('widthSlider');
    const widthValue = document.getElementById('widthValue');

    let isPlaying = false;

    function startCarousel(song) {
        songName.textContent = song || 'get it together';
        carousel.classList.add('active');
        track.classList.add('animating');
        isPlaying = true;
    }

    function stopCarousel() {
        carousel.classList.remove('active');
        track.classList.remove('animating');
        isPlaying = false;
    }

    function updateSpeed(seconds) {
        track.style.animationDuration = seconds + 's';
        speedValue.textContent = seconds + 's';
    }

    function updateWidth(pixels) {
        carousel.style.width = pixels + 'px';
        widthValue.textContent = pixels + 'px';
    }

    // Event listeners
    playBtn.addEventListener('click', function() {
        const selectedSong = songSelector.value;
        if (isPlaying) {
            stopCarousel();
            setTimeout(function() {
                startCarousel(selectedSong);
            }, 100);
        } else {
            startCarousel(selectedSong);
        }
    });

    stopBtn.addEventListener('click', stopCarousel);

    speedSlider.addEventListener('input', function() {
        updateSpeed(this.value);
    });

    widthSlider.addEventListener('input', function() {
        updateWidth(this.value);
    });

    // Auto-start demo
    setTimeout(function() {
        startCarousel('get it together');
    }, 500);
})();
