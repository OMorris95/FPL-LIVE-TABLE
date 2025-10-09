// FPL API Helper Functions
// Shared utilities for making API calls to the Fantasy Premier League API

const CORS_PROXY = 'https://corsproxy.io/?';
const API_BASE_URL = `${CORS_PROXY}https://fantasy.premierleague.com/api/`;

// ============================================
// CACHE SYSTEM
// ============================================

const CACHE_VERSION = '1.0';
const CACHE_PREFIX = 'fpl_cache_';

/**
 * Gets the full cached entry from sessionStorage (including metadata)
 * @param {string} key - Cache key
 * @returns {object|null} - Full cache entry or null if expired/missing
 */
function getCachedEntry(key) {
    try {
        const cacheKey = CACHE_PREFIX + key;
        const cached = sessionStorage.getItem(cacheKey);

        if (!cached) return null;

        const cacheEntry = JSON.parse(cached);

        // Invalidate if version changed
        if (cacheEntry.version !== CACHE_VERSION) {
            sessionStorage.removeItem(cacheKey);
            return null;
        }

        // Check if expired
        if (Date.now() > cacheEntry.expiresAt) {
            sessionStorage.removeItem(cacheKey);
            return null;
        }

        return cacheEntry;
    } catch (error) {
        console.error('Cache read error:', error);
        return null;
    }
}

/**
 * Gets cached data from sessionStorage if not expired
 * @param {string} key - Cache key
 * @returns {object|null} - Cached data or null if expired/missing
 */
function getCachedData(key) {
    const cacheEntry = getCachedEntry(key);

    if (!cacheEntry) return null;

    console.log(`✅ Cache HIT: ${key}`);
    return cacheEntry.data;
}

/**
 * Stores data in cache with expiry time
 * @param {string} key - Cache key
 * @param {object} data - Data to cache
 * @param {number} expiresInMs - Milliseconds until expiry
 */
function setCachedData(key, data, expiresInMs) {
    setCachedDataWithDeadline(key, data, expiresInMs, null);
}

/**
 * Stores data in cache with expiry time and optional deadline metadata
 * @param {string} key - Cache key
 * @param {object} data - Data to cache
 * @param {number} expiresInMs - Milliseconds until expiry
 * @param {string|null} nextDeadline - ISO timestamp of next deadline (for bootstrap data)
 */
function setCachedDataWithDeadline(key, data, expiresInMs, nextDeadline = null) {
    try {
        const cacheKey = CACHE_PREFIX + key;
        const cacheEntry = {
            data,
            timestamp: Date.now(),
            expiresAt: Date.now() + expiresInMs,
            version: CACHE_VERSION,
            nextDeadline,
            lastRefreshAttempt: null
        };

        sessionStorage.setItem(cacheKey, JSON.stringify(cacheEntry));

        const durationStr = expiresInMs >= CACHE_DURATIONS.DAY
            ? `${Math.floor(expiresInMs / CACHE_DURATIONS.DAY)}d`
            : expiresInMs >= CACHE_DURATIONS.HOUR
            ? `${Math.floor(expiresInMs / CACHE_DURATIONS.HOUR)}h`
            : expiresInMs >= CACHE_DURATIONS.MINUTE
            ? `${Math.floor(expiresInMs / CACHE_DURATIONS.MINUTE)}m`
            : `${Math.floor(expiresInMs / 1000)}s`;

        console.log(`💾 Cached ${key} for ${durationStr}${nextDeadline ? ` (deadline: ${nextDeadline})` : ''}`);
    } catch (error) {
        console.error('Cache write error:', error);
        // If storage is full, clear old caches and try again
        if (error.name === 'QuotaExceededError') {
            clearOldCaches();
            try {
                sessionStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
            } catch (e) {
                console.error('Cache write failed even after cleanup:', e);
            }
        }
    }
}

/**
 * Clears specific cache entry
 * @param {string} key - Cache key to clear
 */
function clearCache(key) {
    sessionStorage.removeItem(CACHE_PREFIX + key);
}

/**
 * Clears all FPL caches
 */
function clearAllCaches() {
    const keys = Object.keys(sessionStorage);
    keys.forEach(key => {
        if (key.startsWith(CACHE_PREFIX)) {
            sessionStorage.removeItem(key);
        }
    });
    console.log('All FPL caches cleared');
}

