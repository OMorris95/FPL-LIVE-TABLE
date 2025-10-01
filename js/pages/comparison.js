// Manager Comparison Page - Head-to-head analysis

async function renderComparisonPage(leagueId) {
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
            <p class="loading-text">Loading managers...</p>
        </div>
    `;

    try {
        // Fetch data
        const leagueData = await getLeagueData(leagueId);
        if (!leagueData) {
            throw new Error('Could not fetch league data');
        }

        // Update nav with league name
        document.getElementById('nav-league-name').textContent = leagueData.league.name;

        // Render manager selection
        renderManagerSelection(leagueData);

    } catch (error) {
        console.error('Error loading comparison page:', error);
        app.innerHTML = `
            <div class="card text-center">
                <h2 style="color: var(--rank-down);">Error Loading Comparison</h2>
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

function renderManagerSelection(leagueData) {
    const app = document.getElementById('app');
    const managers = leagueData.standings.results;

    app.innerHTML = `
        <div class="comparison-container">
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Manager Comparison</h2>
                </div>

                <div class="grid-2 mb-2">
                    <div class="form-group">
                        <label class="form-label" for="manager1-select">Manager 1</label>
                        <select id="manager1-select" class="form-input">
                            <option value="">Select a manager...</option>
                            ${managers.map(m => `
                                <option value="${m.entry}">${m.player_name} (${m.entry_name})</option>
                            `).join('')}
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="manager2-select">Manager 2</label>
                        <select id="manager2-select" class="form-input">
                            <option value="">Select a manager...</option>
                            ${managers.map(m => `
                                <option value="${m.entry}">${m.player_name} (${m.entry_name})</option>
                            `).join('')}
                        </select>
                    </div>
                </div>

                <button id="compare-btn" class="btn-primary" disabled>
                    Compare Managers
                </button>
            </div>

            <div id="comparison-results"></div>
        </div>
    `;

    // Add event listeners
    const manager1Select = document.getElementById('manager1-select');
    const manager2Select = document.getElementById('manager2-select');
    const compareBtn = document.getElementById('compare-btn');

    const checkSelections = () => {
        const manager1 = manager1Select.value;
        const manager2 = manager2Select.value;
        compareBtn.disabled = !manager1 || !manager2 || manager1 === manager2;
    };

    manager1Select.addEventListener('change', checkSelections);
    manager2Select.addEventListener('change', checkSelections);

    compareBtn.addEventListener('click', async () => {
        const manager1Id = parseInt(manager1Select.value);
        const manager2Id = parseInt(manager2Select.value);

        await compareManagers(manager1Id, manager2Id, leagueData);
    });
}

async function compareManagers(manager1Id, manager2Id, leagueData) {
    const resultsDiv = document.getElementById('comparison-results');

    resultsDiv.innerHTML = `
        <div class="text-center mt-2">
            <div class="spinner"></div>
            <p class="loading-text">Comparing managers...</p>
        </div>
    `;

    try {
        const bootstrapData = await getBootstrapData();
        const currentGw = getCurrentGameweek(bootstrapData);
        const playerMap = createPlayerMap(bootstrapData);

        // Fetch both managers' data
        const [
            manager1History,
            manager2History,
            manager1Picks,
            manager2Picks
        ] = await Promise.all([
            getManagerHistory(manager1Id),
            getManagerHistory(manager2Id),
            getManagerPicks(manager1Id, currentGw),
            getManagerPicks(manager2Id, currentGw)
        ]);

        const manager1Info = leagueData.standings.results.find(m => m.entry === manager1Id);
        const manager2Info = leagueData.standings.results.find(m => m.entry === manager2Id);

        // Analyze squad overlap
        const squadOverlap = analyzeSquadOverlap(manager1Picks, manager2Picks, playerMap);

        // Render comparison results
        renderComparisonResults(
            manager1Info,
            manager2Info,
            manager1History,
            manager2History,
            manager1Picks,
            manager2Picks,
            squadOverlap,
            currentGw,
            playerMap  // Pass playerMap for captain names
        );

    } catch (error) {
        console.error('Error comparing managers:', error);
        resultsDiv.innerHTML = `
            <div class="card text-center">
                <h2 style="color: var(--rank-down);">Error</h2>
                <p>${error.message}</p>
            </div>
        `;
    }
}

function analyzeSquadOverlap(picks1, picks2, playerMap) {
    const squad1 = new Set(picks1.picks.map(p => p.element));
    const squad2 = new Set(picks2.picks.map(p => p.element));

    const sharedPlayers = [];
    const uniqueToManager1 = [];
    const uniqueToManager2 = [];

    squad1.forEach(playerId => {
        if (squad2.has(playerId)) {
            const player = playerMap[playerId];
            sharedPlayers.push({
                id: playerId,
                name: `${player.first_name} ${player.second_name}`,
                webName: player.web_name
            });
        } else {
            const player = playerMap[playerId];
            uniqueToManager1.push({
                id: playerId,
                name: `${player.first_name} ${player.second_name}`,
                webName: player.web_name
            });
        }
    });

    squad2.forEach(playerId => {
        if (!squad1.has(playerId)) {
            const player = playerMap[playerId];
            uniqueToManager2.push({
                id: playerId,
                name: `${player.first_name} ${player.second_name}`,
                webName: player.web_name
            });
        }
    });

    return {
        shared: sharedPlayers,
        uniqueToManager1,
        uniqueToManager2,
        overlapPercentage: ((sharedPlayers.length / 15) * 100).toFixed(1)
    };
}

function renderComparisonResults(manager1Info, manager2Info, history1, history2, picks1, picks2, overlap, currentGw, playerMap) {
    const resultsDiv = document.getElementById('comparison-results');

    const m1TotalPoints = manager1Info.total;
    const m2TotalPoints = manager2Info.total;

    const m1Rank = manager1Info.rank;
    const m2Rank = manager2Info.rank;

    const m1Captain = picks1.picks.find(p => p.is_captain);
    const m2Captain = picks2.picks.find(p => p.is_captain);

    // Get captain names from playerMap
    const m1CaptainName = m1Captain ? playerMap[m1Captain.element].web_name : 'N/A';
    const m2CaptainName = m2Captain ? playerMap[m2Captain.element].web_name : 'N/A';

    const m1Chip = getChipAbbreviation(picks1.active_chip) || 'None';
    const m2Chip = getChipAbbreviation(picks2.active_chip) || 'None';

    resultsDiv.innerHTML = `
        <div class="card mt-2">
            <h3 style="color: var(--secondary-color); margin-bottom: 1.5rem; text-align: center;">
                Comparison Results
            </h3>

            <!-- Head-to-Head Stats -->
            <div class="grid-2 mb-2">
                <div class="stat-card">
                    <h4 style="color: var(--secondary-color);">${manager1Info.player_name}</h4>
                    <div class="stat-value">${m1TotalPoints}</div>
                    <div class="stat-label">Total Points</div>
                    <div style="margin-top: 1rem; color: #aaa; font-size: 0.9rem;">
                        <div>Rank: ${m1Rank}</div>
                        <div>Team: ${manager1Info.entry_name}</div>
                    </div>
                </div>

                <div class="stat-card">
                    <h4 style="color: var(--secondary-color);">${manager2Info.player_name}</h4>
                    <div class="stat-value">${m2TotalPoints}</div>
                    <div class="stat-label">Total Points</div>
                    <div style="margin-top: 1rem; color: #aaa; font-size: 0.9rem;">
                        <div>Rank: ${m2Rank}</div>
                        <div>Team: ${manager2Info.entry_name}</div>
                    </div>
                </div>
            </div>

            <!-- Points Difference -->
            <div class="card mb-2" style="background: ${m1TotalPoints > m2TotalPoints ? 'rgba(0, 255, 133, 0.1)' : 'rgba(255, 77, 77, 0.1)'}; text-align: center;">
                <h4 style="font-size: 1.5rem; margin: 0;">
                    ${m1TotalPoints > m2TotalPoints ? manager1Info.player_name : manager2Info.player_name} leads by ${Math.abs(m1TotalPoints - m2TotalPoints)} points
                </h4>
            </div>

            <!-- Current Gameweek Info -->
            <div class="grid-2 mb-2">
                <div>
                    <h4 style="color: var(--secondary-color); margin-bottom: 1rem;">GW ${currentGw} Details</h4>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Stat</th>
                                <th>${manager1Info.player_name}</th>
                                <th>${manager2Info.player_name}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Captain</td>
                                <td>${m1CaptainName}</td>
                                <td>${m2CaptainName}</td>
                            </tr>
                            <tr>
                                <td>Chip Used</td>
                                <td>${m1Chip}</td>
                                <td>${m2Chip}</td>
                            </tr>
                            <tr>
                                <td>Transfers Cost</td>
                                <td>-${picks1.entry_history.event_transfers_cost}</td>
                                <td>-${picks2.entry_history.event_transfers_cost}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div>
                    <h4 style="color: var(--secondary-color); margin-bottom: 1rem;">Squad Overlap</h4>
                    <div class="stat-card">
                        <div class="stat-value">${overlap.overlapPercentage}%</div>
                        <div class="stat-label">${overlap.shared.length} / 15 Shared Players</div>
                    </div>
                </div>
            </div>

            <!-- Squad Differences -->
            <div class="grid-3">
                <div>
                    <h4 style="color: var(--secondary-color); margin-bottom: 0.5rem;">Shared Players</h4>
                    <div style="background-color: #1f1f1f; padding: 1rem; border-radius: 8px; max-height: 300px; overflow-y: auto;">
                        ${overlap.shared.map(p => `<div style="padding: 0.25rem 0;">• ${p.webName}</div>`).join('')}
                    </div>
                </div>

                <div>
                    <h4 style="color: var(--secondary-color); margin-bottom: 0.5rem;">Only in ${manager1Info.player_name}'s Squad</h4>
                    <div style="background-color: #1f1f1f; padding: 1rem; border-radius: 8px; max-height: 300px; overflow-y: auto;">
                        ${overlap.uniqueToManager1.map(p => `<div style="padding: 0.25rem 0;">• ${p.webName}</div>`).join('')}
                    </div>
                </div>

                <div>
                    <h4 style="color: var(--secondary-color); margin-bottom: 0.5rem;">Only in ${manager2Info.player_name}'s Squad</h4>
                    <div style="background-color: #1f1f1f; padding: 1rem; border-radius: 8px; max-height: 300px; overflow-y: auto;">
                        ${overlap.uniqueToManager2.map(p => `<div style="padding: 0.25rem 0;">• ${p.webName}</div>`).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Register route
router.addRoute('/comparison', renderComparisonPage);
