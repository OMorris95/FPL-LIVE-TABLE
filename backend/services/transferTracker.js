const fs = require('fs').promises;
const path = require('path');
const { getBootstrapData } = require('./fplDataFetcher');

const SNAPSHOTS_DIR = path.join(__dirname, '../data/transfer_snapshots');
const DAILY_DATA_PATH = path.join(__dirname, '../data/daily_transfers.json');

/**
 * Ensures snapshots directory exists
 */
async function ensureSnapshotsDir() {
    try {
        await fs.access(SNAPSHOTS_DIR);
    } catch {
        await fs.mkdir(SNAPSHOTS_DIR, { recursive: true });
    }
}

/**
 * Gets timestamp string for filenames
 */
function getTimestampString() {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-').slice(0, -5); // YYYY-MM-DDTHH-MM-SS
}

/**
 * Saves current transfer snapshot
 */
async function saveTransferSnapshot(players) {
    await ensureSnapshotsDir();

    const timestamp = new Date().toISOString();
    const filename = `snapshot_${getTimestampString()}.json`;
    const filepath = path.join(SNAPSHOTS_DIR, filename);

    const snapshot = {
        timestamp,
        players: players.map(p => ({
            id: p.id,
            web_name: p.web_name,
            transfers_in_event: p.transfers_in_event || 0,
            transfers_out_event: p.transfers_out_event || 0,
            selected_by_percent: parseFloat(p.selected_by_percent) || 0,
            now_cost: p.now_cost
        }))
    };

    await fs.writeFile(filepath, JSON.stringify(snapshot, null, 2));
    console.log(`Saved transfer snapshot: ${filename}`);

    return snapshot;
}

/**
 * Gets most recent snapshot
 */