/**
 * Updates the last refresh attempt timestamp for a cache entry
 * @param {string} key - Cache key
 */
function updateLastRefreshAttempt(key) {
    try {
        const cacheEntry = getCachedEntry(key);
        if (!cacheEntry) return;

        cacheEntry.lastRefreshAttempt = Date.now();

        const cacheKey = CACHE_PREFIX + key;
        sessionStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
    } catch (error) {
        console.error('Error updating refresh attempt:', error);
    }
}

/**
 * Checks if data is cached and valid (without retrieving it)
 * @param {string} key - Cache key
 * @returns {boolean} - True if data is cached and not expired
 */
function isCached(key) {
    try {
        const cacheKey = CACHE_PREFIX + key;
        const cached = sessionStorage.getItem(cacheKey);

        if (!cached) return false;

        const cacheEntry = JSON.parse(cached);

        // Check version and expiry
        if (cacheEntry.version !== CACHE_VERSION) return false;
        if (Date.now() > cacheEntry.expiresAt) return false;

        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Checks if we should attempt to refresh bootstrap data
 * @param {object} cacheEntry - Full cache entry with metadata
 * @returns {boolean} - True if we should try refreshing
 */
function shouldRefreshBootstrap(cacheEntry) {
    if (!cacheEntry || !cacheEntry.nextDeadline) return false;

    const now = Date.now();
    const deadlineTime = new Date(cacheEntry.nextDeadline).getTime();

    // Has deadline passed?
    if (now <= deadlineTime) return false;

    // Have we tried refreshing in the last 15 minutes?
    const lastAttempt = cacheEntry.lastRefreshAttempt;
    if (lastAttempt && (now - lastAttempt) < REFRESH_RETRY_INTERVAL) {
        return false; // Too soon, wait 15 minutes between attempts
    }

    return true;
}

/**
 * Clears expired caches
 */
function clearOldCaches() {
    const keys = Object.keys(sessionStorage);
    const now = Date.now();

    keys.forEach(key => {
        if (key.startsWith(CACHE_PREFIX)) {
            try {
                const cached = JSON.parse(sessionStorage.getItem(key));
                if (cached.expiresAt < now) {
                    sessionStorage.removeItem(key);
                }
            } catch (e) {
                // Invalid cache entry, remove it
                sessionStorage.removeItem(key);
            }
        }
    });
}

/**
 * Checks if a gameweek is currently active (matches being played)
 * @param {object} bootstrapData - Bootstrap data
 * @returns {boolean} - True if gameweek is active
 */
function isGameweekActive(bootstrapData) {
    const currentEvent = bootstrapData.events.find(event => event.is_current);
    return !!currentEvent;
}

/**
 * Gets the current gameweek from bootstrap data
 * @param {object} bootstrapData - Bootstrap data
 * @returns {number|null} - Current gameweek ID
 */
function getCurrentGameweekFromBootstrap(bootstrapData) {
    const currentEvent = bootstrapData.events.find(event => event.is_current);
    if (currentEvent) return currentEvent.id;

    const nextEvent = bootstrapData.events.find(event => event.is_next);
    return nextEvent ? nextEvent.id : null;
}

// Cache duration constants (in milliseconds)
const CACHE_DURATIONS = {
    FOREVER: 365 * 24 * 60 * 60 * 1000,  // 1 year (effectively forever)
    WEEK: 7 * 24 * 60 * 60 * 1000,        // 7 days
    DAY: 24 * 60 * 60 * 1000,             // 24 hours
    HOUR: 60 * 60 * 1000,                 // 1 hour
    MINUTE: 60 * 1000                     // 60 seconds
};

const REFRESH_RETRY_INTERVAL = 15 * 60 * 1000; // 15 minutes between refresh attempts

/**
 * Gets the next gameweek deadline from bootstrap data
 * @param {object} bootstrapData - Bootstrap data
 * @returns {string|null} - ISO timestamp of next deadline or null
 */
function getNextDeadline(bootstrapData) {
    if (!bootstrapData || !bootstrapData.events) return null;

    // Find next or current event
    const upcomingEvent = bootstrapData.events.find(event => event.is_next || event.is_current);

    return upcomingEvent ? upcomingEvent.deadline_time : null;
}

// ============================================
// API FETCH FUNCTIONS
// ============================================

/**
 * Fetches data from a given URL and handles errors.
 * @param {string} url - The URL to fetch data from.
 * @returns {Promise<object|null>} - The JSON response or null if an error occurred.
 */
async function fetchData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("Failed to fetch data:", error);
        throw error;
    }
}

