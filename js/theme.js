// Theme Switcher - Dark/Light Mode Toggle
(function() {
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    const savedMode = localStorage.getItem('theme-mode') || 'dark';

    // Apply saved theme on page load
    applyTheme(savedMode);

    // Toggle theme when button is clicked
    themeToggle.addEventListener('click', function() {
        const currentMode = localStorage.getItem('theme-mode') || 'dark';
        const newMode = currentMode === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme-mode', newMode);
        applyTheme(newMode);
    });

    function applyTheme(mode) {
        const existingThemeLink = document.getElementById('theme-stylesheet');

        if (mode === 'light') {
            // Light mode: Load ice-light theme
            if (existingThemeLink) {
                existingThemeLink.href = 'css/themes/theme-ice-light.css';
            } else {
                const link = document.createElement('link');
                link.id = 'theme-stylesheet';
                link.rel = 'stylesheet';
                link.href = 'css/themes/theme-ice-light.css';
                document.head.appendChild(link);
            }
            themeIcon.textContent = '🌙';
        } else {
            // Dark mode: Use default fire theme (remove theme CSS)
            if (existingThemeLink) {
                existingThemeLink.remove();
            }
            themeIcon.textContent = '☀️';
        }
    }
})();
