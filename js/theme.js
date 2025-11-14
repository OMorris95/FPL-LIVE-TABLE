// Theme Switcher - Dark/Light Mode Toggle
// Integrated with appState.js for unified state management

(function() {
    // Wait for DOM to be ready
    function initThemeToggle() {
        const themeToggle = document.getElementById('theme-toggle');
        const themeIcon = document.getElementById('theme-icon');
        const themeToggleNav = document.getElementById('theme-toggle-nav');
        const themeIconNav = document.getElementById('theme-icon-nav');

        // Update icon based on current theme
        function updateThemeIcon(theme) {
            const icon = theme === 'light' ? '🌙' : '☀️';
            if (themeIcon) themeIcon.textContent = icon;
            if (themeIconNav) themeIconNav.textContent = icon;
        }

        // Subscribe to theme changes from appState
        if (typeof appState !== 'undefined') {
            appState.subscribeToTheme((theme) => {
                updateThemeIcon(theme);
            });

            // Set initial icon
            updateThemeIcon(appState.theme);

            // Toggle theme when button is clicked
            if (themeToggle) {
                themeToggle.addEventListener('click', function() {
                    toggleTheme(); // From appState.js
                });
            }

            // Toggle theme when nav button is clicked
            if (themeToggleNav) {
                themeToggleNav.addEventListener('click', function() {
                    toggleTheme(); // From appState.js
                });
            }
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