/**
 * Fetches bootstrap-static data with deadline-aware caching
 * - Caches for 24 hours normally
 * - Automatically refreshes after gameweek deadline passes
 * - Retries every 15 minutes if FPL hasn't updated yet
 * @returns {Promise<object>} - Bootstrap data
 */
async function getBootstrapData() {
    const cacheKey = 'bootstrap';
    const cacheEntry = getCachedEntry(cacheKey);

    // If we have cached data
    if (cacheEntry) {
        // Check if deadline has passed and we should try refreshing
        if (shouldRefreshBootstrap(cacheEntry)) {
            try {
                console.log('⏰ Deadline passed, attempting bootstrap refresh...');
                const freshData = await fetchData(`${API_BASE_URL}bootstrap-static/`);

                // Success! Update cache with fresh data
                const nextDeadline = getNextDeadline(freshData);
                setCachedDataWithDeadline(cacheKey, freshData, CACHE_DURATIONS.DAY, nextDeadline);
                console.log('✅ Bootstrap refreshed successfully');
                return freshData;
            } catch (error) {
                // Fetch failed - keep using old cache, but update last attempt time
                console.log('⚠️ Bootstrap refresh failed, using cached data');
                updateLastRefreshAttempt(cacheKey);
                return cacheEntry.data;
            }
        }

        // Deadline hasn't passed or we tried recently - use cache
        return cacheEntry.data;
    }

    // No cache - fetch fresh
    console.log('🌐 Fetching bootstrap-static from API');
    const data = await fetchData(`${API_BASE_URL}bootstrap-static/`);
    const nextDeadline = getNextDeadline(data);
    setCachedDataWithDeadline(cacheKey, data, CACHE_DURATIONS.DAY, nextDeadline);
    return data;
}

/**
 * Gets the current gameweek ID
 * @param {object} bootstrapData - Bootstrap data
 * @returns {number|null} - Current gameweek ID
 */
function getCurrentGameweek(bootstrapData) {
    const currentEvent = bootstrapData.events.find(event => event.is_current);
    if (currentEvent) return currentEvent.id;

    // If no current event, get the next one
    const nextEvent = bootstrapData.events.find(event => event.is_next);
    return nextEvent ? nextEvent.id : null;
}

/**
 * Gets the last completed gameweek ID
 * @param {object} bootstrapData - Bootstrap data
 * @returns {number|null} - Last completed gameweek ID
 */
function getLastCompletedGameweek(bootstrapData) {
    const completedEvents = bootstrapData.events.filter(event => event.finished);
    if (completedEvents.length === 0) return null;
    return Math.max(...completedEvents.map(e => e.id));
}

/**
 * Fetches live gameweek data for a specific gameweek with smart caching
 * - 60 seconds if gameweek is active (live points updating)
 * - 7 days if gameweek is finished (data is final)
 * @param {number} gameweekId - Gameweek ID
 * @returns {Promise<object>} - Live gameweek data
 */
async function getLiveGameweekData(gameweekId) {
    const cacheKey = `live_${gameweekId}`;
    const cached = getCachedData(cacheKey);

    if (cached) {
        return cached;
    }

    console.log(`🌐 Fetching live GW ${gameweekId} data from API`);
    const data = await fetchData(`${API_BASE_URL}event/${gameweekId}/live/`);

    // Determine cache duration based on gameweek status
    // Need bootstrap data to check if this GW is active
    const bootstrapData = await getBootstrapData();
    const currentGw = getCurrentGameweekFromBootstrap(bootstrapData);
    const isActive = currentGw === gameweekId && isGameweekActive(bootstrapData);

    const cacheDuration = isActive ? CACHE_DURATIONS.MINUTE : CACHE_DURATIONS.WEEK;
    setCachedData(cacheKey, data, cacheDuration);

    return data;
}

/**
 * Fetches league standings data with 7-day caching
 * League standings only update after gameweeks finish
 * @param {string} leagueId - League ID
 * @param {number} page - Page number (default 1)
 * @returns {Promise<object>} - League data
 */
