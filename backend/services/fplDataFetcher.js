const axios = require('axios');

const FPL_API_BASE = 'https://fantasy.premierleague.com/api/';
const GLOBAL_LEAGUE_ID = 314; // Global overall rankings league
const DELAY_MS = 1000; // 1 second delay between requests for rate limiting

/**
 * Delay helper for rate limiting
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetches data from FPL API with error handling
 */
async function fetchFromFPL(endpoint) {
    try {
        const response = await axios.get(`${FPL_API_BASE}${endpoint}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error.message);
        throw error;
    }
}

/**
 * Gets bootstrap-static data (players, teams, events)
 */
async function getBootstrapData() {
    console.log('Fetching bootstrap data...');
    return await fetchFromFPL('bootstrap-static/');
}

/**
 * Gets current gameweek from bootstrap data
 */
function getCurrentGameweek(bootstrapData) {
    const currentEvent = bootstrapData.events.find(event => event.is_current);
    if (currentEvent) return currentEvent.id;

    const nextEvent = bootstrapData.events.find(event => event.is_next);
    return nextEvent ? nextEvent.id : null;
}

/**
 * Fetches top 10k manager IDs from global league (pages 1-200)
 * Each page has 50 managers, so 200 pages = 10,000 managers
 */
async function getTop10kManagerIds() {
    console.log('Fetching top 10k manager IDs...');
    const managerIds = [];

    for (let page = 1; page <= 200; page++) {
        try {
            console.log(`Fetching page ${page}/200...`);
            const data = await fetchFromFPL(`leagues-classic/${GLOBAL_LEAGUE_ID}/standings/?page_standings=${page}`);

            const standings = data.standings.results;
            standings.forEach(entry => {
                managerIds.push(entry.entry);
            });

            // Rate limiting delay
            if (page < 200) {
                await delay(DELAY_MS);
            }
        } catch (error) {
            console.error(`Failed to fetch page ${page}:`, error.message);
            throw error;
        }
    }

    console.log(`Fetched ${managerIds.length} manager IDs`);
    return managerIds;
}

/**
 * Fetches a single manager's picks for a specific gameweek
 */
async function getManagerPicks(managerId, gameweek) {
    try {
        return await fetchFromFPL(`entry/${managerId}/event/${gameweek}/picks/`);
    } catch (error) {
        console.error(`Failed to fetch picks for manager ${managerId}:`, error.message);
        return null; // Return null if manager data unavailable
    }
}

/**
 * Fetches all manager picks for a specific gameweek
 * Uses rate limiting to avoid overwhelming the API
 */
async function getAllManagerPicks(managerIds, gameweek) {
    console.log(`Fetching picks for ${managerIds.length} managers for GW${gameweek}...`);
    const allPicks = [];

    for (let i = 0; i < managerIds.length; i++) {
        const managerId = managerIds[i];

        if ((i + 1) % 100 === 0) {
            console.log(`Progress: ${i + 1}/${managerIds.length} managers...`);
        }

        const picks = await getManagerPicks(managerId, gameweek);
        if (picks && picks.picks) {
            allPicks.push({
                managerId,
                picks: picks.picks
            });
        }

        // Rate limiting delay
        if (i < managerIds.length - 1) {
            await delay(DELAY_MS);
        }
    }

    console.log(`Successfully fetched picks for ${allPicks.length} managers`);
    return allPicks;
}

module.exports = {
    getBootstrapData,
    getCurrentGameweek,
    getTop10kManagerIds,
    getAllManagerPicks
};
