// Player Radar Chart Statistics Calculator
// Normalizes player stats against position maximums

/**
 * Get radar chart labels for a position
 * @param {number} position - Position type (1=GKP, 2=DEF, 3=MID, 4=FWD)
 * @returns {array} - Array of stat labels
 */
function getRadarLabels(position) {
    const labels = {
        1: ['Clean Sheets', 'Saves', 'BPS', 'Discipline', '% Games Played', 'Goals Prevented', 'Penalties Saved'],
        2: ['Goals', 'Assists', 'Mins/Game', 'Discipline', 'Clean Sheets', 'BPS', 'ICT Index'],
        3: ['Goals', 'Assists', 'Mins/Game', 'Discipline', 'Clean Sheets', 'BPS', 'ICT Index'],
        4: ['Goals', 'Assists', 'Mins/Game', 'Discipline', 'BPS', 'ICT Index']
    };

    return labels[position] || [];
}

/**
 * Calculate weighted cards score (Yellow=1, Red=3)
 * @param {number} yellow - Yellow cards
 * @param {number} red - Red cards
 * @returns {number} - Weighted card score
 */
function calculateWeightedCards(yellow, red) {
    return yellow + (red * 3);
}

/**
 * Get player stats for Full Season from bootstrap data
 * @param {object} player - Player object from bootstrap-static
 * @param {number} currentGw - Current gameweek number
 * @returns {object} - Player stats
 */
function getSeasonRadarStats(player, currentGw) {
    return {
        goals: parseInt(player.goals_scored || 0),
        assists: parseInt(player.assists || 0),
        minutes: parseInt(player.minutes || 0),
        yellowCards: parseInt(player.yellow_cards || 0),
        redCards: parseInt(player.red_cards || 0),
        cleanSheets: parseInt(player.clean_sheets || 0),
        bps: parseInt(player.bps || 0),
        ictIndex: parseFloat(player.ict_index || 0),
        saves: parseInt(player.saves || 0),
        goalsConceded: parseInt(player.goals_conceded || 0),
        penaltiesSaved: parseInt(player.penalties_saved || 0),
        totalGw: currentGw
    };
}

/**
 * Get player stats for a gameweek range from history data
 * @param {object} playerHistory - Player history from element-summary
 * @param {number} startGw - Start gameweek
 * @param {number} endGw - End gameweek
 * @returns {object} - Player stats for range
 */
function getRangeRadarStats(playerHistory, startGw, endGw) {
    if (!playerHistory || !playerHistory.history) {
        return null;
    }

    const rangeData = playerHistory.history.filter(gw =>
        gw.round >= startGw && gw.round <= endGw
    );

    const stats = {
        goals: 0,
        assists: 0,
        minutes: 0,
        yellowCards: 0,
        redCards: 0,
        cleanSheets: 0,
        bps: 0,
        ictIndex: 0,
        saves: 0,
        goalsConceded: 0,
        penaltiesSaved: 0,
        gamesPlayed: 0,
        totalGw: endGw - startGw + 1
    };

    rangeData.forEach(gw => {
        stats.goals += gw.goals_scored || 0;
        stats.assists += gw.assists || 0;
        stats.minutes += gw.minutes || 0;
        stats.yellowCards += gw.yellow_cards || 0;
        stats.redCards += gw.red_cards || 0;
        stats.cleanSheets += gw.clean_sheets || 0;
        stats.bps += gw.bps || 0;
        stats.ictIndex += parseFloat(gw.ict_index || 0);
        stats.saves += gw.saves || 0;
        stats.goalsConceded += gw.goals_conceded || 0;
        stats.penaltiesSaved += gw.penalties_saved || 0;

        if (gw.minutes > 0) {
            stats.gamesPlayed++;
        }
    });

    return stats;
}

/**
 * Find position max and min for each stat (SEASON DATA)
 * @param {array} allPlayers - All players from bootstrap-static
 * @param {number} position - Position to analyze
 * @param {number} currentGw - Current gameweek
 * @returns {object} - Max and min values for each stat
 */
