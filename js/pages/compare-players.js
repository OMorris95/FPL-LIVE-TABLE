// Player Comparison Tool - Compare up to 4 players side-by-side

let comparisonPlayers = [];
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
                <h2 class="text-error">Error Loading Comparison Tool</h2>
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
                </div>

                <!-- Back Button -->
                <div class="mb-1">
                    <button class="btn-secondary" onclick="router.navigate('/players')">
                        ← Back to Players
                    </button>
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
                    ${comparisonPlayers.length === 0 ? `
                        <div class="text-center p-lg text-tertiary" style="grid-column: 1 / -1;">
                            <p class="text-md">No players selected yet</p>
                            <p>Search and select up to ${MAX_PLAYERS} players to compare</p>
                        </div>
                    ` : renderSelectedPlayers(comparisonPlayers, teamMap)}
                </div>

                ${comparisonPlayers.length >= 2 ? `
                    <!-- Comparison Table -->
                    <div class="mt-2">
                        <h3 class="section-header">Detailed Comparison</h3>
                        ${renderComparisonTable(comparisonPlayers, teamMap, currentGw)}
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
                <div class="text-sm text-tertiary">${team.short_name} - ${positionLabel}</div>
                <div class="player-price">£${(player.now_cost / 10).toFixed(1)}m</div>
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
        <div class="overflow-x-auto">
            <table class="data-table comparison-table">
                <thead>
                    <tr>
                        <th class="text-left">Statistic</th>
                        ${players.map(player => `
                            <th class="text-center">
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
                                        <td class="text-center${isMax ? ' text-success' : ''}" ${isMax ? 'style="font-weight: 700;"' : ''}>
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
                .filter(p => !comparisonPlayers.find(sp => sp.id === p.id))
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
                            <div class="text-sm text-tertiary">${team.short_name} - ${positionLabel}</div>
                        </div>
                        <div class="text-right">
                            <div style="font-weight: 600;">£${(player.now_cost / 10).toFixed(1)}m</div>
                            <div class="text-sm text-tertiary">${player.total_points} pts</div>
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
    if (comparisonPlayers.length >= MAX_PLAYERS) {
        alert(`You can only compare up to ${MAX_PLAYERS} players at a time`);
        return;
    }

    if (comparisonPlayers.find(p => p.id === player.id)) {
        return;
    }

    comparisonPlayers.push(player);
    renderComparisonTool(allPlayers, teamMap, currentGw);
}

window.removePlayer = function(playerId) {
    comparisonPlayers = comparisonPlayers.filter(p => p.id !== playerId);

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
