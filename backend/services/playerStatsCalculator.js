// Player Stats Calculator Service
// Pre-computes 5GW, 10GW, and season aggregate stats for all players

const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');

/**
 * Calculates aggregate stats for a player over a gameweek range
 * @param {Object} playerHistory - Player's history from element-summary
 * @param {number} startGw - Start gameweek (inclusive)
 * @param {number} endGw - End gameweek (inclusive)
 * @returns {Object|null} Aggregate stats or null if no data
 */
function calculatePlayerStats(playerHistory, startGw, endGw) {
    if (!playerHistory || !playerHistory.history) {
        return null;
    }

    const gwData = playerHistory.history.filter(
        gw => gw.round >= startGw && gw.round <= endGw
    );

    if (gwData.length === 0) {
        return null;
    }

    return {
        points: gwData.reduce((sum, gw) => sum + gw.total_points, 0),
        minutes: gwData.reduce((sum, gw) => sum + gw.minutes, 0),
        goals: gwData.reduce((sum, gw) => sum + gw.goals_scored, 0),
        assists: gwData.reduce((sum, gw) => sum + gw.assists, 0),
        clean_sheets: gwData.reduce((sum, gw) => sum + gw.clean_sheets, 0),
        bonus: gwData.reduce((sum, gw) => sum + gw.bonus, 0),
        bps: gwData.reduce((sum, gw) => sum + gw.bps, 0),
        starts: gwData.reduce((sum, gw) => sum + gw.starts, 0),
        gws_played: gwData.length,
        avg_points: gwData.reduce((sum, gw) => sum + gw.total_points, 0) / gwData.length
    };
}

/**
 * Processes all player histories and generates pre-computed stats
 * @param {Object} playerDataCache - Full player data cache
 * @returns {Object} Pre-computed stats structure
 */