function getPositionMaxMin(allPlayers, position, currentGw) {
    const positionPlayers = allPlayers.filter(p => p.element_type === position);

    const maxMin = {
        goals: { max: 0, min: Infinity },
        assists: { max: 0, min: Infinity },
        minsPerGame: { max: 0, min: Infinity },
        weightedCards: { max: 0, min: Infinity },
        cleanSheets: { max: 0, min: Infinity },
        bps: { max: 0, min: Infinity },
        ictIndex: { max: 0, min: Infinity },
        saves: { max: 0, min: Infinity },
        goalsConceded: { max: 0, min: Infinity },
        penaltiesSaved: { max: 0, min: Infinity },
        pctGamesPlayed: { max: 0, min: Infinity }
    };

    positionPlayers.forEach(player => {
        const stats = getSeasonRadarStats(player, currentGw);
        const gamesPlayed = stats.minutes > 0 ? Math.ceil(stats.minutes / 90) : 1; // Estimate games played
        const minsPerGame = gamesPlayed > 0 ? stats.minutes / gamesPlayed : 0;
        const weightedCards = calculateWeightedCards(stats.yellowCards, stats.redCards);
        const pctGamesPlayed = (gamesPlayed / stats.totalGw) * 100;

        // Update max/min
        maxMin.goals.max = Math.max(maxMin.goals.max, stats.goals);
        maxMin.goals.min = Math.min(maxMin.goals.min, stats.goals);

        maxMin.assists.max = Math.max(maxMin.assists.max, stats.assists);
        maxMin.assists.min = Math.min(maxMin.assists.min, stats.assists);

        maxMin.minsPerGame.max = Math.max(maxMin.minsPerGame.max, minsPerGame);
        maxMin.minsPerGame.min = Math.min(maxMin.minsPerGame.min, minsPerGame);

        maxMin.weightedCards.max = Math.max(maxMin.weightedCards.max, weightedCards);
        maxMin.weightedCards.min = Math.min(maxMin.weightedCards.min, weightedCards);

        maxMin.cleanSheets.max = Math.max(maxMin.cleanSheets.max, stats.cleanSheets);
        maxMin.cleanSheets.min = Math.min(maxMin.cleanSheets.min, stats.cleanSheets);

        maxMin.bps.max = Math.max(maxMin.bps.max, stats.bps);
        maxMin.bps.min = Math.min(maxMin.bps.min, stats.bps);

        maxMin.ictIndex.max = Math.max(maxMin.ictIndex.max, stats.ictIndex);
        maxMin.ictIndex.min = Math.min(maxMin.ictIndex.min, stats.ictIndex);

        maxMin.saves.max = Math.max(maxMin.saves.max, stats.saves);
        maxMin.saves.min = Math.min(maxMin.saves.min, stats.saves);

        maxMin.goalsConceded.max = Math.max(maxMin.goalsConceded.max, stats.goalsConceded);
        maxMin.goalsConceded.min = Math.min(maxMin.goalsConceded.min, stats.goalsConceded);

        maxMin.penaltiesSaved.max = Math.max(maxMin.penaltiesSaved.max, stats.penaltiesSaved);
        maxMin.penaltiesSaved.min = Math.min(maxMin.penaltiesSaved.min, stats.penaltiesSaved);

        maxMin.pctGamesPlayed.max = Math.max(maxMin.pctGamesPlayed.max, pctGamesPlayed);
        maxMin.pctGamesPlayed.min = Math.min(maxMin.pctGamesPlayed.min, pctGamesPlayed);
    });

    return maxMin;
}

/**
 * Find position max and min for each stat using RANGE DATA from backend cache
 * @param {number} position - Position to analyze
 * @param {number} startGw - Start gameweek
 * @param {number} endGw - End gameweek
 * @returns {Promise<object>} - Max and min values for each stat based on range
 */
