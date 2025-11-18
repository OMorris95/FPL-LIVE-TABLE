const cron = require('node-cron');
const { fetchAndSaveAllPlayerData, getBootstrapData, loadPlayerDataMetadata } = require('../services/playerDataFetcher');
const fs = require('fs').promises;
const path = require('path');

// Track which gameweeks have had their final fetch after completion
const TRACKER_FILE = path.join(__dirname, '../data/gameweek_fetch_tracker.json');

/**
 * Loads the gameweek fetch tracker
 */
async function loadFetchTracker() {
    try {
        const data = await fs.readFile(TRACKER_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        return { processed_gameweeks: [] };
    }
}

/**
 * Saves the gameweek fetch tracker
 */
async function saveFetchTracker(tracker) {
    await fs.mkdir(path.dirname(TRACKER_FILE), { recursive: true });
    await fs.writeFile(TRACKER_FILE, JSON.stringify(tracker, null, 2));
}

/**
 * Checks if gameweek has already been processed (final fetch completed)
 */
async function hasBeenProcessed(gameweek) {
    const tracker = await loadFetchTracker();
    return tracker.processed_gameweeks.includes(gameweek);
}

/**
 * Marks a gameweek as processed
 */
async function markAsProcessed(gameweek) {
    const tracker = await loadFetchTracker();
    if (!tracker.processed_gameweeks.includes(gameweek)) {
        tracker.processed_gameweeks.push(gameweek);
        await saveFetchTracker(tracker);
        console.log(`Marked GW${gameweek} as processed (final fetch completed)`);
    }
}

/**
 * Determines the current gameweek status
 * @returns {Object} { live: boolean, status: string, gw: number }
 */
async function getGameweekStatus() {
    try {
        const bootstrap = await getBootstrapData();
        const events = bootstrap.events;

        // Find current gameweek
        const currentGw = events.find(e => e.is_current);

        if (!currentGw) {
            return { live: false, status: 'no_current_gameweek', gw: null };
        }

        const now = new Date();
        const deadlineTime = new Date(currentGw.deadline_time);

        // Before deadline - gameweek hasn't started
        if (now < deadlineTime) {
            return {
                live: false,
                status: 'before_deadline',
                gw: currentGw.id,
                details: `GW${currentGw.id} starts at ${deadlineTime.toISOString()}`
            };
        }

        // After deadline, gameweek finished
        if (currentGw.finished) {
            return {
                live: false,
                status: 'finished',
                gw: currentGw.id,
                details: `GW${currentGw.id} has finished`
            };
        }

        // After deadline, not finished = LIVE
        if (now >= deadlineTime && !currentGw.finished) {
            const hoursLive = ((now - deadlineTime) / (1000 * 60 * 60)).toFixed(1);
            return {
                live: true,
                status: 'live',
                gw: currentGw.id,
                details: `GW${currentGw.id} is live (${hoursLive} hours since deadline)`
            };
        }

        return { live: false, status: 'unknown', gw: currentGw.id };

    } catch (error) {
        console.error('Error checking gameweek status:', error.message);
        return { live: false, status: 'error', gw: null, error: error.message };
    }
}

/**
 * Smart conditional fetch logic
 * Runs every 10 minutes, but only fetches if:
 * 1. Gameweek is currently live, OR
 * 2. Gameweek just finished AND hasn't been processed yet
 */
async function smartFetchCheck() {
    try {
        console.log(`[${new Date().toISOString()}] Smart fetch check triggered`);

        // Get gameweek status
        const gwStatus = await getGameweekStatus();
        console.log(`Status: ${gwStatus.status} | ${gwStatus.details || ''}`);

        // Case 1: Gameweek is LIVE - fetch fresh data
        if (gwStatus.live) {
            console.log(`✓ Gameweek ${gwStatus.gw} is LIVE - fetching player data...`);
            await fetchAndSaveAllPlayerData();
            return;
        }

        // Case 2: Gameweek FINISHED - check if we need final fetch
        if (gwStatus.status === 'finished') {
            const processed = await hasBeenProcessed(gwStatus.gw);

            if (processed) {
                console.log(`✓ GW${gwStatus.gw} already processed - skipping fetch`);
                return;
            }

            console.log(`✓ GW${gwStatus.gw} just finished - performing final fetch...`);
            await fetchAndSaveAllPlayerData();
            await markAsProcessed(gwStatus.gw);
            console.log(`✓ Final fetch complete for GW${gwStatus.gw}`);
            return;
        }

        // Case 3: Before deadline or no current gameweek - skip
        console.log(`○ No fetch needed - ${gwStatus.status}`);

    } catch (error) {
        console.error('[SMART FETCH ERROR]', error.message);
    }
}

/**
 * Cron schedule: Runs every 10 minutes
 * Cron pattern: "* /10 * * * *" (every 10 minutes - note: space after asterisk for comment compatibility)
 */
cron.schedule('*/10 * * * *', smartFetchCheck);

console.log('Smart player data sync cron scheduled: Every 10 minutes (conditional fetch)');
console.log('- Fetches during LIVE gameweeks');
console.log('- Fetches once after gameweek finishes');
console.log('- Skips when gameweek is not active\n');

/**
 * Run initial fetch on startup
 * - If no cache exists: Always perform initial population (regardless of gameweek status)
 * - If cache exists: Use smart conditional logic (only fetch if gameweek is live/finished)
 */
(async () => {
    console.log('Performing initial startup check...');

    // Check if cache already exists
    const existingMetadata = await loadPlayerDataMetadata();

    if (!existingMetadata) {
        // No cache exists - perform initial population regardless of gameweek status
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📦 No existing cache found');
        console.log('🚀 Performing initial data fetch (this will take ~2 minutes)...');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        await fetchAndSaveAllPlayerData();
        console.log('✅ Initial cache population complete\n');
    } else {
        // Cache exists - use smart conditional logic
        console.log(`✓ Existing cache found (GW${existingMetadata.gameweek}, updated: ${existingMetadata.last_updated})`);
        console.log('Checking gameweek status...');

        const gwStatus = await getGameweekStatus();

        if (gwStatus.live) {
            console.log('Gameweek is LIVE - performing initial fetch...');
            await smartFetchCheck();
        } else if (gwStatus.status === 'finished') {
            const processed = await hasBeenProcessed(gwStatus.gw);
            if (!processed) {
                console.log('Gameweek just finished - performing initial fetch...');
                await smartFetchCheck();
            } else {
                console.log('Gameweek finished and already processed - skipping initial fetch');
            }
        } else {
            console.log('Gameweek not active - skipping initial fetch (cache already exists)');
        }
    }
})();

// Export for manual triggering
module.exports = {
    triggerManualFetch: async () => {
        console.log('Manual fetch triggered');
        await fetchAndSaveAllPlayerData();
    },
    getGameweekStatus,
    smartFetchCheck
};
