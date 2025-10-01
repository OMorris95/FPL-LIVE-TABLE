// Player Comparison Tool - Compare up to 4 players side-by-side

let selectedPlayers = [];
const MAX_PLAYERS = 4;

async function renderComparePlayersPage(leagueId) {
    const app = document.getElementById('app');
    const nav = document.getElementById('main-nav');

    // Show navigation
    nav.style.display = 'block';

    // Show loading
    app.innerHTML = `
        <div class="text-center mt-2">
            <div class="spinner"></div>
            <p class="loading-text">Loading players...</p>
        </div>
    `;

    try {
        const bootstrapData = await getBootstrapData();
        const currentGw = getCurrentGameweek(bootstrapData);
        const playerMap = createPlayerMap(bootstrapData);
        const teamMap = createTeamMap(bootstrapData);

        // Get all players as array
        const allPlayers = Object.values(playerMap);

        renderComparisonTool(allPlayers, teamMap, currentGw);

    } catch (error) {
        console.error('Error loading comparison tool:', error);
        app.innerHTML = `
            <div class="card text-center">
                <h2 style="color: var(--rank-down);">Error Loading Comparison Tool</h2>
                <p>${error.message}</p>
            </div>
        `;
    }
}

function renderComparisonTool(allPlayers, teamMap, currentGw) {
    const app = document.getElementById('app');

    app.innerHTML = `
        <div class="compare-container">
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Player Comparison Tool</h2>
                    <p style="color: #aaa; margin: 0;">Compare up to ${MAX_PLAYERS} players side-by-side</p>
                </div>

                <!-- Player Search -->
                <div class="mb-1">
                    <input
                        type="text"
                        id="player-search"
                        class="form-input"
                        placeholder="Search for a player to compare..."
                    />
                    <div id="search-results" class="search-results-dropdown"></div>
                </div>

                <!-- Selected Players Cards -->
                <div id="selected-players-container" class="selected-players-grid">
                    ${selectedPlayers.length === 0 ? `
                        <div class="text-center" style="grid-column: 1 / -1; padding: 2rem; color: #888;">
                            <p style="font-size: 1.1rem;">No players selected yet</p>
                            <p>Search and select up to ${MAX_PLAYERS} players to compare</p>
                        </div>
                    ` : renderSelectedPlayers(selectedPlayers, teamMap)}
                </div>

                ${selectedPlayers.length >= 2 ? `
                    <!-- Comparison Table -->
                    <div class="mt-2">
                        <h3 style="color: var(--secondary-color); margin-bottom: 0.75rem;">Detailed Comparison</h3>
                        ${renderComparisonTable(selectedPlayers, teamMap, currentGw)}
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    // Add event listeners
    setupComparisonEventListeners(allPlayers, teamMap, currentGw);
}