async function getPositionMaxMinFromCache(position, startGw, endGw) {
    try {
        // Fetch player data cache from backend
        const playerDataCache = await getPlayerDataCache();
        if (!playerDataCache || !playerDataCache.bootstrap || !playerDataCache.player_histories) {
            console.warn('Backend cache not available, falling back to season stats');
            return null;
        }

        const allPlayers = playerDataCache.bootstrap.elements;
        const positionPlayers = allPlayers.filter(p => p.element_type === position);

        const maxMin = {
            goals: { max: 0, min: Infinity },
            assists: { max: 0, min: Infinity },
            minsPerGame: { max: 0, min: Infinity },
            weightedCards: { max: 0, min: Infinity },
            cleanSheets: { max: 0, min: Infinity },
            bps: { max: 0, min: Infinity },
            ictIndex: { max: 0, min: Infinity },
            saves: { max: 0, min: Infinity },
            goalsConceded: { max: 0, min: Infinity },
            penaltiesSaved: { max: 0, min: Infinity },
            pctGamesPlayed: { max: 0, min: Infinity }
        };

        // Calculate stats for each player in the position
        positionPlayers.forEach(player => {
            const playerHistory = playerDataCache.player_histories[player.id];
            if (!playerHistory) return;

            const rangeStats = getRangeRadarStats(playerHistory, startGw, endGw);
            if (!rangeStats) return;

            const gamesPlayed = rangeStats.gamesPlayed || 1;
            const minsPerGame = gamesPlayed > 0 ? rangeStats.minutes / gamesPlayed : 0;
            const weightedCards = calculateWeightedCards(rangeStats.yellowCards, rangeStats.redCards);
            const pctGamesPlayed = (gamesPlayed / rangeStats.totalGw) * 100;

            // Update max/min
            maxMin.goals.max = Math.max(maxMin.goals.max, rangeStats.goals);
            maxMin.goals.min = Math.min(maxMin.goals.min, rangeStats.goals);

            maxMin.assists.max = Math.max(maxMin.assists.max, rangeStats.assists);
            maxMin.assists.min = Math.min(maxMin.assists.min, rangeStats.assists);

            maxMin.minsPerGame.max = Math.max(maxMin.minsPerGame.max, minsPerGame);
            maxMin.minsPerGame.min = Math.min(maxMin.minsPerGame.min, minsPerGame);

            maxMin.weightedCards.max = Math.max(maxMin.weightedCards.max, weightedCards);
            maxMin.weightedCards.min = Math.min(maxMin.weightedCards.min, weightedCards);

            maxMin.cleanSheets.max = Math.max(maxMin.cleanSheets.max, rangeStats.cleanSheets);
            maxMin.cleanSheets.min = Math.min(maxMin.cleanSheets.min, rangeStats.cleanSheets);

            maxMin.bps.max = Math.max(maxMin.bps.max, rangeStats.bps);
            maxMin.bps.min = Math.min(maxMin.bps.min, rangeStats.bps);

            maxMin.ictIndex.max = Math.max(maxMin.ictIndex.max, rangeStats.ictIndex);
            maxMin.ictIndex.min = Math.min(maxMin.ictIndex.min, rangeStats.ictIndex);

            maxMin.saves.max = Math.max(maxMin.saves.max, rangeStats.saves);
            maxMin.saves.min = Math.min(maxMin.saves.min, rangeStats.saves);

            maxMin.goalsConceded.max = Math.max(maxMin.goalsConceded.max, rangeStats.goalsConceded);
            maxMin.goalsConceded.min = Math.min(maxMin.goalsConceded.min, rangeStats.goalsConceded);

            maxMin.penaltiesSaved.max = Math.max(maxMin.penaltiesSaved.max, rangeStats.penaltiesSaved);
            maxMin.penaltiesSaved.min = Math.min(maxMin.penaltiesSaved.min, rangeStats.penaltiesSaved);

            maxMin.pctGamesPlayed.max = Math.max(maxMin.pctGamesPlayed.max, pctGamesPlayed);
            maxMin.pctGamesPlayed.min = Math.min(maxMin.pctGamesPlayed.min, pctGamesPlayed);
        });

        console.log(`📊 Calculated range-based max/min for position ${position} (GW${startGw}-${endGw})`);
        return maxMin;

    } catch (error) {
        console.error('Error fetching range-based max/min:', error);
        return null;
    }
}

/**
 * Normalize a stat value to 0-100 scale
 * @param {number} value - Actual value
 * @param {number} max - Maximum value in position
 * @param {number} min - Minimum value in position
 * @param {boolean} inverted - Whether lower is better (cards, goals conceded)
 * @returns {number} - Normalized value (0-100)
 */
function normalizeStat(value, max, min, inverted = false) {
    if (max === 0 || max === min) {
        return inverted ? 100 : 0;
    }

    if (inverted) {
        // Lower is better - invert the scale
        // Player with min value gets 100, player with max gets 0
        return ((max - value) / (max - min)) * 100;
    } else {
        // Higher is better - normal scale
        return (value / max) * 100;
    }
}

/**
 * Get normalized radar data for a player
 * @param {object} player - Player from bootstrap-static
 * @param {array} allPlayers - All players for finding position max/min
 * @param {string} range - 'season', '5gw', or '10gw'
 * @param {number} currentGw - Current gameweek
 * @param {object} playerHistory - Player history (only needed for ranges)
 * @returns {object} - { labels: [], data: [], rawValues: {} }
 */
