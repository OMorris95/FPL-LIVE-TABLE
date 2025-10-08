// Template Team Tracker - Track ownership and template players

let currentTier = 'overall'; // overall, 100, 1k, 10k
let backendStatus = null;
let cachedBootstrapData = null;
let cachedPlayerMap = null;
let cachedTeamMap = null;

// Sorting state for tables
let tableSortState = {
    high: { column: 'ownership', direction: 'desc' },
    medium: { column: 'ownership', direction: 'desc' },
    differential: { column: 'ownership', direction: 'desc' }
};

// Store player data for re-sorting
let tablePlayerData = {
    high: [],
    medium: [],
    differential: []
};

async function renderTemplatePage(state = {}) {
    const app = document.getElementById('app');
    const nav = document.getElementById('main-nav');

    nav.style.display = 'block';

    app.innerHTML = `
        <div class="text-center mt-2">
            <div class="spinner"></div>
            <p class="loading-text">Loading template team data...</p>
        </div>
    `;

    try {
        // Cache bootstrap data
        cachedBootstrapData = await getBootstrapData();
        cachedPlayerMap = createPlayerMap(cachedBootstrapData);
        cachedTeamMap = createTeamMap(cachedBootstrapData);

        // Check backend status
        backendStatus = await checkBackendStatus();

        // Load ownership data for default tier
        await loadAndRenderTier('10k'); // Default to top 10k if available

    } catch (error) {
        console.error('Error loading template team:', error);
        app.innerHTML = `
            <div class="card text-center">
                <h2 class="text-error">Error Loading Template Team</h2>
                <p>${error.message}</p>
            </div>
        `;
    }
}

async function checkBackendStatus() {
    try {
        const response = await fetch('/api/status');
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.log('Backend not available, using overall ownership');
    }
    return null;
}

async function loadAndRenderTier(tier) {
    const app = document.getElementById('app');

    // Show loading
    app.innerHTML = `
        <div class="text-center mt-2">
            <div class="spinner"></div>
            <p class="loading-text">Loading ${getTierDisplayName(tier)} ownership data...</p>
        </div>
    `;

    try {
        let ownershipData = null;

        // Try to fetch backend data if not "overall"
        if (tier !== 'overall' && backendStatus) {
            try {
                const response = await fetch(`/api/ownership/${tier}/latest`);
                if (response.ok) {
                    const data = await response.json();
                    ownershipData = data.ownership;
                    currentTier = tier;
                }
            } catch (error) {
                console.log(`Failed to load ${tier} data, falling back to overall`);
            }
        }

        // Merge ownership data with player data
        const allPlayers = Object.values(cachedPlayerMap);

        if (ownershipData) {
            // Create ownership map
            const ownershipMap = {};
            ownershipData.forEach(item => {
                ownershipMap[item.player_id] = item.ownership_percent;
            });

            // Update player ownership from backend data
            allPlayers.forEach(player => {
                if (ownershipMap[player.id] !== undefined) {
                    player.tier_ownership = ownershipMap[player.id];
                } else {
                    player.tier_ownership = 0;
                }
            });

            // Sort by tier ownership
            allPlayers.sort((a, b) => b.tier_ownership - a.tier_ownership);
        } else {
            // Fall back to overall ownership
            currentTier = 'overall';
            allPlayers.forEach(player => {
                player.tier_ownership = parseFloat(player.selected_by_percent);
            });
            allPlayers.sort((a, b) => b.tier_ownership - a.tier_ownership);
        }

        renderTemplateTracker(allPlayers, cachedTeamMap, cachedBootstrapData);

    } catch (error) {
        console.error('Error loading tier data:', error);
        app.innerHTML = `
            <div class="card text-center">
                <h2 class="text-error">Error Loading Ownership Data</h2>
                <p>${error.message}</p>
            </div>
        `;
    }
}

function getTierDisplayName(tier) {
    const names = {
        'overall': 'Overall',
        '100': 'Top 100',
        '100_test': 'Top 100 (Test)',
        '1k': 'Top 1k',
        '10k': 'Top 10k'
    };
    return names[tier] || tier;
}

