// Home Page - League Selection or Live Table

let staticData = {};
let liveGameweekId = null;
let currentLeagueData = null;

// Analysis helper functions
function analyzeCaptainPicks(allPicksData, managers, playerMap, liveData) {
    const captainCounts = {};
    const livePointsMap = {};
    liveData.elements.forEach(p => {
        livePointsMap[p.id] = p.stats;
    });

    allPicksData.forEach((picksData, index) => {
        if (!picksData || !picksData.picks) return;

        const captain = picksData.picks.find(p => p.is_captain);
        if (captain) {
            const playerId = captain.element;
            const player = playerMap[playerId];
            const playerName = `${player.first_name} ${player.second_name}`;

            if (!captainCounts[playerId]) {
                captainCounts[playerId] = {
                    id: playerId,
                    name: playerName,
                    webName: player.web_name,
                    count: 0,
                    managers: [],
                    points: livePointsMap[playerId]?.total_points || 0
                };
            }

            captainCounts[playerId].count++;
            captainCounts[playerId].managers.push(managers[index].player_name);
        }
    });

    const captainArray = Object.values(captainCounts);
    captainArray.sort((a, b) => b.count - a.count);
    return captainArray;
}

function analyzeOwnership(allPicksData, managers, playerMap, liveData) {
    const ownershipCounts = {};
    const totalManagers = managers.length;

    allPicksData.forEach((picksData, index) => {
        if (!picksData || !picksData.picks) return;

        picksData.picks.forEach(pick => {
            const playerId = pick.element;
            const player = playerMap[playerId];

            if (!ownershipCounts[playerId]) {
                ownershipCounts[playerId] = {
                    id: playerId,
                    name: `${player.first_name} ${player.second_name}`,
                    webName: player.web_name,
                    team: player.team,
                    position: player.element_type,
                    count: 0,
                    managers: []
                };
            }

            ownershipCounts[playerId].count++;
            ownershipCounts[playerId].managers.push({
                name: managers[index].player_name,
                isStarter: pick.position <= 11
            });
        });
    });

    const ownershipArray = Object.values(ownershipCounts);
    ownershipArray.forEach(item => {
        item.ownershipPercent = ((item.count / totalManagers) * 100).toFixed(1);
    });
    ownershipArray.sort((a, b) => b.count - a.count);

    return {
        topOwned: ownershipArray.slice(0, 10),
        differentials: ownershipArray.filter(p => p.count <= 2).slice(0, 10),
        totalManagers
    };
}

function analyzeChipUsage(allPicksData, managers) {
    const chipUsage = {
        bboost: [],
        '3xc': [],
        freehit: [],
        wildcard: []
    };

    allPicksData.forEach((picksData, index) => {
        if (!picksData) return;
        const chip = picksData.active_chip;
        if (chip && chipUsage[chip]) {
            chipUsage[chip].push(managers[index].player_name);
        }
    });

    return chipUsage;
}


async function renderHomePage(state = {}) {
    const app = document.getElementById('app');
    const nav = document.getElementById('main-nav');

    // Show navigation
    nav.style.display = 'block';

    // Check if we have a stored league ID (from state or router)
    const storedLeagueId = state.leagueId || router.getLeagueId();

    if (storedLeagueId) {
        // Render live table
        await renderHomeWithLiveTable(storedLeagueId);
    } else {
        // Render entry boxes
        renderEntryBoxes();
    }
}

function renderEntryBoxes() {
    const app = document.getElementById('app');

    app.innerHTML = `
        <div class="home-container container-lg pt-lg">
            <div class="grid-2">
                <div class="card card-top">
                    <div class="card-header">
                        <h2 class="card-title">Enter League ID</h2>
                    </div>
                    <form id="league-form">
                        <div class="form-group mb-sm">
                            <input
                                type="number"
                                id="league-id-input"
                                class="form-input form-input-compact"
                                placeholder="e.g., 314"
                                required
                            />
                        </div>

                        <button type="submit" class="btn-primary block">
                            Load League
                        </button>
                    </form>
                </div>

                <div class="card card-top">
                    <div class="card-header">
                        <h2 class="card-title">Enter Manager ID</h2>
                    </div>
                    <form id="manager-form">
                        <div class="form-group mb-sm">
                            <input
                                type="number"
                                id="manager-id-input"
                                class="form-input form-input-compact"
                                placeholder="e.g., 123456"
                                required
                            />
                        </div>

                        <button type="submit" class="btn-primary block">
                            Load Manager Stats
                        </button>
                    </form>
                </div>
            </div>
        </div>
    `;

    // Handle league form submission
    const leagueForm = document.getElementById('league-form');
    leagueForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const leagueId = document.getElementById('league-id-input').value;

        if (leagueId) {
            // Store league ID and reload home page
            router.setLeagueId(leagueId);
            renderHomePage();
        }
    });

    // Handle manager form submission
    const managerForm = document.getElementById('manager-form');
    managerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const managerId = document.getElementById('manager-id-input').value;

        if (managerId) {
            // Store manager ID and navigate to My Stats
            localStorage.setItem('fpl_manager_id', managerId);
            router.navigate('/my-stats');
        }
    });
}