async function getLastSnapshot() {
    await ensureSnapshotsDir();

    try {
        const files = await fs.readdir(SNAPSHOTS_DIR);
        const snapshotFiles = files.filter(f => f.startsWith('snapshot_')).sort().reverse();

        if (snapshotFiles.length === 0) {
            return null;
        }

        const lastFile = snapshotFiles[0];
        const filepath = path.join(SNAPSHOTS_DIR, lastFile);
        const data = await fs.readFile(filepath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading last snapshot:', error);
        return null;
    }
}

/**
 * Calculates deltas between current and previous snapshot
 */
function calculateDeltas(currentPlayers, previousSnapshot) {
    if (!previousSnapshot) {
        // First run - no deltas to calculate
        return currentPlayers.map(p => ({
            ...p,
            transfers_in_delta: 0,
            transfers_out_delta: 0,
            net_delta: 0
        }));
    }

    // Create map of previous player data
    const previousMap = {};
    previousSnapshot.players.forEach(p => {
        previousMap[p.id] = p;
    });

    // Calculate deltas
    return currentPlayers.map(player => {
        const previous = previousMap[player.id];

        if (!previous) {
            // New player or missing data
            return {
                ...player,
                transfers_in_delta: 0,
                transfers_out_delta: 0,
                net_delta: 0
            };
        }

        const transfersInDelta = (player.transfers_in_event || 0) - (previous.transfers_in_event || 0);
        const transfersOutDelta = (player.transfers_out_event || 0) - (previous.transfers_out_event || 0);
        const netDelta = transfersInDelta - transfersOutDelta;

        return {
            ...player,
            transfers_in_delta: transfersInDelta,
            transfers_out_delta: transfersOutDelta,
            net_delta: netDelta
        };
    });
}

/**
 * Loads or initializes daily transfer data
 */
async function loadDailyData() {
    try {
        const data = await fs.readFile(DAILY_DATA_PATH, 'utf8');
        return JSON.parse(data);
    } catch {
        // File doesn't exist, create initial structure
        return {
            last_reset: new Date().toISOString(),
            players: {}
        };
    }
}

/**
 * Saves daily transfer data
 */
async function saveDailyData(data) {
    await fs.writeFile(DAILY_DATA_PATH, JSON.stringify(data, null, 2));
}

/**
 * Accumulates deltas into daily totals
 */
async function accumulateDailyDeltas(playersWithDeltas) {
    const dailyData = await loadDailyData();

    playersWithDeltas.forEach(player => {
        if (!dailyData.players[player.id]) {
            dailyData.players[player.id] = {
                id: player.id,
                web_name: player.web_name,
                daily_transfers_in: 0,
                daily_transfers_out: 0,
                daily_net_delta: 0,
                selected_by_percent: player.selected_by_percent,
                now_cost: player.now_cost
            };
        }

        const playerData = dailyData.players[player.id];
        playerData.daily_transfers_in += player.transfers_in_delta;
        playerData.daily_transfers_out += player.transfers_out_delta;
        playerData.daily_net_delta += player.net_delta;
        playerData.selected_by_percent = player.selected_by_percent;
        playerData.now_cost = player.now_cost;
        playerData.web_name = player.web_name;
    });

    dailyData.last_updated = new Date().toISOString();
    await saveDailyData(dailyData);

    return dailyData;
}

/**
 * Resets daily deltas (called after price changes at 3 AM)
 */
async function resetDailyDeltas() {
    console.log('Resetting daily transfer deltas...');
    const resetData = {
        last_reset: new Date().toISOString(),
        players: {}
    };
    await saveDailyData(resetData);
    console.log('Daily deltas reset complete');
}

/**
 * Main tracking function - called by cron every 30 minutes
 */
async function trackTransfers() {
    console.log('\n=== Tracking Transfer Deltas ===');
    console.log(`Timestamp: ${new Date().toISOString()}`);

    try {
        // 1. Fetch current bootstrap data
        const bootstrapData = await getBootstrapData();
        const players = bootstrapData.elements;

        // 2. Get previous snapshot
        const lastSnapshot = await getLastSnapshot();

        // 3. Calculate deltas
        const playersWithDeltas = calculateDeltas(players, lastSnapshot);

        // 4. Save current snapshot
        await saveTransferSnapshot(players);

        // 5. Accumulate deltas into daily totals
        const dailyData = await accumulateDailyDeltas(playersWithDeltas);

        // 6. Log summary
        const activePlayers = Object.values(dailyData.players).filter(p => Math.abs(p.daily_net_delta) > 0);
        console.log(`Total players with transfer activity: ${activePlayers.length}`);
        console.log(`Top mover: ${activePlayers.sort((a, b) => Math.abs(b.daily_net_delta) - Math.abs(a.daily_net_delta))[0]?.web_name || 'N/A'}`);
        console.log('=== Transfer tracking complete ===\n');

        return dailyData;
    } catch (error) {
        console.error('=== Error tracking transfers ===');
        console.error(error);
        throw error;
    }
}

/**
 * Gets current daily transfer data
 */
async function getDailyTransferData() {
    return await loadDailyData();
}

/**
 * Cleans up old snapshots (keep last 48 hours)
 */
async function cleanupOldSnapshots() {
    await ensureSnapshotsDir();

    try {
        const files = await fs.readdir(SNAPSHOTS_DIR);
        const snapshotFiles = files.filter(f => f.startsWith('snapshot_'));

        // Keep last 48 snapshots (24 hours at 30 min intervals)
        const filesToDelete = snapshotFiles.sort().reverse().slice(48);

        for (const file of filesToDelete) {
            await fs.unlink(path.join(SNAPSHOTS_DIR, file));
        }

        if (filesToDelete.length > 0) {
            console.log(`Cleaned up ${filesToDelete.length} old snapshots`);
        }
    } catch (error) {
        console.error('Error cleaning up snapshots:', error);
    }
}

module.exports = {
    trackTransfers,
    getDailyTransferData,
    resetDailyDeltas,
    cleanupOldSnapshots
};
