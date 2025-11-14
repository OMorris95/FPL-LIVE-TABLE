// Theme Switcher - Dark/Light Mode Toggle
// Integrated with appState.js for unified state management

(function() {
    // Wait for DOM to be ready
    function initThemeToggle() {
        const themeToggle = document.getElementById('theme-toggle');
        const themeIcon = document.getElementById('theme-icon');

        if (!themeToggle || !themeIcon) {
            console.warn('Theme toggle button not found in DOM');
            return;
        }

        // Update icon based on current theme
        function updateThemeIcon(theme) {
            themeIcon.textContent = theme === 'light' ? '🌙' : '☀️';
        }

        // Subscribe to theme changes from appState
        if (typeof appState !== 'undefined') {
            appState.subscribeToTheme((theme) => {
                updateThemeIcon(theme);
            });

            // Set initial icon
            updateThemeIcon(appState.theme);

            // Toggle theme when button is clicked
            themeToggle.addEventListener('click', function() {
                toggleTheme(); // From appState.js
            });
        } else {
            console.error('appState not found - theme toggle will not work');
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initThemeToggle);
    } else {
        initThemeToggle();
    }
})();
