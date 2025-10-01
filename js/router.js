// Simple Client-Side Router
// Handles navigation between different pages/views
// Supports both hash-based routing (for file://) and pushState (for http/https)

class Router {
    constructor() {
        this.routes = {};
        this.currentRoute = null;
        this.currentLeagueId = null;

        // Detect if running locally (file://) or on a server (http/https)
        this.isLocalFile = window.location.protocol === 'file:';
        this.useHashRouting = this.isLocalFile;

        if (this.useHashRouting) {
            console.log('Router: Using hash-based routing (local file mode)');
            // Listen for hash changes
            window.addEventListener('hashchange', () => {
                this.handleHashChange();
            });
        } else {
            console.log('Router: Using pushState routing (server mode)');
            // Listen for back/forward button
            window.addEventListener('popstate', (e) => {
                this.loadRoute(window.location.pathname, e.state?.leagueId);
            });
        }

        // Handle link clicks
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-link]')) {
                e.preventDefault();
                this.navigate(e.target.getAttribute('href'));
            }
        });
    }

    /**
     * Register a route
     * @param {string} path - Route path
     * @param {function} handler - Function to handle the route
     */
    addRoute(path, handler) {
        this.routes[path] = handler;
    }

    /**
     * Navigate to a route
     * @param {string} path - Path to navigate to
     * @param {object} state - State object to pass
     */
    navigate(path, state = {}) {
        if (this.useHashRouting) {
            // Use hash-based routing for local files
            const leagueParam = state.leagueId ? `?league=${state.leagueId}` : '';
            window.location.hash = `#${path}${leagueParam}`;
        } else {
            // Use pushState for servers
            window.history.pushState(state, '', path);
            this.loadRoute(path, state.leagueId);
        }
    }

    /**
     * Handle hash change (for local file mode)
     */
    handleHashChange() {
        const hash = window.location.hash.slice(1); // Remove #
        const [path, search] = hash.split('?');
        const params = new URLSearchParams(search);
        const leagueId = params.get('league');

        this.loadRoute(path || '/', leagueId);
    }

    /**
     * Load a route
     * @param {string} path - Path to load
     * @param {string} leagueId - League ID if applicable
     */
    async loadRoute(path, leagueId = null) {
        // Extract base path (remove query params)
        const basePath = path.split('?')[0];

        // Store league ID if provided
        if (leagueId) {
            this.currentLeagueId = leagueId;
        }

        // Update active nav link
        this.updateActiveNavLink(basePath);

        // Find matching route
        const handler = this.routes[basePath] || this.routes['/'];

        if (handler) {
            this.currentRoute = basePath;
            await handler(leagueId || this.currentLeagueId);
        }
    }

    /**
     * Update active navigation link styling
     * @param {string} path - Current path
     */
    updateActiveNavLink(path) {
        // Remove active class from all links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });

        // Add active class to current link
        const activeLink = document.querySelector(`.nav-link[href="${path}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
    }

    /**
     * Get current league ID
     * @returns {string|null} - Current league ID
     */
    getLeagueId() {
        return this.currentLeagueId;
    }

    /**
     * Set current league ID
     * @param {string} leagueId - League ID
     */
    setLeagueId(leagueId) {
        this.currentLeagueId = leagueId;
        // Persist to localStorage
        if (leagueId) {
            localStorage.setItem('fpl_league_id', leagueId);
        }
    }

    /**
     * Initialize router with current path
     */
    init() {
        // Try to restore league ID from localStorage
        const storedLeagueId = localStorage.getItem('fpl_league_id');
        if (storedLeagueId) {
            this.currentLeagueId = storedLeagueId;
        }

        if (this.useHashRouting) {
            // Hash-based routing
            if (window.location.hash) {
                this.handleHashChange();
            } else {
                // No hash, load home page
                this.loadRoute('/', null);
            }
        } else {
            // pushState routing
            const params = new URLSearchParams(window.location.search);
            const leagueId = params.get('league');

            if (leagueId) {
                this.currentLeagueId = leagueId;
                localStorage.setItem('fpl_league_id', leagueId);
            }

            this.loadRoute(window.location.pathname, leagueId);
        }
    }
}

// Create global router instance
const router = new Router();
