// Dream Team Logic
// Port of Discord bot's dreamteam functionality

/**
 * Finds the optimal 11 players following FPL formation rules
 * @param {object} allSquadPlayers - Map of player ID to player data with points, goals, assists, etc.
 * @returns {object} - Object with bestTeam array and bestFormation string
 */
function findOptimalDreamteam(allSquadPlayers) {
    // Separate players by position
    const goalkeepers = [];
    const defenders = [];
    const midfielders = [];
    const forwards = [];

    for (const [playerId, playerData] of Object.entries(allSquadPlayers)) {
        const elementType = playerData.element_type;
        // Create sorting key: points (desc), goals (desc), assists (desc), minutes (desc)
        const sortKey = {
            points: -playerData.points,
            goals: -playerData.goals,
            assists: -playerData.assists,
            minutes: -playerData.minutes
        };

        const playerEntry = { id: parseInt(playerId), sortKey };

        if (elementType === 1) {  // GK
            goalkeepers.push(playerEntry);
        } else if (elementType === 2) {  // DEF
            defenders.push(playerEntry);
        } else if (elementType === 3) {  // MID
            midfielders.push(playerEntry);
        } else if (elementType === 4) {  // FWD
            forwards.push(playerEntry);
        }
    }

    // Sort each position by the tie-breaking criteria
    const sortPlayers = (a, b) => {
        if (a.sortKey.points !== b.sortKey.points) return a.sortKey.points - b.sortKey.points;
        if (a.sortKey.goals !== b.sortKey.goals) return a.sortKey.goals - b.sortKey.goals;
        if (a.sortKey.assists !== b.sortKey.assists) return a.sortKey.assists - b.sortKey.assists;
        return a.sortKey.minutes - b.sortKey.minutes;
    };

    goalkeepers.sort(sortPlayers);
    defenders.sort(sortPlayers);
    midfielders.sort(sortPlayers);
    forwards.sort(sortPlayers);

    // Must have at least 1 GK, 3 DEF, 3 MID, 1 FWD
    if (goalkeepers.length < 1 || defenders.length < 3 ||
        midfielders.length < 3 || forwards.length < 1) {
        return { bestTeam: null, bestFormation: null };
    }

    // Try all valid formations and find the one with highest total points
    let bestTeam = null;
    let bestPoints = -1;
    let bestFormation = null;

    // Valid formations: (def_count, mid_count, fwd_count)
    // Must sum to 10 (plus 1 GK = 11 total)
    const validFormations = [
        [3, 5, 2], [3, 4, 3], [4, 5, 1], [4, 4, 2],
        [4, 3, 3], [5, 4, 1], [5, 3, 2]
    ];

    for (const [defCount, midCount, fwdCount] of validFormations) {
        // Check if we have enough players for this formation
        if (defCount <= defenders.length &&
            midCount <= midfielders.length &&
            fwdCount <= forwards.length) {

            // Build team for this formation
            const team = [];
            team.push(goalkeepers[0].id);  // Best GK

            // Add best players for each position
            for (let i = 0; i < defCount; i++) {
                team.push(defenders[i].id);
            }
            for (let i = 0; i < midCount; i++) {
                team.push(midfielders[i].id);
            }
            for (let i = 0; i < fwdCount; i++) {
                team.push(forwards[i].id);
            }

            // Calculate total points for this formation
            const totalPoints = team.reduce((sum, pid) => {
                return sum + (allSquadPlayers[pid]?.points || 0);
            }, 0);

            if (totalPoints > bestPoints) {
                bestPoints = totalPoints;
                bestTeam = team;
                bestFormation = `${defCount}-${midCount}-${fwdCount}`;
            }
        }
    }

    return { bestTeam, bestFormation, totalPoints: bestPoints };
}

/**
 * Finds the Player of the Week from the dream team
 * @param {array} dreamTeam - Array of player IDs in the dream team
 * @param {object} allSquadPlayers - Map of player ID to player data
 * @returns {object} - Player of the week data
 */
function findPlayerOfTheWeek(dreamTeam, allSquadPlayers) {
    if (!dreamTeam || dreamTeam.length === 0) return null;

    let playerOfWeek = null;
    let maxScore = -1;

    for (const playerId of dreamTeam) {
        const playerData = allSquadPlayers[playerId];
        if (!playerData) continue;

        // Score by points (primary), then goals, assists, minutes
        const score = playerData.points * 1000000 +
                     playerData.goals * 10000 +
                     playerData.assists * 100 +
                     playerData.minutes;

        if (score > maxScore) {
            maxScore = score;
            playerOfWeek = playerData;
        }
    }

    return playerOfWeek;
}

/**
 * Fetches all unique players from league managers' squads for a gameweek
 * @param {object} leagueData - League standings data
 * @param {number} gameweekId - Gameweek ID
 * @param {object} playerMap - Map of player ID to player object
 * @param {object} liveData - Live gameweek data
 * @returns {Promise<object>} - Map of player ID to player data with stats
 */
async function getAllSquadPlayers(leagueData, gameweekId, playerMap, liveData) {
    const allSquadPlayers = {};
    const liveStatsMap = {};

    // Create map of live stats
    liveData.elements.forEach(player => {
        liveStatsMap[player.id] = player.stats;
    });

    // Fetch all managers' picks in parallel
    const managers = leagueData.standings.results;
    const picksPromises = managers.map(manager =>
        getManagerPicks(manager.entry, gameweekId)
    );

    const allPicksData = await Promise.all(picksPromises);

    // Process each manager's picks
    allPicksData.forEach(picksData => {
        if (!picksData || !picksData.picks) return;

        picksData.picks.forEach(pick => {
            const playerId = pick.element;

            // Only add each player once
            if (!allSquadPlayers[playerId]) {
                const player = playerMap[playerId];
                const playerStats = liveStatsMap[playerId] || {};

                allSquadPlayers[playerId] = {
                    id: playerId,
                    element_type: player.element_type,
                    points: playerStats.total_points || 0,
                    goals: playerStats.goals_scored || 0,
                    assists: playerStats.assists || 0,
                    minutes: playerStats.minutes || 0,
                    clean_sheets: playerStats.clean_sheets || 0,
                    bonus: playerStats.bonus || 0,
                    player_info: player
                };
            }
        });
    });

    return allSquadPlayers;
}

/**
 * Arranges dream team players by position for display
 * @param {array} dreamTeam - Array of player IDs
 * @param {object} allSquadPlayers - Map of player ID to player data
 * @returns {object} - Object with players organized by position
 */
function arrangeDreamTeamByPosition(dreamTeam, allSquadPlayers) {
    const positions = {
        goalkeepers: [],
        defenders: [],
        midfielders: [],
        forwards: []
    };

    dreamTeam.forEach(playerId => {
        const playerData = allSquadPlayers[playerId];
        if (!playerData) return;

        const elementType = playerData.element_type;
        const playerDisplay = {
            id: playerId,
            name: playerData.player_info.web_name,
            fullName: `${playerData.player_info.first_name} ${playerData.player_info.second_name}`,
            team: playerData.player_info.team,
            points: playerData.points,
            goals: playerData.goals,
            assists: playerData.assists,
            minutes: playerData.minutes,
            clean_sheets: playerData.clean_sheets,
            bonus: playerData.bonus
        };

        if (elementType === 1) {
            positions.goalkeepers.push(playerDisplay);
        } else if (elementType === 2) {
            positions.defenders.push(playerDisplay);
        } else if (elementType === 3) {
            positions.midfielders.push(playerDisplay);
        } else if (elementType === 4) {
            positions.forwards.push(playerDisplay);
        }
    });

    return positions;
}
