// League Stats Page - Captain analytics, ownership, chip tracking

// League navigation buttons helper
function renderLeagueNavButtons(currentPage, leagueId) {
    const buttons = [];

    if (currentPage !== 'table') {
        buttons.push(`<button class="btn-primary" onclick="router.navigate('/', {leagueId: '${leagueId}'})">League Table</button>`);
    }
    if (currentPage !== 'dream-team') {
        buttons.push(`<button class="btn-primary" onclick="router.navigate('/dream-team', {leagueId: '${leagueId}'})">Dream Team</button>`);
    }
    if (currentPage !== 'league-stats') {
        buttons.push(`<button class="btn-primary" onclick="router.navigate('/league-stats', {leagueId: '${leagueId}'})">League Stats</button>`);
    }
    if (currentPage !== 'comparison') {
        buttons.push(`<button class="btn-primary" onclick="router.navigate('/comparison', {leagueId: '${leagueId}'})">Manager Comparison</button>`);
    }

    return `<div class="flex gap-md mb-sm flex-wrap">${buttons.join('')}</div>`;
}

async function renderLeagueStatsPage(state = {}) {
    const app = document.getElementById('app');
    const nav = document.getElementById('main-nav');

    // Extract leagueId from state (backwards compatible)
    const leagueId = state.leagueId || state || router.getLeagueId();

    if (!leagueId) {
        app.innerHTML = `
            <div class="card text-center">
                <h2>No League Selected</h2>
                <p>Please select a league from the home page.</p>
                <button class="btn-primary" onclick="router.navigate('/')">Go to Home</button>
            </div>
        `;
        return;
    }

    // Show navigation
    nav.style.display = 'block';

    // Show loading
    app.innerHTML = `
        <div class="text-center mt-2">
            <div class="spinner"></div>
            <p class="loading-text">Analyzing league statistics...</p>
        </div>
    `;

    try {
        // Fetch data
        const bootstrapData = await getBootstrapData();
        const currentGw = getCurrentGameweek(bootstrapData);

        if (!currentGw) {
            throw new Error('Could not determine current gameweek');
        }

        const leagueData = await getLeagueData(leagueId);
        if (!leagueData) {
            throw new Error('Could not fetch league data');
        }

        const playerMap = createPlayerMap(bootstrapData);
        const liveData = await getLiveGameweekData(currentGw);

        // Fetch all managers' picks
        const managers = leagueData.standings.results;
        const picksPromises = managers.map(manager =>
            getManagerPicks(manager.entry, currentGw)
        );
        const allPicksData = await Promise.all(picksPromises);

        // Analyze captain picks
        const captainStats = analyzeCaptainPicks(allPicksData, managers, playerMap, liveData);

        // Analyze ownership
        const ownershipStats = analyzeOwnership(allPicksData, managers, playerMap, liveData);

        // Analyze chip usage
        const chipStats = analyzeChipUsage(allPicksData, managers);

        // Render the page
        renderLeagueStats(
            leagueData.league.name,
            currentGw,
            captainStats,
            ownershipStats,
            chipStats,
            leagueId
        );

    } catch (error) {
        console.error('Error loading league stats:', error);
        app.innerHTML = `
            <div class="card text-center">
                <h2 class="text-error">Error Loading League Stats</h2>
                <p>${error.message}</p>
                <button class="btn-primary" onclick="router.navigate('/')">Go to Home</button>
            </div>
        `;
    }
}

function analyzeCaptainPicks(allPicksData, managers, playerMap, liveData) {
    const captainCounts = {};
    const captainPoints = {};

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

    // Convert to array and sort by count
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

    // Convert to array and add ownership percentage
    const ownershipArray = Object.values(ownershipCounts);
    ownershipArray.forEach(item => {
        item.ownershipPercent = ((item.count / totalManagers) * 100).toFixed(1);
    });

    // Sort by ownership
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

function renderLeagueStats(leagueName, gameweek, captainStats, ownershipStats, chipStats, leagueId) {
    const app = document.getElementById('app');

    app.innerHTML = `
        <div class="league-stats-container">
            <!-- League Navigation Buttons -->
            ${renderLeagueNavButtons('league-stats', leagueId)}

            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">${leagueName} - Statistics GW ${gameweek}</h2>
                </div>

                <!-- Captain Analytics -->
                <div class="stats-section mb-2">
                    <h3 class="text-secondary mb-sm">
                        👤 Captain Picks
                    </h3>
                    <div class="grid-2">
                        <div>
                            <h4 class="subtitle mb-xs">Most Captained</h4>
                            <div class="overflow-x-auto">
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>Player</th>
                                            <th>Count</th>
                                            <th>Points</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${captainStats.slice(0, 10).map(captain => `
                                            <tr>
                                                <td>${captain.name}</td>
                                                <td>${captain.count}</td>
                                                <td>${captain.points}</td>
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
                </div>

                <!-- Ownership Stats -->
                <div class="stats-section mb-2">
                    <h3 class="text-secondary mb-sm">
                        📊 Ownership Statistics
                    </h3>
                    <div class="grid-2">
                        <div>
                            <h4 class="subtitle mb-xs">Most Owned Players</h4>
                            <div class="overflow-x-auto">
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>Player</th>
                                            <th>Ownership</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${ownershipStats.topOwned.map(player => `
                                            <tr>
                                                <td>${player.name}</td>
                                                <td>${player.ownershipPercent}% (${player.count}/${ownershipStats.totalManagers})</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div>
                            <h4 class="subtitle mb-xs">Differentials (Low Ownership)</h4>
                            <div class="overflow-x-auto">
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>Player</th>
                                            <th>Ownership</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${ownershipStats.differentials.length > 0 ? ownershipStats.differentials.map(player => `
                                            <tr>
                                                <td>${player.name}</td>
                                                <td>${player.ownershipPercent}% (${player.count}/${ownershipStats.totalManagers})</td>
                                            </tr>
                                        `).join('') : '<tr><td colspan="2">No differentials found</td></tr>'}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Chip Usage -->
                <div class="stats-section">
                    <h3 class="text-secondary mb-sm">
                        🎴 Chip Usage This Gameweek
                    </h3>
                    <div class="grid-4">
                        ${renderChipCard('Bench Boost', 'BB', chipStats.bboost)}
                        ${renderChipCard('Triple Captain', 'TC', chipStats['3xc'])}
                        ${renderChipCard('Free Hit', 'FH', chipStats.freehit)}
                        ${renderChipCard('Wildcard', 'WC', chipStats.wildcard)}
                    </div>
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
                            <span class="text-base-sm text-secondary">${captain.count}</span>
                        </div>
                        <div style="background-color: #333; height: 24px; border-radius: 4px; overflow: hidden;">
                            <div style="background-color: var(--secondary-color); height: 100%; width: ${percentage}%; transition: width 0.3s;"></div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderChipCard(fullName, abbrev, managers) {
    const count = managers.length;
    const color = count > 0 ? 'var(--secondary-color)' : '#888';

    return `
        <div class="stat-card">
            <div class="text-3xl mb-xs">${abbrev}</div>
            <div class="stat-value" style="color: ${color};">${count}</div>
            <div class="stat-label">${fullName}</div>
            ${count > 0 ? `
                <div class="mt-sm text-left text-base-sm subtitle">
                    ${managers.map(m => `<div>• ${m}</div>`).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

// Register route
router.addRoute('/league-stats', renderLeagueStatsPage);
