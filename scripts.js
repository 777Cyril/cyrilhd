// Dark mode logic - switches at 7pm/7am
function updateDarkMode() {
    const hour = new Date().getHours();
    const isDarkTime = hour >= 19 || hour < 7; // 7pm (19:00) to 7am

    if (isDarkTime) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
}

// Check on page load
updateDarkMode();

// Check every minute for seamless transitions
setInterval(updateDarkMode, 60000);
