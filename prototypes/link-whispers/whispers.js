// Link Preview Whispers Prototype
(function() {
    const previewCard = document.getElementById('linkPreview');
    const previewType = document.getElementById('previewType');
    const previewTitle = document.getElementById('previewTitle');
    const previewDesc = document.getElementById('previewDesc');
    const enableToggle = document.getElementById('enablePreviews');
    const delaySlider = document.getElementById('delaySlider');
    const delayValue = document.getElementById('delayValue');
    const positionSelect = document.getElementById('positionSelect');

    let hoverDelay = 500; // ms
    let hoverTimeout = null;
    let currentLink = null;
    let enabled = true;
    let slideDirection = 'right';

    // Find all links with preview data
    const links = document.querySelectorAll('a[data-preview-title]');

    function showPreview(link, event) {
        if (!enabled) return;

        const title = link.getAttribute('data-preview-title');
        const desc = link.getAttribute('data-preview-desc');
        const type = link.getAttribute('data-preview-type') || 'link';

        if (!title) return;

        // Update preview content
        previewType.textContent = type;
        previewTitle.textContent = title;
        previewDesc.textContent = desc || '';

        // Position preview near the link
        positionPreview(link, event);

        // Apply slide direction class
        previewCard.className = 'link-preview from-' + slideDirection;

        // Show with delay
        hoverTimeout = setTimeout(function() {
            previewCard.classList.add('visible');
        }, 50);

        currentLink = link;
    }

    function hidePreview() {
        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
        }
        previewCard.classList.remove('visible');
        currentLink = null;
    }

    function positionPreview(link, event) {
        const linkRect = link.getBoundingClientRect();
        const previewRect = previewCard.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let top, left;

        switch(slideDirection) {
            case 'right':
                // Position to the right of the link
                left = linkRect.right + 15;
                top = linkRect.top + (linkRect.height / 2) - (previewRect.height / 2);

                // Keep within viewport
                if (left + previewRect.width > viewportWidth) {
                    left = linkRect.left - previewRect.width - 15;
                }
                break;

            case 'left':
                // Position to the left of the link
                left = linkRect.left - previewRect.width - 15;
                top = linkRect.top + (linkRect.height / 2) - (previewRect.height / 2);

                // Keep within viewport
                if (left < 0) {
                    left = linkRect.right + 15;
                }
                break;

            case 'top':
                // Position above the link
                top = linkRect.top - previewRect.height - 10;
                left = linkRect.left + (linkRect.width / 2) - (previewRect.width / 2);

                // Keep within viewport
                if (top < 0) {
                    top = linkRect.bottom + 10;
                }
                break;

            case 'bottom':
                // Position below the link
                top = linkRect.bottom + 10;
                left = linkRect.left + (linkRect.width / 2) - (previewRect.width / 2);

                // Keep within viewport
                if (top + previewRect.height > viewportHeight) {
                    top = linkRect.top - previewRect.height - 10;
                }
                break;
        }

        // Ensure preview stays within viewport horizontally
        if (left < 10) left = 10;
        if (left + previewRect.width > viewportWidth - 10) {
            left = viewportWidth - previewRect.width - 10;
        }

        // Ensure preview stays within viewport vertically
        if (top < 10) top = 10;
        if (top + previewRect.height > viewportHeight - 10) {
            top = viewportHeight - previewRect.height - 10;
        }

        previewCard.style.top = top + 'px';
        previewCard.style.left = left + 'px';
    }

    // Attach hover listeners to all links with preview data
    links.forEach(function(link) {
        link.addEventListener('mouseenter', function(e) {
            if (hoverTimeout) {
                clearTimeout(hoverTimeout);
            }
            hoverTimeout = setTimeout(function() {
                showPreview(link, e);
            }, hoverDelay);
        });

        link.addEventListener('mouseleave', function() {
            hidePreview();
        });

        // Update position on mouse move (for better positioning)
        link.addEventListener('mousemove', function(e) {
            if (currentLink === link && previewCard.classList.contains('visible')) {
                positionPreview(link, e);
            }
        });
    });

    // Configuration controls
    enableToggle.addEventListener('change', function() {
        enabled = this.checked;
        if (!enabled) {
            hidePreview();
        }
    });

    delaySlider.addEventListener('input', function() {
        hoverDelay = parseInt(this.value, 10);
        delayValue.textContent = hoverDelay + 'ms';
    });

    positionSelect.addEventListener('change', function() {
        slideDirection = this.value;
    });

    // Hide preview on scroll
    window.addEventListener('scroll', hidePreview);
})();