async function getLeagueData(leagueId, page = 1) {
    const cacheKey = `league_${leagueId}_page${page}`;
    const cached = getCachedData(cacheKey);

    if (cached) {
        return cached;
    }

    console.log(`🌐 Fetching league ${leagueId} (page ${page}) from API`);
    const data = await fetchData(`${API_BASE_URL}leagues-classic/${leagueId}/standings/?page_standings=${page}`);
    setCachedData(cacheKey, data, CACHE_DURATIONS.WEEK);
    return data;
}

/**
 * Fetches multiple pages of league data to get more managers
 * @param {string} leagueId - League ID
 * @param {number} maxPages - Maximum number of pages to fetch (default 2 for 100 managers)
 * @returns {Promise<object>} - Combined league data with all managers
 */
async function getAllLeagueManagers(leagueId, maxPages = 2) {
    const firstPage = await getLeagueData(leagueId, 1);
    if (!firstPage || !firstPage.standings) {
        return firstPage;
    }

    // If only one page needed or no more pages available
    if (maxPages === 1 || !firstPage.standings.has_next) {
        return firstPage;
    }

    // Fetch additional pages
    const additionalPages = [];
    for (let page = 2; page <= maxPages; page++) {
        if (page === 2 || additionalPages[page - 3].standings.has_next) {
            additionalPages.push(getLeagueData(leagueId, page));
        }
    }

    const additionalData = await Promise.all(additionalPages);

    // Combine all results
    const allManagers = [...firstPage.standings.results];
    additionalData.forEach(pageData => {
        if (pageData && pageData.standings && pageData.standings.results) {
            allManagers.push(...pageData.standings.results);
        }
    });

    // Return combined data with first page structure
    return {
        ...firstPage,
        standings: {
            ...firstPage.standings,
            results: allManagers
        }
    };
}

/**
 * Fetches a manager's picks for a specific gameweek with smart caching
 * - Forever (1 year) for past gameweeks (data never changes)
 * - 7 days for current/future gameweeks (locked after deadline)
 * @param {number} managerId - Manager ID
 * @param {number} gameweekId - Gameweek ID
 * @returns {Promise<object>} - Picks data
 */
async function getManagerPicks(managerId, gameweekId) {
    const cacheKey = `picks_${managerId}_${gameweekId}`;
    const cached = getCachedData(cacheKey);

    if (cached) {
        return cached;
    }

    console.log(`🌐 Fetching picks for manager ${managerId} GW ${gameweekId} from API`);
    const data = await fetchData(`${API_BASE_URL}entry/${managerId}/event/${gameweekId}/picks/`);

    // Determine cache duration: forever for past GWs, 7 days for current/future
    const bootstrapData = await getBootstrapData();
    const currentGw = getCurrentGameweekFromBootstrap(bootstrapData);
    const isPastGameweek = gameweekId < currentGw;

    const cacheDuration = isPastGameweek ? CACHE_DURATIONS.FOREVER : CACHE_DURATIONS.WEEK;
    setCachedData(cacheKey, data, cacheDuration);

    return data;
}

/**
 * Fetches manager's basic data with 7-day caching
 * Manager data rarely changes (team name, region, etc.)
 * @param {number} managerId - Manager ID
 * @returns {Promise<object>} - Manager data
 */
async function getManagerData(managerId) {
    const cacheKey = `manager_${managerId}`;
    const cached = getCachedData(cacheKey);

    if (cached) {
        return cached;
    }

    console.log(`🌐 Fetching data for manager ${managerId} from API`);
    const data = await fetchData(`${API_BASE_URL}entry/${managerId}/`);
    setCachedData(cacheKey, data, CACHE_DURATIONS.WEEK);
    return data;
}

/**
 * Fetches a manager's history with 7-day caching
 * History only updates after gameweeks finish
 * @param {number} managerId - Manager ID
 * @returns {Promise<object>} - History data
 */
async function getManagerHistory(managerId) {
    const cacheKey = `history_${managerId}`;
    const cached = getCachedData(cacheKey);

    if (cached) {
        return cached;
    }

    console.log(`🌐 Fetching history for manager ${managerId} from API`);
    const data = await fetchData(`${API_BASE_URL}entry/${managerId}/history/`);
    setCachedData(cacheKey, data, CACHE_DURATIONS.WEEK);
    return data;
}

/**
 * Fetches fixtures data with 24-hour caching
 * Fixtures update when matches finish
 * @returns {Promise<object>} - Fixtures data
 */