// Render functions for league stats sections
function renderCaptainSection(captainStats, totalManagers) {
    return `
        <div class="grid-2">
            <div>
                <h4 class="subtitle mb-xs">Most Captained</h4>
                <div class="overflow-x-auto">
                    <table class="data-table stats-table">
                        <thead>
                            <tr>
                                <th>Player</th>
                                <th>Count</th>
                                <th>Points</th>
                            </tr>
                        </thead>
                        <tbody id="captain-table-body">
                            ${captainStats.map(captain => `
                                <tr class="stats-row clickable-stats-row" data-player-id="${captain.id}" data-player-type="captain" style="cursor: pointer;">
                                    <td>${captain.name}</td>
                                    <td>${captain.count}</td>
                                    <td>${captain.points}</td>
                                </tr>
                                <tr class="stats-details-row hidden" id="captain-details-${captain.id}">
                                    <td colspan="3">
                                        <div class="details-content"></div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            <div>
                <h4 class="subtitle mb-xs">Captain Distribution</h4>
                ${renderCaptainDistribution(captainStats)}
            </div>
        </div>
    `;
}

function renderOwnershipSection(ownershipStats) {
    return `
        <div class="grid-2">
            <div>
                <h4 class="subtitle mb-xs">Most Owned Players</h4>
                <div class="overflow-x-auto">
                    <table class="data-table stats-table">
                        <thead>
                            <tr>
                                <th>Player</th>
                                <th>Ownership</th>
                            </tr>
                        </thead>
                        <tbody id="ownership-table-body">
                            ${ownershipStats.topOwned.map(player => `
                                <tr class="stats-row clickable-stats-row" data-player-id="${player.id}" data-player-type="ownership" style="cursor: pointer;">
                                    <td>${player.name}</td>
                                    <td>${player.ownershipPercent}% (${player.count}/${ownershipStats.totalManagers})</td>
                                </tr>
                                <tr class="stats-details-row hidden" id="ownership-details-${player.id}">
                                    <td colspan="2">
                                        <div class="details-content"></div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            <div>
                <h4 class="subtitle mb-xs">Differentials (Low Ownership)</h4>
                <div class="overflow-x-auto">
                    <table class="data-table stats-table">
                        <thead>
                            <tr>
                                <th>Player</th>
                                <th>Ownership</th>
                            </tr>
                        </thead>
                        <tbody id="differentials-table-body">
                            ${ownershipStats.differentials.length > 0 ? ownershipStats.differentials.map(player => `
                                <tr class="stats-row clickable-stats-row" data-player-id="${player.id}" data-player-type="differential" style="cursor: pointer;">
                                    <td>${player.name}</td>
                                    <td>${player.ownershipPercent}% (${player.count}/${ownershipStats.totalManagers})</td>
                                </tr>
                                <tr class="stats-details-row hidden" id="differential-details-${player.id}">
                                    <td colspan="2">
                                        <div class="details-content"></div>
                                    </td>
                                </tr>
                            `).join('') : '<tr><td colspan="2">No differentials found</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function renderCaptainDistribution(captainStats) {
    if (captainStats.length === 0) {
        return '<p class="subtitle">No captain data available</p>';
    }

    const top5 = captainStats.slice(0, 5);
    const maxCount = Math.max(...top5.map(c => c.count));

    return `
        <div class="mt-sm">
            ${top5.map(captain => {
                const percentage = (captain.count / maxCount * 100);
                return `
                    <div class="mb-sm">
                        <div class="flex justify-between mb-xs">
                            <span class="text-base-sm">${captain.webName}</span>
                            <span class="text-base-sm" style="color: var(--section-header-color);">${captain.count}</span>
                        </div>
                        <div style="background-color: #333; height: 24px; border-radius: 4px; overflow: hidden;">
                            <div style="background-color: var(--section-header-color); height: 100%; width: ${percentage}%; transition: width 0.3s;"></div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderChipSection(chipStats) {
    return `
        <div class="grid-4">
            ${renderChipCard('Bench Boost', 'BB', chipStats.bboost)}
            ${renderChipCard('Triple Captain', 'TC', chipStats['3xc'])}
            ${renderChipCard('Free Hit', 'FH', chipStats.freehit)}
            ${renderChipCard('Wildcard', 'WC', chipStats.wildcard)}
        </div>
    `;
}

function renderChipCard(fullName, abbrev, managers) {
    const count = managers.length;
    const color = count > 0 ? 'var(--section-header-color)' : '#888';

    return `
        <div class="stat-card" style="padding: 0.75rem;">
            <div style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.25rem;">${abbrev}</div>
            <div class="stat-value" style="color: ${color}; font-size: 1.5rem;">${count}</div>
            <div class="stat-label" style="font-size: 0.75rem;">${fullName}</div>
            ${count > 0 ? `
                <div class="mt-sm text-left text-base-sm subtitle">
                    ${managers.map(m => `<div>• ${m}</div>`).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

// Dream team rendering functions
function renderPlayerOfTheWeekCompact(player, teamMap) {
    const team = teamMap[player.player_info.team];
    const teamName = team ? team.short_name : '';

    return `
        <div style="background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
            <div class="text-center" style="color: #000;">
                <div style="font-size: 0.9rem; font-weight: 700; margin-bottom: 0.5rem;">⭐ PLAYER OF THE WEEK ⭐</div>
                <div style="font-size: 1.5rem; font-weight: 700;">${player.fullName}</div>
                <div style="font-size: 0.9rem; margin-bottom: 0.75rem;">${teamName}</div>
                <div style="display: flex; justify-content: center; gap: 1.5rem; flex-wrap: wrap;">
                    <div>
                        <div style="font-size: 1.5rem; font-weight: 700;">${player.points}</div>
                        <div style="font-size: 0.75rem;">Points</div>
                    </div>
                    <div>
                        <div style="font-size: 1.5rem; font-weight: 700;">${player.goals}</div>
                        <div style="font-size: 0.75rem;">Goals</div>
                    </div>
                    <div>
                        <div style="font-size: 1.5rem; font-weight: 700;">${player.assists}</div>
                        <div style="font-size: 0.75rem;">Assists</div>
                    </div>
                    ${player.clean_sheets > 0 ? `
                        <div>
                            <div style="font-size: 1.5rem; font-weight: 700;">${player.clean_sheets}</div>
                            <div style="font-size: 0.75rem;">Clean Sheets</div>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

function renderFormation(positions, teamMap) {
    const { goalkeepers, defenders, midfielders, forwards } = positions;

    return `
        <div class="formation-row">
            ${forwards.map(p => renderDreamTeamPlayerCard(p, teamMap)).join('')}
        </div>
        <div class="formation-row">
            ${midfielders.map(p => renderDreamTeamPlayerCard(p, teamMap)).join('')}
        </div>
        <div class="formation-row">
            ${defenders.map(p => renderDreamTeamPlayerCard(p, teamMap)).join('')}
        </div>
        <div class="formation-row">
            ${goalkeepers.map(p => renderDreamTeamPlayerCard(p, teamMap)).join('')}
        </div>
    `;
}

function renderDreamTeamPlayerCard(player, teamMap) {
    const team = teamMap[player.team];
    const teamShortName = team ? team.short_name : '';

    return `
        <div class="dream-team-player-card">
            <div class="player-name">${player.name}</div>
            <div class="text-sm text-quaternary">${teamShortName}</div>
            <div class="player-points">${player.points} pts</div>
            <div class="player-stats">
                ${player.goals > 0 ? `G: ${player.goals}` : ''}
                ${player.assists > 0 ? ` A: ${player.assists}` : ''}
                ${player.clean_sheets > 0 ? ` CS: ${player.clean_sheets}` : ''}
            </div>
        </div>
    `;
}

async function renderHomeWithLiveTable(leagueId) {
    const app = document.getElementById('app');

    // Show loading
    app.innerHTML = `
        <div class="text-center mt-2">
            <div class="spinner"></div>
            <p class="loading-text">Fetching live league data...</p>
        </div>
    `;

    try {
        // Fetch data
        staticData = await getBootstrapData();
        liveGameweekId = getCurrentGameweek(staticData);

        if (!liveGameweekId) {
            const nextEvent = staticData.events.find(event => event.is_next);
            if (nextEvent) {
                liveGameweekId = nextEvent.id;
            } else {
                app.innerHTML = `
                    <div class="card text-center">
                        <h2>No Active Gameweek</h2>
                        <p>No current or next gameweek found. Please check back later.</p>
                    </div>
                `;
                return;
            }
        }

        // Fetch only first page (50 managers)
        const leagueData = await getLeagueData(leagueId);
        if (!leagueData || !leagueData.standings || !leagueData.standings.results) {
            throw new Error('Could not fetch league data');
        }

        currentLeagueData = leagueData;

        const liveData = await getLiveGameweekData(liveGameweekId);
        if (!liveData) {
            throw new Error('Could not fetch live data');
        }

        // Calculate live standings
        const livePointsMap = {};
        liveData.elements.forEach(p => {
            livePointsMap[p.id] = p.stats;
        });

        // Fetch manager data in batches to avoid rate limiting
        const managerDataResults = await fetchManagerDataInBatches(leagueData.standings.results, liveGameweekId);

        let managers = managerDataResults.map(result => {
            const { manager: managerInfo, picksData, historyData } = result;

            if (!picksData || !historyData) return null;

            const livePoints = calculateLivePoints(picksData, liveData, liveGameweekId, historyData);

            return {
                id: managerInfo.entry,
                name: managerInfo.player_name,
                teamName: managerInfo.entry_name,
                livePoints: livePoints.liveGwPoints,
                totalPoints: livePoints.liveTotalPoints,
                playersPlayed: livePoints.playersPlayed,
                chip: getChipAbbreviation(livePoints.chip),
                originalRank: managerInfo.rank,
                picksData: picksData
            };
        }).filter(m => m !== null);
        managers.sort((a, b) => b.totalPoints - a.totalPoints);

        // Calculate league statistics
        const allPicksData = managers.map(m => m.picksData);
        const managerList = leagueData.standings.results;
        const playerMap = createPlayerMap(staticData);
        const teamMap = createTeamMap(staticData);

        const captainStats = analyzeCaptainPicks(allPicksData, managerList, playerMap, liveData);
        const ownershipStats = analyzeOwnership(allPicksData, managerList, playerMap, liveData);
        const chipStats = analyzeChipUsage(allPicksData, managerList);

        // Calculate dream team - wrap in try-catch to prevent page crash on large leagues
        let positions = null;
        let playerOfWeek = null;
        let bestFormation = null;
        let totalPoints = 0;
        let dreamTeamInfo = null;

        try {
            // Pass already-fetched picks data to avoid redundant API calls
            const squadPlayersResult = await getAllSquadPlayers(leagueData, liveGameweekId, playerMap, liveData, allPicksData);
            const allSquadPlayers = squadPlayersResult.players;
            dreamTeamInfo = {
                isLimited: squadPlayersResult.isLimited,
                totalManagers: squadPlayersResult.totalManagers,
                managersUsed: squadPlayersResult.managersUsed
            };

            const dreamTeamResult = findOptimalDreamteam(allSquadPlayers);
            bestTeam = dreamTeamResult.bestTeam;
            bestFormation = dreamTeamResult.bestFormation;
            totalPoints = dreamTeamResult.totalPoints;

            playerOfWeek = bestTeam ? findPlayerOfTheWeek(bestTeam, allSquadPlayers) : null;
            positions = bestTeam ? arrangeDreamTeamByPosition(bestTeam, allSquadPlayers) : null;
        } catch (dreamTeamError) {
            console.warn('Could not calculate dream team (likely due to rate limiting):', dreamTeamError);
            // Continue without dream team - page will still show league table and stats
        }

        // Render the live table with stats and dream team (if available)
        const hasMoreManagers = leagueData.standings.has_next || false;
        renderLiveTable(managers, leagueData.league.name, leagueId, captainStats, ownershipStats, chipStats,
                       positions, playerOfWeek, bestFormation, totalPoints, teamMap, dreamTeamInfo, hasMoreManagers);

    } catch (error) {
        console.error('Error loading live table:', error);
        app.innerHTML = `
            <div class="card text-center">
                <h2 class="text-error">Error Loading League</h2>
                <p>${error.message}</p>
                <p>Please check the League ID and try again.</p>
                <button class="btn-primary" onclick="changeLeague()">Try Different League</button>
            </div>
        `;
    }
}

function renderLiveTable(managers, leagueName, leagueId, captainStats, ownershipStats, chipStats,
                        positions, playerOfWeek, bestFormation, totalPoints, teamMap, dreamTeamInfo, hasMoreManagers) {
    const app = document.getElementById('app');

    const lastUpdated = new Date().toLocaleTimeString();

    app.innerHTML = `
        <div class="live-table-container">
            <div class="card card-top">
                <div class="card-header">
                    <div>
                        <h2 class="card-title">GW ${liveGameweekId} Live Table</h2>
                        ${hasMoreManagers ? `
                            <p class="subtitle text-base-sm m-0" style="color: #888;">
                                Based on top 50 managers in league
                            </p>
                        ` : ''}
                    </div>
                    <div class="flex items-center gap-lg flex-wrap">
                        <p class="subtitle m-0">${leagueName}</p>
                        <button class="btn-primary" onclick="router.navigate('/comparison', {leagueId: '${leagueId}'})">
                            Manager Comparison
                        </button>
                        <button id="change-league-btn" class="btn-secondary-small">
                            Change League
                        </button>
                        <p class="subtitle text-base-sm m-0">
                            Last Updated: ${lastUpdated}
                        </p>
                        <button id="refresh-btn" class="btn-secondary">
                            Refresh Points
                        </button>
                    </div>
                </div>

                <div class="overflow-x-auto">
                    <table class="data-table ownership-table">
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Manager</th>
                                <th>Team</th>
                                <th>GW Points</th>
                                <th>Total Points</th>
                                <th>Players Played</th>
                            </tr>
                        </thead>
                        <tbody id="league-body">
                            ${managers.map((manager, index) => {
                                const liveRank = index + 1;
                                const chipHtml = manager.chip ? `<span class="chip-active">${manager.chip}</span>` : '';

                                return `
                                    <tr class="manager-row" data-manager-id="${manager.id}">
                                        <td>${liveRank}</td>
                                        <td>${manager.name}</td>
                                        <td>${manager.teamName}</td>
                                        <td>${manager.livePoints} ${chipHtml}</td>
                                        <td>${manager.totalPoints}</td>
                                        <td>${manager.playersPlayed} / 11</td>
                                    </tr>
                                    <tr class="details-row hidden" id="details-${manager.id}">
                                        <td colspan="6">
                                            <div class="details-content"></div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- League Statistics Section -->
            <div class="card mt-1">
                <div class="card-header">
                    <div>
                        <h2 class="card-title">GW ${liveGameweekId} Statistics</h2>
                        ${hasMoreManagers ? `
                            <p class="subtitle text-base-sm m-0" style="color: #888;">
                                Based on top 50 managers in league
                            </p>
                        ` : ''}
                    </div>
                </div>

                <!-- Captain Analytics -->
                <div class="stats-section mb-2">
                    <h3 class="section-header">👤 Captain Picks</h3>
                    ${renderCaptainSection(captainStats, ownershipStats.totalManagers)}
                </div>

                <!-- Ownership Stats -->
                <div class="stats-section mb-2">
                    <h3 class="section-header">📊 Ownership Statistics</h3>
                    ${renderOwnershipSection(ownershipStats)}
                </div>

                <!-- Chip Usage -->
                <div class="stats-section">
                    <h3 class="section-header">🎴 Chip Usage This Gameweek</h3>
                    ${renderChipSection(chipStats)}
                </div>
            </div>

            <!-- Dream Team Section -->
            ${positions ? `
                <div class="card mt-1">
                    <div class="card-header">
                        <div class="flex items-center justify-between flex-wrap">
                            <div>
                                <h2 class="card-title">GW ${liveGameweekId} Dream Team</h2>
                                ${dreamTeamInfo && dreamTeamInfo.isLimited ? `
                                    <p class="subtitle text-base-sm m-0" style="color: #888;">
                                        Based on top 50 managers in league
                                    </p>
                                ` : ''}
                            </div>
                            <div class="text-right">
                                <p class="text-lg m-0" style="color: var(--section-header-color);">
                                    Formation: ${bestFormation}
                                </p>
                                <p class="text-xl m-0" style="font-weight: 700; color: var(--section-header-color);">
                                    Total: ${totalPoints} pts
                                </p>
                            </div>
                        </div>
                    </div>

                    ${playerOfWeek ? renderPlayerOfTheWeekCompact(playerOfWeek, teamMap) : ''}

                    <div class="pitch-container">
                        ${renderFormation(positions, teamMap)}
                    </div>
                </div>
            ` : ''}
        </div>
    `;

    // Add chip styling
    const style = document.createElement('style');
    style.textContent = `
        .chip-active {
            font-size: 0.8em;
            font-weight: bold;
            color: var(--secondary-color);
            margin-left: 5px;
            background-color: rgba(0, 255, 133, 0.1);
            padding: 2px 5px;
            border-radius: 4px;
        }
        .manager-row {
            cursor: pointer;
        }
        .details-content {
            background-color: #1f1f1f;
            padding: 20px;
            border-radius: 8px;
        }
        .details-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
        }
        .details-section h3 {
            color: var(--secondary-color);
            margin-top: 0;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 5px;
        }
        .player-list {
            list-style: none;
            padding: 0;
        }
        .player-list li {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            border-bottom: 1px solid #333;
        }
        .player-list li:last-child {
            border-bottom: none;
        }
        .player-name { font-weight: bold; }
        .captain-icon { color: yellow; }
        .vice-captain-icon { color: #ccc; }
    `;
    document.head.appendChild(style);

    // Add click handlers for manager rows
    const managerRows = document.querySelectorAll('.manager-row');
    managerRows.forEach(row => {
        row.addEventListener('click', () => {
            const managerId = row.getAttribute('data-manager-id');
            const manager = managers.find(m => m.id === parseInt(managerId));
            if (manager) {
                toggleDetailsRow(manager, row);
            }
        });
    });

    // Add click handlers for stats rows (captain and ownership)
    const statsRows = document.querySelectorAll('.clickable-stats-row');
    statsRows.forEach(row => {
        row.addEventListener('click', () => {
            const playerId = row.getAttribute('data-player-id');
            const playerType = row.getAttribute('data-player-type');
            toggleStatsDetailsRow(playerId, playerType, captainStats, ownershipStats);
        });
    });

    // Add refresh button handler
    document.getElementById('refresh-btn').addEventListener('click', () => {
        renderHomePage();
    });

    // Add change league button handler
    document.getElementById('change-league-btn').addEventListener('click', () => {
        changeLeague();
    });
}

async function toggleDetailsRow(manager, row) {
    const detailsRow = document.getElementById(`details-${manager.id}`);
    const allDetailsRows = document.querySelectorAll('.details-row');

    // If clicking the same row, close it
    if (!detailsRow.classList.contains('hidden')) {
        detailsRow.classList.add('hidden');
        return;
    }

    // Close all other detail rows
    allDetailsRows.forEach(r => r.classList.add('hidden'));

    // Show loading
    detailsRow.classList.remove('hidden');
    detailsRow.querySelector('.details-content').innerHTML = '<p>Loading details...</p>';

    try {
        const liveData = await getLiveGameweekData(liveGameweekId);
        const playerMap = createPlayerMap(staticData);

        const livePointsMap = {};
        liveData.elements.forEach(p => {
            livePointsMap[p.id] = p.stats;
        });

        let startingXIHtml = '';
        let benchHtml = '';

        manager.picksData.picks.forEach(pick => {
            const player = playerMap[pick.element];
            const stats = livePointsMap[pick.element] || {};
            const points = (stats.total_points || 0) * pick.multiplier;
            const minutes = stats.minutes || 0;

            let captaincy = '';
            if (pick.is_captain) captaincy = ' <span class="captain-icon">(C)</span>';
            if (pick.is_vice_captain) captaincy = ' <span class="vice-captain-icon">(V)</span>';

            const playerHtml = `
                <li>
                    <span class="player-name">${player.web_name}${captaincy}</span>
                    <span>Pts: ${points} | Mins: ${minutes}</span>
                </li>
            `;

            if (pick.position <= 11) {
                startingXIHtml += playerHtml;
            } else {
                benchHtml += playerHtml;
            }
        });

        const chip = manager.picksData.active_chip ? manager.picksData.active_chip.replace(/_/g, ' ').toUpperCase() : 'None';
        const transfersCost = manager.picksData.entry_history.event_transfers_cost;

        const contentHtml = `
            <div class="details-grid">
                <div class="details-section">
                    <h3>Starting XI</h3>
                    <ul class="player-list">${startingXIHtml}</ul>
                </div>
                <div class="details-section">
                    <h3>Bench</h3>
                    <ul class="player-list">${benchHtml}</ul>
                </div>
                <div class="details-section">
                    <h3>Gameweek Info</h3>
                    <ul class="player-list">
                        <li><span>Points Hit:</span> <span>-${transfersCost}</span></li>
                        <li><span>Chip Played:</span> <span>${chip}</span></li>
                    </ul>
                </div>
            </div>
        `;

        detailsRow.querySelector('.details-content').innerHTML = contentHtml;

    } catch (error) {
        console.error('Error loading details:', error);
        detailsRow.querySelector('.details-content').innerHTML = '<p>Could not load details.</p>';
    }
}

// Toggle stats details row (for captain and ownership tables)
function toggleStatsDetailsRow(playerId, playerType, captainStats, ownershipStats) {
    const detailsId = `${playerType}-details-${playerId}`;
    const detailsRow = document.getElementById(detailsId);
    const allStatsDetailsRows = document.querySelectorAll('.stats-details-row');

    // If clicking the same row, close it
    if (!detailsRow.classList.contains('hidden')) {
        detailsRow.classList.add('hidden');
        return;
    }

    // Close all other stats detail rows
    allStatsDetailsRows.forEach(r => r.classList.add('hidden'));

    // Show this detail row
    detailsRow.classList.remove('hidden');

    // Find the player data
    let playerData;
    if (playerType === 'captain') {
        playerData = captainStats.find(c => c.id == playerId);
    } else if (playerType === 'ownership') {
        playerData = ownershipStats.topOwned.find(p => p.id == playerId);
    } else if (playerType === 'differential') {
        playerData = ownershipStats.differentials.find(p => p.id == playerId);
    }

    if (!playerData) return;

    // Render the managers list
    let managersHtml;
    if (playerType === 'captain') {
        managersHtml = playerData.managers.map(m => `<li>${m}</li>`).join('');
    } else {
        const starters = playerData.managers.filter(m => m.isStarter);
        const benched = playerData.managers.filter(m => !m.isStarter);

        managersHtml = `
            ${starters.length > 0 ? `
                <div class="mb-sm">
                    <h4 style="color: var(--section-header-color); font-size: 0.9rem; margin-bottom: 0.5rem;">Starting (${starters.length})</h4>
                    <ul class="player-list">
                        ${starters.map(m => `<li><span>${m.name}</span></li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            ${benched.length > 0 ? `
                <div>
                    <h4 style="color: #888; font-size: 0.9rem; margin-bottom: 0.5rem;">Benched (${benched.length})</h4>
                    <ul class="player-list">
                        ${benched.map(m => `<li><span>${m.name}</span></li>`).join('')}
                    </ul>
                </div>
            ` : ''}
        `;
    }

    const contentHtml = `
        <div style="padding: 1rem;">
            <h3 style="color: var(--section-header-color); margin-top: 0;">${playerData.name}</h3>
            <p style="color: #888; margin-bottom: 1rem;">
                ${playerType === 'captain' ? `Captained by ${playerData.count} manager(s)` : `Owned by ${playerData.count} manager(s) (${playerData.ownershipPercent}%)`}
            </p>
            ${playerType === 'captain' ? `<ul class="player-list">${managersHtml}</ul>` : managersHtml}
        </div>
    `;

    detailsRow.querySelector('.details-content').innerHTML = contentHtml;
}

// Global function to change league
window.changeLeague = function() {
    localStorage.removeItem('fpl_league_id');
    router.currentLeagueId = null;
    renderHomePage();
};

// Register home route
router.addRoute('/', renderHomePage);
