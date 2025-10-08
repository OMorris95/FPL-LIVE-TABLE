// FPL API Helper Functions
// Shared utilities for making API calls to the Fantasy Premier League API

const CORS_PROXY = 'https://corsproxy.io/?';
const API_BASE_URL = `${CORS_PROXY}https://fantasy.premierleague.com/api/`;

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
 * Fetches bootstrap-static data (players, teams, events)
 * @returns {Promise<object>} - Bootstrap data
 */
async function getBootstrapData() {
    return await fetchData(`${API_BASE_URL}bootstrap-static/`);
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
 * Fetches live gameweek data for a specific gameweek
 * @param {number} gameweekId - Gameweek ID
 * @returns {Promise<object>} - Live gameweek data
 */
async function getLiveGameweekData(gameweekId) {
    return await fetchData(`${API_BASE_URL}event/${gameweekId}/live/`);
}

/**
 * Fetches league standings data
 * @param {string} leagueId - League ID
 * @param {number} page - Page number (default 1)
 * @returns {Promise<object>} - League data
 */
async function getLeagueData(leagueId, page = 1) {
    return await fetchData(`${API_BASE_URL}leagues-classic/${leagueId}/standings/?page_standings=${page}`);
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
 * Fetches a manager's picks for a specific gameweek
 * @param {number} managerId - Manager ID
 * @param {number} gameweekId - Gameweek ID
 * @returns {Promise<object>} - Picks data
 */
async function getManagerPicks(managerId, gameweekId) {
    return await fetchData(`${API_BASE_URL}entry/${managerId}/event/${gameweekId}/picks/`);
}

/**
 * Fetches a manager's history
 * @param {number} managerId - Manager ID
 * @returns {Promise<object>} - History data
 */
async function getManagerHistory(managerId) {
    return await fetchData(`${API_BASE_URL}entry/${managerId}/history/`);
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
 * @param {array} managers - Array of manager objects with entry ID
 * @param {number} gameweekId - Gameweek ID
 * @param {number} batchSize - Number of managers to fetch per batch (default 10)
 * @param {number} delayMs - Delay in milliseconds between batches (default 50)
 * @returns {Promise<array>} - Array of manager data objects
 */
async function fetchManagerDataInBatches(managers, gameweekId, batchSize = 10, delayMs = 50) {
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
 * @param {array} managerIds - Array of manager IDs
 * @param {number} gameweekId - Gameweek ID
 * @param {number} batchSize - Number of managers to fetch per batch (default 10)
 * @param {number} delayMs - Delay in milliseconds between batches (default 50)
 * @returns {Promise<array>} - Array of picks data
 */
async function fetchManagerPicksInBatches(managerIds, gameweekId, batchSize = 10, delayMs = 50) {
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
        createPlayerMap,
        createTeamMap,
        calculateLivePoints,
        getChipAbbreviation,
        getPositionLabel,
        delay,
        fetchManagerDataInBatches,
        fetchManagerPicksInBatches,
        API_BASE_URL,
        CORS_PROXY
    };
}