function renderTemplateTracker(allPlayers, teamMap, bootstrapData) {
    const app = document.getElementById('app');

    // Define ownership thresholds for template
    const HIGH_OWNERSHIP = 50;
    const MEDIUM_OWNERSHIP = 30;

    // Use tier_ownership instead of selected_by_percent
    const getOwnership = (player) => player.tier_ownership !== undefined ? player.tier_ownership : parseFloat(player.selected_by_percent);

    // Group by position
    const byPosition = {
        1: [],
        2: [],
        3: [],
        4: []
    };

    allPlayers.forEach(player => {
        byPosition[player.element_type].push(player);
    });

    // Get template players (high ownership)
    const templatePlayers = allPlayers.filter(p => getOwnership(p) >= HIGH_OWNERSHIP);

    // Build optimal template team (most owned in each position)
    const templateTeam = {
        gk: byPosition[1].slice(0, 2),
        def: byPosition[2].slice(0, 5),
        mid: byPosition[3].slice(0, 5),
        fwd: byPosition[4].slice(0, 3)
    };

    // Calculate total cost
    let templateCost = 0;
    [...templateTeam.gk, ...templateTeam.def, ...templateTeam.mid, ...templateTeam.fwd].forEach(player => {
        templateCost += player.now_cost;
    });
    templateCost = templateCost / 10;

    // Store player data for each table (for sorting)
    tablePlayerData.high = templatePlayers;
    tablePlayerData.medium = allPlayers.filter(p =>
        getOwnership(p) >= MEDIUM_OWNERSHIP &&
        getOwnership(p) < HIGH_OWNERSHIP
    ).slice(0, 20);
    tablePlayerData.differential = allPlayers
        .filter(p => getOwnership(p) < MEDIUM_OWNERSHIP && parseFloat(p.points_per_game) >= 5.0)
        .slice(0, 20);

    // Backend status indicator
    const backendIndicator = backendStatus ? `
        <div class="mb-1 p-sm" style="background: var(--bg-secondary); border-radius: var(--radius-md); font-size: var(--font-base-sm);">
            <strong class="text-success">✓ Backend Connected</strong>
            <span class="text-tertiary"> • Last update: GW${backendStatus.last_update?.gameweek || 'N/A'}</span>
        </div>
    ` : '';

    app.innerHTML = `
        <div class="template-container">
            <div class="card card-top">
                <div class="card-header">
                    <h2 class="card-title">Template Team Tracker</h2>
                    <p class="subtitle">Ownership: ${getTierDisplayName(currentTier)}</p>
                </div>

                ${backendIndicator}

                <!-- Tier Selector -->
                <div class="mb-1">
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button class="tier-btn ${currentTier === 'overall' ? 'active' : ''}" onclick="loadAndRenderTier('overall')">
                            Overall League
                        </button>
                        <button class="tier-btn ${currentTier === '10k' ? 'active' : ''}" onclick="loadAndRenderTier('10k')" ${!backendStatus ? 'disabled' : ''}>
                            Top 10k
                        </button>
                        <button class="tier-btn ${currentTier === '1k' ? 'active' : ''}" onclick="loadAndRenderTier('1k')" ${!backendStatus ? 'disabled' : ''}>
                            Top 1k
                        </button>
                        <button class="tier-btn ${currentTier === '100' ? 'active' : ''}" onclick="loadAndRenderTier('100')" ${!backendStatus ? 'disabled' : ''}>
                            Top 100
                        </button>
                        <button class="tier-btn ${currentTier === '100_test' ? 'active' : ''}" onclick="loadAndRenderTier('100_test')" ${!backendStatus ? 'disabled' : ''}>
                            Top 100 (Test)
                        </button>
                    </div>
                    ${!backendStatus ? '<p class="text-xs text-tertiary mt-xs">Backend data not available. Showing overall ownership.</p>' : ''}
                </div>

                <!-- Template Squad -->
                <h3 class="section-header">Most Owned Template Squad</h3>
                ${renderTemplateSquad(templateTeam, teamMap)}

                <!-- High Ownership Players -->
                <div class="mt-2">
                    <h3 class="section-header">
                        High Ownership Players (>${HIGH_OWNERSHIP}%)
                    </h3>
                    ${renderOwnershipTable(tablePlayerData.high, teamMap, 'high')}
                </div>

                <!-- Medium Ownership Players -->
                <div class="mt-2">
                    <h3 class="section-header">
                        Medium Ownership Players (${MEDIUM_OWNERSHIP}-${HIGH_OWNERSHIP}%)
                    </h3>
                    ${renderOwnershipTable(tablePlayerData.medium, teamMap, 'medium')}
                </div>

                <!-- Differential Players -->
                <div class="mt-2">
                    <h3 class="section-header">
                        Top Differential Players (<${MEDIUM_OWNERSHIP}% ownership, 5+ PPG)
                    </h3>
                    ${renderOwnershipTable(tablePlayerData.differential, teamMap, 'differential')}
                </div>
            </div>
        </div>
    `;
}

