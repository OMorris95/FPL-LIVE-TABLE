// Application State Management
// Simple reactive state manager for global app state

// ============================================
// APP STATE
// ============================================

const appState = {
    // ===== UI State =====
    theme: localStorage.getItem('theme') || 'light', // 'light' or 'dark'

    // ===== Filter State =====
    // These control what data is shown in charts
    timeframe: 'season',  // 'season', 'last5', 'last10'
    selectedPlayer: null,  // { id, name, team } or null
    selectedTeam: null,    // { id, name } or null
    selectedManager: null, // { id, name } or null

    // ===== Data State =====
    // Current gameweek and league info
    currentGameweek: null,
    leagueId: null,

    // ===== Subscribers =====
    _listeners: new Set(),
    _themeListeners: new Set(),

    /**
     * Updates state and notifies all subscribers
     * @param {object} changes - Object with state changes
     */
    update(changes) {
        // Check if theme is changing
        const themeChanging = 'theme' in changes && changes.theme !== this.theme;

        // Apply changes
        Object.assign(this, changes);

        // Save theme to localStorage if it changed
        if (themeChanging) {
            localStorage.setItem('theme', this.theme);
            this._notifyThemeListeners();
        }

        // Notify regular listeners
        this._notifyListeners();
    },

    /**
     * Subscribes to state changes
     * @param {function} callback - Function to call on state change
     * @returns {function} - Unsubscribe function
     */
    subscribe(callback) {
        this._listeners.add(callback);
        return () => this._listeners.delete(callback);
    },

    /**
     * Subscribes specifically to theme changes
     * @param {function} callback - Function to call on theme change
     * @returns {function} - Unsubscribe function
     */
    subscribeToTheme(callback) {
        this._themeListeners.add(callback);
        return () => this._themeListeners.delete(callback);
    },

    /**
     * Notifies all state listeners
     * @private
     */
    _notifyListeners() {
        this._listeners.forEach(fn => {
            try {
                fn(this);
            } catch (error) {
                console.error('Error in state listener:', error);
            }
        });
    },

    /**
     * Notifies all theme listeners
     * @private
     */
    _notifyThemeListeners() {
        this._themeListeners.forEach(fn => {
            try {
                fn(this.theme);
            } catch (error) {
                console.error('Error in theme listener:', error);
            }
        });
    },

    /**
     * Resets filters to default
     */
    resetFilters() {
        this.update({
            timeframe: 'season',
            selectedPlayer: null,
            selectedTeam: null,
            selectedManager: null
        });
    },

    /**
     * Gets a snapshot of current state
     * @returns {object} - Current state (without private properties)
     */
    getSnapshot() {
        return {
            theme: this.theme,
            timeframe: this.timeframe,
            selectedPlayer: this.selectedPlayer,
            selectedTeam: this.selectedTeam,
            selectedManager: this.selectedManager,
            currentGameweek: this.currentGameweek,
            leagueId: this.leagueId
        };
    }
};

// ============================================
// THEME HELPERS
// ============================================

/**
 * Toggles between light and dark theme
 */
function toggleTheme() {
    const newTheme = appState.theme === 'dark' ? 'light' : 'dark';
    appState.update({ theme: newTheme });
    applyTheme(newTheme);
}

/**
 * Applies theme to document
 * @param {string} theme - 'light' or 'dark'
 */
function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark-theme');
        document.documentElement.classList.remove('light-theme');
    } else {
        document.documentElement.classList.add('light-theme');
        document.documentElement.classList.remove('dark-theme');
    }

    // Update charts for new theme if chartFactory is loaded
    if (typeof updateChartsForTheme === 'function') {
        updateChartsForTheme();
    }
}

/**
 * Initializes theme from localStorage
 */
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    appState.update({ theme: savedTheme });
    applyTheme(savedTheme);
}

// Initialize theme on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
} else {
    initTheme();
}

// ============================================
// TIMEFRAME HELPERS
// ============================================

/**
 * Gets number of gameweeks for current timeframe
 * @returns {number|null} - Number of gameweeks, or null for 'season'
 */
function getTimeframeLength() {
    switch (appState.timeframe) {
        case 'last5':
            return 5;
        case 'last10':
            return 10;
        case 'season':
        default:
            return null; // All gameweeks
    }
}

/**
 * Gets display name for current timeframe
 * @returns {string} - Human-readable timeframe name
 */
function getTimeframeName() {
    switch (appState.timeframe) {
        case 'last5':
            return 'Last 5 Gameweeks';
        case 'last10':
            return 'Last 10 Gameweeks';
        case 'season':
        default:
            return 'Full Season';
    }
}

// ============================================
// DEBUGGING
// ============================================

/**
 * Logs current state (for debugging)
 */
function logState() {
    console.log('=== App State ===');
    console.log('Theme:', appState.theme);
    console.log('Timeframe:', appState.timeframe);
    console.log('Selected Player:', appState.selectedPlayer);
    console.log('Selected Team:', appState.selectedTeam);
    console.log('Selected Manager:', appState.selectedManager);
    console.log('Current Gameweek:', appState.currentGameweek);
    console.log('League ID:', appState.leagueId);
    console.log('Listeners:', appState._listeners.size);
    console.log('Theme Listeners:', appState._themeListeners.size);
}

// Expose logState to console for debugging
window.logAppState = logState;

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        appState,
        toggleTheme,
        applyTheme,
        initTheme,
        getTimeframeLength,
        getTimeframeName,
        logState
    };
}