function renderSelectedPlayers(players, teamMap) {
    return players.map(player => {
        const team = teamMap[player.team];
        const positionLabel = getPositionLabel(player.element_type);

        return `
            <div class="comparison-player-card">
                <button class="remove-player-btn" onclick="removePlayer(${player.id})">×</button>
                <div class="player-name">${player.first_name.charAt(0)}. ${player.second_name}</div>
                <div style="font-size: 0.75rem; color: #888;">${team.short_name} - ${positionLabel}</div>
                <div class="player-price">£${(player.now_cost / 10).toFixed(1)}m</div>
                <div class="grid-3" style="gap: 0.5rem; margin-top: 0.5rem;">
                    <div class="stat-mini">
                        <div class="stat-mini-value">${player.total_points}</div>
                        <div class="stat-mini-label">Points</div>
                    </div>
                    <div class="stat-mini">
                        <div class="stat-mini-value">${player.form}</div>
                        <div class="stat-mini-label">Form</div>
                    </div>
                    <div class="stat-mini">
                        <div class="stat-mini-value">${player.selected_by_percent}%</div>
                        <div class="stat-mini-label">Owned</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderComparisonTable(players, teamMap, currentGw) {
    const stats = [
        { key: 'total_points', label: 'Total Points', format: (val) => val },
        { key: 'now_cost', label: 'Price', format: (val) => `£${(val / 10).toFixed(1)}m` },
        { key: 'form', label: 'Form', format: (val) => val },
        { key: 'points_per_game', label: 'Pts/Game', format: (val) => val },
        { key: 'selected_by_percent', label: 'Ownership', format: (val) => `${val}%` },
        { key: 'goals_scored', label: 'Goals', format: (val) => val },
        { key: 'assists', label: 'Assists', format: (val) => val },
        { key: 'clean_sheets', label: 'Clean Sheets', format: (val) => val },
        { key: 'goals_conceded', label: 'Goals Conceded', format: (val) => val },
        { key: 'bonus', label: 'Bonus', format: (val) => val },
        { key: 'minutes', label: 'Minutes', format: (val) => val },
        { key: 'yellow_cards', label: 'Yellow Cards', format: (val) => val },
        { key: 'red_cards', label: 'Red Cards', format: (val) => val },
        { key: 'saves', label: 'Saves', format: (val) => val },
        { key: 'penalties_saved', label: 'Pens Saved', format: (val) => val },
        { key: 'penalties_missed', label: 'Pens Missed', format: (val) => val }
    ];

    return `
        <div style="overflow-x: auto;">
            <table class="data-table comparison-table">
                <thead>
                    <tr>
                        <th style="text-align: left;">Statistic</th>
                        ${players.map(player => `
                            <th style="text-align: center;">
                                ${player.first_name.charAt(0)}. ${player.second_name}
                            </th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${stats.map(stat => {
                        const values = players.map(p => p[stat.key]);
                        const maxValue = Math.max(...values);

                        return `
                            <tr>
                                <td style="font-weight: 600;">${stat.label}</td>
                                ${players.map(player => {
                                    const value = player[stat.key];
                                    const isMax = value === maxValue && value > 0;
                                    return `
                                        <td style="text-align: center; ${isMax ? 'color: var(--rank-up); font-weight: 700;' : ''}">
                                            ${stat.format(value)}
                                        </td>
                                    `;
                                }).join('')}
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function setupComparisonEventListeners(allPlayers, teamMap, currentGw) {
    const searchInput = document.getElementById('player-search');
    const searchResults = document.getElementById('search-results');

    if (!searchInput) return;

    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const query = e.target.value.toLowerCase().trim();

            if (query.length < 2) {
                searchResults.innerHTML = '';
                searchResults.style.display = 'none';
                return;
            }

            // Filter players
            const matches = allPlayers
                .filter(p =>
                    p.web_name.toLowerCase().includes(query) ||
                    p.first_name.toLowerCase().includes(query) ||
                    p.second_name.toLowerCase().includes(query)
                )
                .filter(p => !selectedPlayers.find(sp => sp.id === p.id))
                .slice(0, 10);

            if (matches.length === 0) {
                searchResults.innerHTML = '<div class="search-result-item">No players found</div>';
                searchResults.style.display = 'block';
                return;
            }

            searchResults.innerHTML = matches.map(player => {
                const team = teamMap[player.team];
                const positionLabel = getPositionLabel(player.element_type);

                return `
                    <div class="search-result-item" data-player-id="${player.id}">
                        <div>
                            <div style="font-weight: 600;">${player.first_name.charAt(0)}. ${player.second_name}</div>
                            <div style="font-size: 0.75rem; color: #888;">${team.short_name} - ${positionLabel}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-weight: 600;">£${(player.now_cost / 10).toFixed(1)}m</div>
                            <div style="font-size: 0.75rem; color: #888;">${player.total_points} pts</div>
                        </div>
                    </div>
                `;
            }).join('');

            searchResults.style.display = 'block';

            // Add click handlers to results
            searchResults.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', () => {
                    const playerId = parseInt(item.dataset.playerId);
                    const player = allPlayers.find(p => p.id === playerId);
                    if (player) {
                        addPlayer(player, allPlayers, teamMap, currentGw);
                        searchInput.value = '';
                        searchResults.innerHTML = '';
                        searchResults.style.display = 'none';
                    }
                });
            });
        }, 300);
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });
}

function addPlayer(player, allPlayers, teamMap, currentGw) {
    if (selectedPlayers.length >= MAX_PLAYERS) {
        alert(`You can only compare up to ${MAX_PLAYERS} players at a time`);
        return;
    }

    if (selectedPlayers.find(p => p.id === player.id)) {
        return;
    }

    selectedPlayers.push(player);
    renderComparisonTool(allPlayers, teamMap, currentGw);
}

window.removePlayer = function(playerId) {
    selectedPlayers = selectedPlayers.filter(p => p.id !== playerId);

    // Need to re-fetch data to re-render
    (async () => {
        const bootstrapData = await getBootstrapData();
        const currentGw = getCurrentGameweek(bootstrapData);
        const playerMap = createPlayerMap(bootstrapData);
        const teamMap = createTeamMap(bootstrapData);
        const allPlayers = Object.values(playerMap);

        renderComparisonTool(allPlayers, teamMap, currentGw);
    })();
};

// Register route
router.addRoute('/compare-players', renderComparePlayersPage);
