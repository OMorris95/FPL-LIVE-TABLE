// League Stats Page - Captain analytics, ownership, chip tracking

async function renderLeagueStatsPage(leagueId) {
    const app = document.getElementById('app');
    const nav = document.getElementById('main-nav');

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

        // Update nav with league name
        document.getElementById('nav-league-name').textContent = leagueData.league.name;

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
            chipStats
        );

    } catch (error) {
        console.error('Error loading league stats:', error);
        app.innerHTML = `
            <div class="card text-center">
                <h2 style="color: var(--rank-down);">Error Loading League Stats</h2>
                <p>${error.message}</p>
                <button class="btn-primary" onclick="router.navigate('/')">Go to Home</button>
            </div>
        `;
    }

    // Change league button handler
    document.getElementById('nav-change-league').addEventListener('click', () => {
        router.navigate('/');
    });
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

function renderLeagueStats(leagueName, gameweek, captainStats, ownershipStats, chipStats) {
    const app = document.getElementById('app');

    app.innerHTML = `
        <div class="league-stats-container">
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">${leagueName} - Statistics GW ${gameweek}</h2>
                </div>

                <!-- Captain Analytics -->
                <div class="stats-section mb-2">
                    <h3 style="color: var(--secondary-color); margin-bottom: 1rem;">
                        👤 Captain Picks
                    </h3>
                    <div class="grid-2">
                        <div>
                            <h4 style="color: #aaa; margin-bottom: 0.5rem;">Most Captained</h4>
                            <div style="overflow-x: auto;">
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
                            <h4 style="color: #aaa; margin-bottom: 0.5rem;">Captain Distribution</h4>
                            ${renderCaptainDistribution(captainStats)}
                        </div>
                    </div>
                </div>

                <!-- Ownership Stats -->
                <div class="stats-section mb-2">
                    <h3 style="color: var(--secondary-color); margin-bottom: 1rem;">
                        📊 Ownership Statistics
                    </h3>
                    <div class="grid-2">
                        <div>
                            <h4 style="color: #aaa; margin-bottom: 0.5rem;">Most Owned Players</h4>
                            <div style="overflow-x: auto;">
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
                            <h4 style="color: #aaa; margin-bottom: 0.5rem;">Differentials (Low Ownership)</h4>
                            <div style="overflow-x: auto;">
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
                    <h3 style="color: var(--secondary-color); margin-bottom: 1rem;">
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
        return '<p style="color: #aaa;">No captain data available</p>';
    }

    const top5 = captainStats.slice(0, 5);
    const maxCount = Math.max(...top5.map(c => c.count));

    return `
        <div style="margin-top: 1rem;">
            ${top5.map(captain => {
                const percentage = (captain.count / maxCount * 100);
                return `
                    <div style="margin-bottom: 1rem;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                            <span style="font-size: 0.9rem;">${captain.webName}</span>
                            <span style="font-size: 0.9rem; color: var(--secondary-color);">${captain.count}</span>
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
            <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">${abbrev}</div>
            <div class="stat-value" style="color: ${color};">${count}</div>
            <div class="stat-label">${fullName}</div>
            ${count > 0 ? `
                <div style="margin-top: 1rem; text-align: left; font-size: 0.85rem; color: #aaa;">
                    ${managers.map(m => `<div>• ${m}</div>`).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

// Register route
router.addRoute('/league-stats', renderLeagueStatsPage);
