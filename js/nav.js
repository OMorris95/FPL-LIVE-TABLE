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
});
