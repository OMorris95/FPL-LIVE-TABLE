// Hamburger Menu Toggle
document.addEventListener('DOMContentLoaded', () => {
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const navLinks = document.getElementById('nav-links');

    if (hamburgerMenu && navLinks) {
        hamburgerMenu.addEventListener('click', () => {
            navLinks.classList.toggle('nav-open');
        });

        // Close menu when a link is clicked
        const links = navLinks.querySelectorAll('.nav-link');
        links.forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('nav-open');
            });
        });

        // Close menu when clicking outside
        document.addEventListener('click', (event) => {
            const isClickInsideNav = hamburgerMenu.contains(event.target) || navLinks.contains(event.target);
            if (!isClickInsideNav && navLinks.classList.contains('nav-open')) {
                navLinks.classList.remove('nav-open');
            }
        });
    }

    // Settings Button Handler
    const settingsBtn = document.querySelector('.nav-settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            if (typeof openSettingsModal === 'function') {
                openSettingsModal();
            } else {
                console.error('openSettingsModal function not found. Make sure settingsModal.js is loaded.');
            }
        });
    }
});