async function getFixturesData() {
    const cacheKey = 'fixtures';
    const cached = getCachedData(cacheKey);

    if (cached) {
        return cached;
    }

    console.log('🌐 Fetching fixtures from API');
    const data = await fetchData(`${API_BASE_URL}fixtures/`);
    setCachedData(cacheKey, data, CACHE_DURATIONS.DAY);
    return data;
}

/**
 * Creates a map of player ID to player object
 * @param {object} bootstrapData - Bootstrap data
 * @returns {object} - Map of player ID to player object
 */
function createPlayerMap(bootstrapData) {
    const playerMap = {};
    bootstrapData.elements.forEach(player => {
        playerMap[player.id] = player;
    });
    return playerMap;
}

/**
 * Creates a map of team ID to team object
 * @param {object} bootstrapData - Bootstrap data
 * @returns {object} - Map of team ID to team object
 */
function createTeamMap(bootstrapData) {
    const teamMap = {};
    bootstrapData.teams.forEach(team => {
        teamMap[team.id] = team;
    });
    return teamMap;
}

/**
 * Calculates live points for a manager
 * @param {object} picksData - Manager's picks data
 * @param {object} liveData - Live gameweek data
 * @param {number} currentGw - Current gameweek
 * @param {object} historyData - Manager's history data
 * @returns {object} - Object with live points details
 */
function calculateLivePoints(picksData, liveData, currentGw, historyData) {
    const activeChip = picksData.active_chip;

    // Determine which players' points to count based on active chip
    let playersToScore = [];
    if (activeChip === 'bboost') {
        playersToScore = picksData.picks; // Count all 15 players for Bench Boost
    } else {
        playersToScore = picksData.picks.filter(p => p.position <= 11); // Count starting 11
    }

    // Create live points map
    const livePointsMap = {};
    liveData.elements.forEach(player => {
        livePointsMap[player.id] = player.stats;
    });

    // Calculate gameweek points
    let liveGwPoints = 0;
    playersToScore.forEach(pick => {
        const playerStats = livePointsMap[pick.element];
        if (playerStats) {
            liveGwPoints += playerStats.total_points * pick.multiplier;
        }
    });

    // Subtract transfer cost
    const transferCost = picksData.entry_history.event_transfers_cost;
    const finalGwPoints = liveGwPoints - transferCost;

    // Calculate total points
    let preGwTotal = 0;
    if (currentGw > 1 && historyData) {
        const prevGwHistory = historyData.current.find(gw => gw.event === currentGw - 1);
        if (prevGwHistory) {
            preGwTotal = prevGwHistory.total_points;
        }
    }
    const liveTotalPoints = preGwTotal + finalGwPoints;

    // Calculate players played (starting XI only)
    const starters = picksData.picks.filter(p => p.position <= 11);
    const playersPlayedCount = starters.reduce((count, p) => {
        const playerStats = livePointsMap[p.element];
        return count + ((playerStats?.minutes ?? 0) > 0 ? 1 : 0);
    }, 0);

    return {
        liveGwPoints: finalGwPoints,
        liveTotalPoints: liveTotalPoints,
        playersPlayed: playersPlayedCount,
        transferCost: transferCost,
        chip: activeChip
    };
}

/**
 * Gets chip abbreviation
 * @param {string} chip - Chip name
 * @returns {string} - Chip abbreviation
 */
function getChipAbbreviation(chip) {
    if (!chip) return '';
    const chipMap = {
        'bboost': 'BB',
        '3xc': 'TC',
        'freehit': 'FH',
        'wildcard': 'WC'
    };
    return chipMap[chip] || chip.toUpperCase();
}

/**
 * Gets position label from element type
 * @param {number} elementType - Element type (1-4)
 * @returns {string} - Position label (GKP, DEF, MID, FWD)
 */
function getPositionLabel(elementType) {
    const positionNames = ['', 'GKP', 'DEF', 'MID', 'FWD'];
    return positionNames[elementType] || '???';
}

/**
 * Helper function to delay execution
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} - Promise that resolves after delay
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetches manager picks and history data in batches to avoid rate limiting
 * Rate limit: 60 requests/second. Each manager = 2 requests (picks + history)
 * Smart batching: Skips delays if all data is already cached for instant loading
 * @param {array} managers - Array of manager objects with entry ID
 * @param {number} gameweekId - Gameweek ID
 * @param {number} batchSize - Number of managers to fetch per batch (default 5)
 * @param {number} delayMs - Delay in milliseconds between batches (default 200)
 * @returns {Promise<array>} - Array of manager data objects
 */