async function calculateRadarData(player, allPlayers, range, currentGw, playerHistory = null) {
    const position = player.element_type;

    // Get player stats based on range
    let playerStats;
    let startGw, endGw;

    if (range === 'season') {
        playerStats = getSeasonRadarStats(player, currentGw);
    } else {
        // Calculate range
        if (range === '5gw') {
            startGw = Math.max(1, currentGw - 4);
            endGw = currentGw;
        } else if (range === '10gw') {
            startGw = Math.max(1, currentGw - 9);
            endGw = currentGw;
        }

        playerStats = getRangeRadarStats(playerHistory, startGw, endGw);
        if (!playerStats) {
            return null;
        }
    }

    // Get position max/min
    // For season: use bootstrap stats (fast, no API calls needed)
    // For ranges: use backend cache for accurate range-based normalization
    let maxMin;

    if (range === 'season') {
        maxMin = getPositionMaxMin(allPlayers, position, currentGw);
    } else {
        // Try to get range-based max/min from backend cache
        maxMin = await getPositionMaxMinFromCache(position, startGw, endGw);

        // Fallback to season stats if backend cache unavailable
        if (!maxMin) {
            console.warn(`Using season stats as fallback for ${range} normalization`);
            maxMin = getPositionMaxMin(allPlayers, position, currentGw);
        }
    }

    // Calculate derived stats
    const gamesPlayed = playerStats.gamesPlayed || (playerStats.minutes > 0 ? Math.ceil(playerStats.minutes / 90) : 1);
    const minsPerGame = gamesPlayed > 0 ? playerStats.minutes / gamesPlayed : 0;
    const weightedCards = calculateWeightedCards(playerStats.yellowCards, playerStats.redCards);
    const pctGamesPlayed = (gamesPlayed / playerStats.totalGw) * 100;

    // Build radar data based on position
    const labels = getRadarLabels(position);
    let data = [];
    let rawValues = {};

    switch (position) {
        case 1: // GKP
            rawValues = [
                `${playerStats.cleanSheets} clean sheets`,
                `${playerStats.saves} saves`,
                `${playerStats.bps} BPS`,
                `${weightedCards} cards`,
                `${pctGamesPlayed.toFixed(1)}%`,
                `${playerStats.goalsConceded} goals conceded`,
                `${playerStats.penaltiesSaved} penalties saved`
            ];
            data = [
                normalizeStat(playerStats.cleanSheets, maxMin.cleanSheets.max, maxMin.cleanSheets.min),
                normalizeStat(playerStats.saves, maxMin.saves.max, maxMin.saves.min),
                normalizeStat(playerStats.bps, maxMin.bps.max, maxMin.bps.min),
                normalizeStat(weightedCards, maxMin.weightedCards.max, maxMin.weightedCards.min, true), // Inverted
                normalizeStat(pctGamesPlayed, maxMin.pctGamesPlayed.max, maxMin.pctGamesPlayed.min),
                normalizeStat(playerStats.goalsConceded, maxMin.goalsConceded.max, maxMin.goalsConceded.min, true), // Inverted
                normalizeStat(playerStats.penaltiesSaved, maxMin.penaltiesSaved.max, maxMin.penaltiesSaved.min)
            ];
            break;

        case 2: // DEF
        case 3: // MID
            rawValues = [
                `${playerStats.goals} goals`,
                `${playerStats.assists} assists`,
                `${minsPerGame.toFixed(1)} mins/game`,
                `${weightedCards} cards`,
                `${playerStats.cleanSheets} clean sheets`,
                `${playerStats.bps} BPS`,
                `${playerStats.ictIndex.toFixed(1)} ICT`
            ];
            data = [
                normalizeStat(playerStats.goals, maxMin.goals.max, maxMin.goals.min),
                normalizeStat(playerStats.assists, maxMin.assists.max, maxMin.assists.min),
                normalizeStat(minsPerGame, maxMin.minsPerGame.max, maxMin.minsPerGame.min),
                normalizeStat(weightedCards, maxMin.weightedCards.max, maxMin.weightedCards.min, true), // Inverted
                normalizeStat(playerStats.cleanSheets, maxMin.cleanSheets.max, maxMin.cleanSheets.min),
                normalizeStat(playerStats.bps, maxMin.bps.max, maxMin.bps.min),
                normalizeStat(playerStats.ictIndex, maxMin.ictIndex.max, maxMin.ictIndex.min)
            ];
            break;

        case 4: // FWD
            rawValues = [
                `${playerStats.goals} goals`,
                `${playerStats.assists} assists`,
                `${minsPerGame.toFixed(1)} mins/game`,
                `${weightedCards} cards`,
                `${playerStats.bps} BPS`,
                `${playerStats.ictIndex.toFixed(1)} ICT`
            ];
            data = [
                normalizeStat(playerStats.goals, maxMin.goals.max, maxMin.goals.min),
                normalizeStat(playerStats.assists, maxMin.assists.max, maxMin.assists.min),
                normalizeStat(minsPerGame, maxMin.minsPerGame.max, maxMin.minsPerGame.min),
                normalizeStat(weightedCards, maxMin.weightedCards.max, maxMin.weightedCards.min, true), // Inverted
                normalizeStat(playerStats.bps, maxMin.bps.max, maxMin.bps.min),
                normalizeStat(playerStats.ictIndex, maxMin.ictIndex.max, maxMin.ictIndex.min)
            ];
            break;
    }

    return {
        labels,
        data,
        rawValues
    };
}
