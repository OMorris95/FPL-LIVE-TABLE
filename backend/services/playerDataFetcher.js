const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const FPL_API_BASE = 'https://fantasy.premierleague.com/api/';
const DATA_DIR = path.join(__dirname, '../data');
const BATCH_SIZE = 10; // Fetch 10 players concurrently
const DELAY_BETWEEN_BATCHES = 2000; // 2 second delay between batches

/**
 * Delay helper for rate limiting
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetches data from FPL API with error handling and retry logic
 */
async function fetchFromFPL(endpoint, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await axios.get(`${FPL_API_BASE}${endpoint}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 10000 // 10 second timeout
            });
            return response.data;
        } catch (error) {
            if (attempt === retries) {
                console.error(`Failed to fetch ${endpoint} after ${retries} attempts:`, error.message);
                throw error;
            }
            console.warn(`Retry ${attempt}/${retries} for ${endpoint}`);
            await delay(1000 * attempt); // Exponential backoff
        }
    }
}

/**
 * Gets bootstrap-static data (players, teams, events)
 */
async function getBootstrapData() {
    return await fetchFromFPL('bootstrap-static/');
}

/**
 * Fetches a single player's history
 */
async function getPlayerHistory(playerId) {
    try {
        return await fetchFromFPL(`element-summary/${playerId}/`);
    } catch (error) {
        console.error(`Failed to fetch history for player ${playerId}:`, error.message);
        return null;
    }
}

/**
 * Fetches all player histories in batches with rate limiting
 * @param {Array} playerIds - Array of player IDs to fetch
 * @returns {Object} Map of playerId -> player history data
 */
async function fetchAllPlayerHistories(playerIds) {
    console.log(`Fetching histories for ${playerIds.length} players...`);
    const playerHistories = {};
    const totalBatches = Math.ceil(playerIds.length / BATCH_SIZE);

    for (let i = 0; i < playerIds.length; i += BATCH_SIZE) {
        const batch = playerIds.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;

        console.log(`Fetching batch ${batchNum}/${totalBatches} (players ${i + 1}-${Math.min(i + BATCH_SIZE, playerIds.length)})...`);

        // Fetch batch concurrently
        const batchPromises = batch.map(playerId => getPlayerHistory(playerId));
        const batchResults = await Promise.all(batchPromises);

        // Store results
        batch.forEach((playerId, index) => {
            if (batchResults[index]) {
                playerHistories[playerId] = batchResults[index];
            }
        });

        // Rate limiting delay between batches (except last batch)
        if (i + BATCH_SIZE < playerIds.length) {
            await delay(DELAY_BETWEEN_BATCHES);
        }
    }

    const successCount = Object.keys(playerHistories).length;
    console.log(`Successfully fetched ${successCount}/${playerIds.length} player histories`);

    return playerHistories;
}

/**
 * Fetches and saves all player data (bootstrap + histories)
 * @returns {Object} Summary of the fetch operation
 */
async function fetchAndSaveAllPlayerData() {
    const startTime = Date.now();
    console.log('\n========================================');
    console.log('Starting smart player data fetch...');
    console.log('========================================\n');

    try {
        // Ensure data directory exists
        await fs.mkdir(DATA_DIR, { recursive: true });

        // Step 1: Fetch bootstrap data
        console.log('Step 1: Fetching bootstrap data...');
        const bootstrapData = await getBootstrapData();
        const currentGw = bootstrapData.events.find(e => e.is_current)?.id || 1;

        console.log(`Current gameweek: ${currentGw}`);
        console.log(`Total players in database: ${bootstrapData.elements.length}\n`);

        // Step 2: Fetch all player histories
        console.log('Step 2: Fetching player histories...');
        const playerIds = bootstrapData.elements.map(p => p.id);
        const playerHistories = await fetchAllPlayerHistories(playerIds);

        // Step 3: Combine data
        console.log('\nStep 3: Combining data...');
        const combinedData = {
            last_updated: new Date().toISOString(),
            gameweek: currentGw,
            bootstrap: bootstrapData,
            player_histories: playerHistories,
            metadata: {
                total_players: bootstrapData.elements.length,
                histories_fetched: Object.keys(playerHistories).length,
                fetch_duration_seconds: Math.round((Date.now() - startTime) / 1000)
            }
        };

        // Step 4: Save to file
        console.log('Step 4: Saving to file...');
        const filepath = path.join(DATA_DIR, 'player_data_cache.json');
        await fs.writeFile(filepath, JSON.stringify(combinedData, null, 2));

        const fileSizeMB = ((await fs.stat(filepath)).size / (1024 * 1024)).toFixed(2);
        console.log(`Saved to: ${filepath}`);
        console.log(`File size: ${fileSizeMB} MB`);

        // Step 5: Save metadata
        const metadataFilepath = path.join(DATA_DIR, 'player_data_metadata.json');
        await fs.writeFile(metadataFilepath, JSON.stringify({
            last_updated: combinedData.last_updated,
            gameweek: currentGw,
            status: 'success',
            total_players: combinedData.metadata.total_players,
            histories_fetched: combinedData.metadata.histories_fetched,
            fetch_duration_seconds: combinedData.metadata.fetch_duration_seconds
        }, null, 2));

        const duration = Math.round((Date.now() - startTime) / 1000);
        console.log('\n========================================');
        console.log(`✓ Player data fetch completed successfully`);
        console.log(`Total duration: ${duration} seconds (${(duration / 60).toFixed(1)} minutes)`);
        console.log('========================================\n');

        return {
            success: true,
            gameweek: currentGw,
            duration_seconds: duration,
            total_players: combinedData.metadata.total_players,
            histories_fetched: combinedData.metadata.histories_fetched
        };

    } catch (error) {
        console.error('\n========================================');
        console.error('✗ Player data fetch failed');
        console.error('Error:', error.message);
        console.error('========================================\n');

        // Save error metadata
        const metadataFilepath = path.join(DATA_DIR, 'player_data_metadata.json');
        await fs.writeFile(metadataFilepath, JSON.stringify({
            last_updated: new Date().toISOString(),
            status: 'error',
            error: error.message
        }, null, 2));

        throw error;
    }
}

/**
 * Loads cached player data
 */
async function loadCachedPlayerData() {
    const filepath = path.join(DATA_DIR, 'player_data_cache.json');

    try {
        const data = await fs.readFile(filepath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Failed to load cached player data:', error.message);
        return null;
    }
}

/**
 * Loads player data metadata
 */
async function loadPlayerDataMetadata() {
    const filepath = path.join(DATA_DIR, 'player_data_metadata.json');

    try {
        const data = await fs.readFile(filepath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return null;
    }
}

module.exports = {
    fetchAndSaveAllPlayerData,
    loadCachedPlayerData,
    loadPlayerDataMetadata,
    getBootstrapData
};