async function fetchManagerDataInBatches(managers, gameweekId, batchSize = 5, delayMs = 200) {
    // Check if all data is cached - if so, fetch everything instantly in parallel
    const allCached = managers.every(manager =>
        isCached(`picks_${manager.entry}_${gameweekId}`) &&
        isCached(`history_${manager.entry}`)
    );

    if (allCached) {
        console.log('⚡ All manager data cached - loading instantly');
        const allPromises = managers.map(async (manager) => {
            try {
                const [picksData, historyData] = await Promise.all([
                    getManagerPicks(manager.entry, gameweekId),
                    getManagerHistory(manager.entry)
                ]);

                return {
                    manager,
                    picksData,
                    historyData
                };
            } catch (error) {
                console.error(`Error fetching data for manager ${manager.entry}:`, error);
                return null;
            }
        });

        const results = await Promise.all(allPromises);
        return results.filter(r => r !== null);
    }

    // Not all cached - use batching with delays to respect rate limits
    console.log('🌐 Fetching manager data with rate limiting');
    const results = [];

    for (let i = 0; i < managers.length; i += batchSize) {
        const batch = managers.slice(i, i + batchSize);

        const batchPromises = batch.map(async (manager) => {
            try {
                const [picksData, historyData] = await Promise.all([
                    getManagerPicks(manager.entry, gameweekId),
                    getManagerHistory(manager.entry)
                ]);

                return {
                    manager,
                    picksData,
                    historyData
                };
            } catch (error) {
                console.error(`Error fetching data for manager ${manager.entry}:`, error);
                return null;
            }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Add delay between batches (except after the last batch)
        if (i + batchSize < managers.length) {
            await delay(delayMs);
        }
    }

    return results.filter(r => r !== null);
}

/**
 * Fetches manager picks only in batches to avoid rate limiting
 * Rate limit: 60 requests/second. Each manager = 1 request (picks only)
 * Smart batching: Skips delays if all data is already cached for instant loading
 * @param {array} managerIds - Array of manager IDs
 * @param {number} gameweekId - Gameweek ID
 * @param {number} batchSize - Number of managers to fetch per batch (default 10)
 * @param {number} delayMs - Delay in milliseconds between batches (default 200)
 * @returns {Promise<array>} - Array of picks data
 */
async function fetchManagerPicksInBatches(managerIds, gameweekId, batchSize = 10, delayMs = 200) {
    // Check if all data is cached - if so, fetch everything instantly in parallel
    const allCached = managerIds.every(managerId =>
        isCached(`picks_${managerId}_${gameweekId}`)
    );

    if (allCached) {
        console.log('⚡ All manager picks cached - loading instantly');
        const allPromises = managerIds.map(async (managerId) => {
            try {
                return await getManagerPicks(managerId, gameweekId);
            } catch (error) {
                console.error(`Error fetching picks for manager ${managerId}:`, error);
                return null;
            }
        });

        const results = await Promise.all(allPromises);
        return results.filter(r => r !== null);
    }

    // Not all cached - use batching with delays to respect rate limits
    console.log('🌐 Fetching manager picks with rate limiting');
    const results = [];

    for (let i = 0; i < managerIds.length; i += batchSize) {
        const batch = managerIds.slice(i, i + batchSize);

        const batchPromises = batch.map(async (managerId) => {
            try {
                return await getManagerPicks(managerId, gameweekId);
            } catch (error) {
                console.error(`Error fetching picks for manager ${managerId}:`, error);
                return null;
            }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Add delay between batches (except after the last batch)
        if (i + batchSize < managerIds.length) {
            await delay(delayMs);
        }
    }

    return results.filter(r => r !== null);
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        fetchData,
        getBootstrapData,
        getCurrentGameweek,
        getLastCompletedGameweek,
        getLiveGameweekData,
        getLeagueData,
        getAllLeagueManagers,
        getManagerPicks,
        getManagerHistory,
        getManagerData,
        getFixturesData,
        createPlayerMap,
        createTeamMap,
        calculateLivePoints,
        getChipAbbreviation,
        getPositionLabel,
        delay,
        fetchManagerDataInBatches,
        fetchManagerPicksInBatches,
        clearCache,
        clearAllCaches,
        API_BASE_URL,
        CORS_PROXY
    };
}