async function generatePlayerRecentStats(playerDataCache) {
    console.log('📊 Generating pre-computed player stats...');
    const startTime = Date.now();

    const { gameweek, bootstrap, player_histories } = playerDataCache;

    const stats = {
        lastUpdated: new Date().toISOString(),
        currentGw: gameweek,
        dataVersion: 1,
        players: {},
        positionAverages: {}
    };

    // Calculate ranges
    const gw5Start = Math.max(1, gameweek - 4);
    const gw10Start = Math.max(1, gameweek - 9);

    console.log(`   Range definitions:`);
    console.log(`   - Last 5 GW: GW${gw5Start} to GW${gameweek}`);
    console.log(`   - Last 10 GW: GW${gw10Start} to GW${gameweek}`);
    console.log(`   - Season: GW1 to GW${gameweek}`);

    // Calculate stats for each player
    const playerStatsArray = [];
    let processedCount = 0;

    for (const [playerId, history] of Object.entries(player_histories)) {
        const player = bootstrap.elements.find(p => p.id == playerId);
        if (!player) continue;

        const last5gw = calculatePlayerStats(history, gw5Start, gameweek);
        const last10gw = calculatePlayerStats(history, gw10Start, gameweek);
        const season = calculatePlayerStats(history, 1, gameweek);

        stats.players[playerId] = {
            id: parseInt(playerId),
            last5gw,
            last10gw,
            season
        };

        // Track for position averages (only players with minutes and price)
        if (player.minutes > 0 && player.now_cost > 0) {
            playerStatsArray.push({
                position: player.element_type,
                price: player.now_cost / 10,
                last5gw,
                last10gw,
                season
            });
        }

        processedCount++;
    }

    console.log(`   Processed ${processedCount} players`);

    // Calculate position averages
    console.log('   Calculating position averages...');
    stats.positionAverages = calculatePositionAverages(playerStatsArray, gameweek, gw5Start, gw10Start);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✓ Stats generation complete (${duration}s)`);

    return stats;
}

/**
 * Calculates points per million averages by position
 * Uses ratio of totals (total_points / total_price) instead of average of ratios
 * This correctly weights expensive players more heavily than cheap players
 * Filters out players with insufficient minutes (bench fodder)
 * @param {Array} playerStatsArray - Array of player stats with position and price
 * @param {number} currentGw - Current gameweek
 * @param {number} gw5Start - Starting gameweek for 5GW range
 * @param {number} gw10Start - Starting gameweek for 10GW range
 * @returns {Object} Position averages
 */
function calculatePositionAverages(playerStatsArray, currentGw, gw5Start, gw10Start) {
    const positionData = {
        1: {
            last5gw: { totalPoints: 0, totalPrice: 0 },
            last10gw: { totalPoints: 0, totalPrice: 0 },
            season: { totalPoints: 0, totalPrice: 0 }
        },
        2: {
            last5gw: { totalPoints: 0, totalPrice: 0 },
            last10gw: { totalPoints: 0, totalPrice: 0 },
            season: { totalPoints: 0, totalPrice: 0 }
        },
        3: {
            last5gw: { totalPoints: 0, totalPrice: 0 },
            last10gw: { totalPoints: 0, totalPrice: 0 },
            season: { totalPoints: 0, totalPrice: 0 }
        },
        4: {
            last5gw: { totalPoints: 0, totalPrice: 0 },
            last10gw: { totalPoints: 0, totalPrice: 0 },
            season: { totalPoints: 0, totalPrice: 0 }
        }
    };

    // Calculate dynamic minutes thresholds (percentage-based)
    const gw5Range = currentGw - gw5Start + 1;
    const gw10Range = currentGw - gw10Start + 1;

    const thresholds = {
        last5gw: gw5Range * 90 * 0.33,   // 33% of possible minutes
        last10gw: gw10Range * 90 * 0.40,  // 40% of possible minutes
        season: currentGw * 90 * 0.40     // 40% of possible minutes
    };

    console.log(`   Minutes thresholds: 5GW=${thresholds.last5gw.toFixed(0)}, 10GW=${thresholds.last10gw.toFixed(0)}, Season=${thresholds.season.toFixed(0)}`);

    // Accumulate total points and total price (filtered by minutes threshold)
    playerStatsArray.forEach(p => {
        if (p.last5gw && p.last5gw.minutes >= thresholds.last5gw) {
            positionData[p.position].last5gw.totalPoints += p.last5gw.points;
            positionData[p.position].last5gw.totalPrice += p.price;
        }
        if (p.last10gw && p.last10gw.minutes >= thresholds.last10gw) {
            positionData[p.position].last10gw.totalPoints += p.last10gw.points;
            positionData[p.position].last10gw.totalPrice += p.price;
        }
        if (p.season && p.season.minutes >= thresholds.season) {
            positionData[p.position].season.totalPoints += p.season.points;
            positionData[p.position].season.totalPrice += p.price;
        }
    });

    const averages = {};
    const positionNames = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };

    [1, 2, 3, 4].forEach(pos => {
        averages[pos] = {
            last5gw_ppm: positionData[pos].last5gw.totalPrice > 0
                ? positionData[pos].last5gw.totalPoints / positionData[pos].last5gw.totalPrice
                : 0,
            last10gw_ppm: positionData[pos].last10gw.totalPrice > 0
                ? positionData[pos].last10gw.totalPoints / positionData[pos].last10gw.totalPrice
                : 0,
            season_ppm: positionData[pos].season.totalPrice > 0
                ? positionData[pos].season.totalPoints / positionData[pos].season.totalPrice
                : 0
        };

        console.log(`   ${positionNames[pos]}: 5GW=${averages[pos].last5gw_ppm.toFixed(2)}, 10GW=${averages[pos].last10gw_ppm.toFixed(2)}, Season=${averages[pos].season_ppm.toFixed(2)} pts/£m`);
    });

    return averages;
}

/**
 * Saves pre-computed stats to file
 * @param {Object} stats - Pre-computed stats object
 */
async function savePlayerRecentStats(stats) {
    const filepath = path.join(DATA_DIR, 'player_recent_stats.json');
    await fs.writeFile(filepath, JSON.stringify(stats, null, 2));

    // Calculate file size
    const fileStats = await fs.stat(filepath);
    const fileSizeKB = (fileStats.size / 1024).toFixed(2);

    console.log(`✓ Saved player_recent_stats.json (${Object.keys(stats.players).length} players, ${fileSizeKB}KB)`);
}

/**
 * Loads pre-computed stats from file
 * @returns {Object|null} Pre-computed stats or null if not found
 */
async function loadPlayerRecentStats() {
    const filepath = path.join(DATA_DIR, 'player_recent_stats.json');
    try {
        const data = await fs.readFile(filepath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.warn('⚠️ No pre-computed stats file found');
        return null;
    }
}

module.exports = {
    generatePlayerRecentStats,
    savePlayerRecentStats,
    loadPlayerRecentStats,
    calculatePlayerStats  // Export for testing
};