function renderTemplateSquad(templateTeam, teamMap) {
    const positionLabels = {
        gk: 'GKP',
        def: 'DEF',
        mid: 'MID',
        fwd: 'FWD'
    };

    const positionColors = {
        'GKP': '#ea5906',
        'DEF': '#f3d209',
        'MID': '#2bb000',
        'FWD': '#007eff'
    };

    // Flatten all players with their position, tracking position boundaries
    const allSquadPlayers = [];
    Object.entries(templateTeam).forEach(([position, players]) => {
        players.forEach((player, idx) => {
            const isLastOfPosition = idx === players.length - 1;
            allSquadPlayers.push({
                ...player,
                pos: positionLabels[position],
                isLastOfPosition
            });
        });
    });

    return `
        <div class="overflow-x-auto mb-1">
            <table class="data-table ownership-table">
                <thead>
                    <tr>
                        <th class="text-left">Pos</th>
                        <th class="text-left">Player</th>
                        <th class="text-left">Team</th>
                        <th>Price</th>
                        <th>Ownership</th>
                        <th>Points</th>
                    </tr>
                </thead>
                <tbody>
                    ${allSquadPlayers.map(player => {
                        const team = teamMap[player.team];
                        const ownership = player.tier_ownership !== undefined ? player.tier_ownership : parseFloat(player.selected_by_percent);
                        const borderStyle = player.isLastOfPosition ? `box-shadow: inset 0 -2px 0 0 ${positionColors[player.pos]};` : '';

                        return `
                            <tr>
                                <td style="${borderStyle}"><strong>${player.pos}</strong></td>
                                <td style="font-weight: 600; ${borderStyle}">${player.first_name.charAt(0)}. ${player.second_name}</td>
                                <td style="${borderStyle}">${team.short_name}</td>
                                <td class="text-center" style="${borderStyle}">£${(player.now_cost / 10).toFixed(1)}m</td>
                                <td class="text-center" style="${borderStyle}">
                                    <span class="ownership-badge ${getOwnershipClass(ownership)}">
                                        ${ownership.toFixed(1)}%
                                    </span>
                                </td>
                                <td class="text-center" style="font-weight: 600; ${borderStyle}">${player.total_points}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderOwnershipTable(players, teamMap, type) {
    if (players.length === 0) {
        return `<p class="text-center text-tertiary p-sm">No players in this category</p>`;
    }

    const state = tableSortState[type];
    const getSortClass = (col) => {
        if (state.column === col) {
            return state.direction === 'asc' ? 'sort-asc' : 'sort-desc';
        }
        return '';
    };

    return `
        <div class="overflow-x-auto" id="${type}-table">
            <table class="data-table ownership-table">
                <thead>
                    <tr>
                        <th class="text-left sortable-header ${getSortClass('player')}" onclick="handleTableSort('${type}', 'player')">Player</th>
                        <th class="text-left sortable-header ${getSortClass('team')}" onclick="handleTableSort('${type}', 'team')">Team</th>
                        <th class="sortable-header ${getSortClass('position')}" onclick="handleTableSort('${type}', 'position')">Position</th>
                        <th class="sortable-header ${getSortClass('price')}" onclick="handleTableSort('${type}', 'price')">Price</th>
                        <th class="sortable-header ${getSortClass('ownership')}" onclick="handleTableSort('${type}', 'ownership')">Ownership</th>
                        <th class="sortable-header ${getSortClass('points')}" onclick="handleTableSort('${type}', 'points')">Points</th>
                        <th class="sortable-header ${getSortClass('form')}" onclick="handleTableSort('${type}', 'form')">Form</th>
                        <th class="sortable-header ${getSortClass('ppg')}" onclick="handleTableSort('${type}', 'ppg')">PPG</th>
                    </tr>
                </thead>
                <tbody>
                    ${players.map(player => {
                        const team = teamMap[player.team];
                        const ownership = player.tier_ownership !== undefined ? player.tier_ownership : parseFloat(player.selected_by_percent);

                        return `
                            <tr>
                                <td style="font-weight: 600;">${player.first_name.charAt(0)}. ${player.second_name}</td>
                                <td>${team.short_name}</td>
                                <td class="text-center">${getPositionLabel(player.element_type)}</td>
                                <td class="text-center">£${(player.now_cost / 10).toFixed(1)}m</td>
                                <td class="text-center">
                                    <span class="ownership-badge ${getOwnershipClass(ownership)}">
                                        ${ownership.toFixed(1)}%
                                    </span>
                                </td>
                                <td class="text-center" style="font-weight: 600;">${player.total_points}</td>
                                <td class="text-center">${player.form}</td>
                                <td class="text-center">${player.points_per_game}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function getOwnershipClass(ownership) {
    if (ownership >= 50) return 'ownership-high';
    if (ownership >= 30) return 'ownership-medium';
    if (ownership >= 10) return 'ownership-low';
    return 'ownership-differential';
}

/**
 * Multi-level sort function for player tables
 * Primary: specified column
 * Secondary: ownership (if not primary)
 * Tertiary: points (if not primary or secondary)
 * Quaternary: lowest price
 */
function sortPlayers(players, column, direction) {
    return [...players].sort((a, b) => {
        const getOwnership = (p) => p.tier_ownership !== undefined ? p.tier_ownership : parseFloat(p.selected_by_percent);

        // Get values for primary sort column
        let aVal, bVal;

        switch (column) {
            case 'player':
                aVal = a.second_name.toLowerCase();
                bVal = b.second_name.toLowerCase();
                break;
            case 'team':
                aVal = a.team;
                bVal = b.team;
                break;
            case 'position':
                aVal = a.element_type;
                bVal = b.element_type;
                break;
            case 'price':
                aVal = a.now_cost;
                bVal = b.now_cost;
                break;
            case 'ownership':
                aVal = getOwnership(a);
                bVal = getOwnership(b);
                break;
            case 'points':
                aVal = a.total_points;
                bVal = b.total_points;
                break;
            case 'form':
                aVal = parseFloat(a.form);
                bVal = parseFloat(b.form);
                break;
            case 'ppg':
                aVal = parseFloat(a.points_per_game);
                bVal = parseFloat(b.points_per_game);
                break;
            default:
                aVal = 0;
                bVal = 0;
        }

        // Primary comparison
        let result = 0;
        if (aVal < bVal) result = -1;
        else if (aVal > bVal) result = 1;

        // Apply direction
        if (direction === 'desc') result *= -1;

        // If equal, use secondary sort: ownership (desc)
        if (result === 0 && column !== 'ownership') {
            const aOwn = getOwnership(a);
            const bOwn = getOwnership(b);
            result = bOwn - aOwn;
        }

        // If still equal, use tertiary sort: points (desc)
        if (result === 0 && column !== 'points') {
            result = b.total_points - a.total_points;
        }

        // If still equal, use quaternary sort: lowest price (asc)
        if (result === 0 && column !== 'price') {
            result = a.now_cost - b.now_cost;
        }

        return result;
    });
}

/**
 * Handles table header clicks for sorting
 */
window.handleTableSort = function(tableType, column) {
    const state = tableSortState[tableType];

    // Toggle direction if clicking same column, otherwise default to desc
    if (state.column === column) {
        state.direction = state.direction === 'desc' ? 'asc' : 'desc';
    } else {
        state.column = column;
        state.direction = 'desc';
    }

    // Re-sort and re-render the table
    const sortedPlayers = sortPlayers(tablePlayerData[tableType], column, state.direction);
    tablePlayerData[tableType] = sortedPlayers;

    // Re-render just this table
    rerenderTable(tableType, sortedPlayers);
};

/**
 * Re-renders a specific table after sorting
 */
function rerenderTable(tableType, players) {
    const tableId = `${tableType}-table`;
    const tableElement = document.getElementById(tableId);

    if (!tableElement) return;

    // Re-render just the table (not the parent which contains the title)
    const tableHtml = renderOwnershipTable(players, cachedTeamMap, tableType);
    tableElement.outerHTML = tableHtml;
}

// Register route
router.addRoute('/template', renderTemplatePage);
