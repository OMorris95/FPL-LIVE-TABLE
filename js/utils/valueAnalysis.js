// Value Analysis Utility
// Calculates player value (points per price) and identifies underperformers
// Uses pre-computed stats from backend for efficient calculation

/**
 * Calculates player points for a specific range from pre-computed stats
 * @param {Object} playerStats - Pre-computed player stats from backend
 * @param {string} range - 'season', '10gw', or '5gw'
 * @returns {number} Points for the specified range
 */
function calculatePlayerPointsForRange(playerStats, range) {
    if (!playerStats) return 0;

    const rangeKey = range === 'season' ? 'season' :
                     range === '5gw' ? 'last5gw' : 'last10gw';

    const stats = playerStats[rangeKey];
    return stats ? stats.points : 0;
}

/**
 * Calculates position averages from pre-computed data
 * @param {Object} recentStats - Pre-computed stats from backend
 * @param {string} range - 'season', '10gw', or '5gw'
 * @returns {Object} Position averages { 1: avg, 2: avg, 3: avg, 4: avg }
 */
function calculatePositionAverages(recentStats, range) {
    const rangeKey = range === 'season' ? 'season_ppm' :
                     range === '5gw' ? 'last5gw_ppm' : 'last10gw_ppm';

    const averages = {};
    [1, 2, 3, 4].forEach(pos => {
        averages[pos] = recentStats.positionAverages[pos][rangeKey] || 0;
    });

    return averages;
}

/**
 * Analyzes squad value and identifies underperformers using pre-computed stats
 * @param {Array} squadPlayers - Array of player objects with full data
 * @param {Object} playerStatsMap - Map of playerId -> pre-computed stats
 * @param {Object} positionAverages - Position averages from calculatePositionAverages()
 * @param {string} range - 'season', '10gw', or '5gw'
 * @returns {Array} Squad players with performance metrics
 */
function analyzeSquadValue(squadPlayers, playerStatsMap, positionAverages, range) {
    return squadPlayers.map(player => {
        const playerStats = playerStatsMap[player.id];
        const points = calculatePlayerPointsForRange(playerStats, range);
        const price = player.now_cost / 10;
        const ppm = price > 0 ? points / price : 0;

        const posAvg = positionAverages[player.element_type] || 0;
        const percentDiff = posAvg > 0 ? ((ppm - posAvg) / posAvg) * 100 : 0;
        const isUnderperforming = ppm < posAvg;

        return {
            ...player,
            rangePoints: points,
            pointsPerMillion: ppm,
            positionAverage: posAvg,
            percentDifference: percentDiff,
            underperforming: isUnderperforming
        };
    });
}

/**
 * Finds replacement suggestions for an underperforming player using pre-computed stats
 * @param {Object} player - Player object with performance metrics
 * @param {Array} allPlayers - All players from bootstrap
 * @param {Object} playerStatsMap - Map of playerId -> pre-computed stats
 * @param {Array} squadPlayerIds - Array of player IDs already in squad
 * @param {string} range - 'season', '10gw', or '5gw'
 * @param {number} topN - Number of suggestions to return
 * @returns {Array} Top replacement suggestions
 */
function findReplacements(player, allPlayers, playerStatsMap, squadPlayerIds, range, topN = 5) {
    // Filter to same position, not in squad, and with minutes played
    const candidates = allPlayers.filter(p =>
        p.element_type === player.element_type &&
        !squadPlayerIds.includes(p.id) &&
        p.minutes > 0 &&
        p.now_cost > 0
    );

    // Calculate PPM for each candidate using pre-computed stats
    const candidatesWithPPM = candidates.map(candidate => {
        const playerStats = playerStatsMap[candidate.id];
        const points = calculatePlayerPointsForRange(playerStats, range);
        const price = candidate.now_cost / 10;
        const ppm = points / price;

        return {
            ...candidate,
            rangePoints: points,
            pointsPerMillion: ppm,
            price: price
        };
    });

    // Filter to players better than the underperformer
    const betterPlayers = candidatesWithPPM.filter(c =>
        c.pointsPerMillion > player.pointsPerMillion
    );

    // Sort by PPM descending
    betterPlayers.sort((a, b) => b.pointsPerMillion - a.pointsPerMillion);

    // Return top N
    return betterPlayers.slice(0, topN);
}

/**
 * Gets position name from element_type
 * @param {number} elementType - Position type (1-4)
 * @returns {string} Position abbreviation
 */
function getPositionAbbr(elementType) {
    const positions = {
        1: 'GKP',
        2: 'DEF',
        3: 'MID',
        4: 'FWD'
    };
    return positions[elementType] || '';
}

/**
 * Gets position name (full)
 * @param {number} elementType - Position type (1-4)
 * @returns {string} Position full name
 */
function getPositionName(elementType) {
    const positions = {
        1: 'Goalkeeper',
        2: 'Defender',
        3: 'Midfielder',
        4: 'Forward'
    };
    return positions[elementType] || '';
}
