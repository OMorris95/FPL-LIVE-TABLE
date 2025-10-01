const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');

/**
 * Ensures data directory exists
 */
async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
}

/**
 * Saves ownership data to JSON file
 * Format: ownership_[tier]_gw[gameweek].json
 * Example: ownership_100_gw15.json
 */
async function saveOwnershipData(tier, gameweek, ownershipData) {
    await ensureDataDir();
    const filename = `ownership_${tier}_gw${gameweek}.json`;
    const filepath = path.join(DATA_DIR, filename);

    const data = {
        tier,
        gameweek,
        updated_at: new Date().toISOString(),
        total_players: ownershipData.length,
        ownership: ownershipData
    };

    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
    console.log(`Saved ${filename}`);
}

/**
 * Loads ownership data from JSON file
 */
async function loadOwnershipData(tier, gameweek) {
    const filename = `ownership_${tier}_gw${gameweek}.json`;
    const filepath = path.join(DATA_DIR, filename);

    try {
        const data = await fs.readFile(filepath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Failed to load ${filename}:`, error.message);
        return null;
    }
}

/**
 * Gets latest available ownership data for a tier
 * Searches backwards from current gameweek
 */
async function getLatestOwnershipData(tier, currentGameweek) {
    for (let gw = currentGameweek; gw >= 1; gw--) {
        const data = await loadOwnershipData(tier, gw);
        if (data) {
            return data;
        }
    }
    return null;
}

/**
 * Saves metadata about last update
 */
async function saveUpdateMetadata(gameweek, status, error = null) {
    await ensureDataDir();
    const filepath = path.join(DATA_DIR, 'last_update.json');

    const metadata = {
        gameweek,
        status, // 'success' or 'error'
        timestamp: new Date().toISOString(),
        error: error ? error.message : null
    };

    await fs.writeFile(filepath, JSON.stringify(metadata, null, 2));
}

/**
 * Loads last update metadata
 */
async function loadUpdateMetadata() {
    const filepath = path.join(DATA_DIR, 'last_update.json');

    try {
        const data = await fs.readFile(filepath, 'utf8');
        return JSON.parse(data);
    } catch {
        return null;
    }
}

module.exports = {
    saveOwnershipData,
    loadOwnershipData,
    getLatestOwnershipData,
    saveUpdateMetadata,
    loadUpdateMetadata
};
