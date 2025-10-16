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

// Make loadAndRenderTier available globally for onclick handlers
window.loadAndRenderTier = loadAndRenderTier;

function getTierDisplayName(tier) {
    const names = {
        'overall': 'Overall',
        '100': 'Top 100',
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
        <style>
            .player-row-expandable:hover {
                background-color: var(--bg-secondary);
            }
            .player-row-expandable.expanded {
                background-color: var(--bg-tertiary);
            }
            .player-details-row.hidden {
                display: none;
            }
            .player-status-badge {
                display: inline-block;
                padding: 0.25rem 0.5rem;
                border-radius: 4px;
                font-size: 0.75rem;
                font-weight: 600;
                margin-right: 0.5rem;
            }
            .player-status-badge.injury {
                background: var(--color-warning);
                color: var(--bg-primary);
            }
            .player-status-badge.news {
                background: var(--color-info);
                color: var(--bg-primary);
            }
        </style>
        <div class="template-container">
            <div class="card card-top">
                <div class="card-header">
                    <h2 class="card-title">Top Owned Team Tracker</h2>
                    <p class="subtitle">Ownership: ${getTierDisplayName(currentTier)}</p>
                </div>

                ${backendIndicator}

                <!-- Tier Selector -->
                <div class="mb-1">
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button class="tier-btn ${currentTier === 'overall' ? 'active' : ''}" data-tier="overall">
                            Overall League
                        </button>
                        <button class="tier-btn ${currentTier === '10k' ? 'active' : ''}" data-tier="10k" ${!backendStatus ? 'disabled' : ''}>
                            Top 10k
                        </button>
                        <button class="tier-btn ${currentTier === '1k' ? 'active' : ''}" data-tier="1k" ${!backendStatus ? 'disabled' : ''}>
                            Top 1k
                        </button>
                        <button class="tier-btn ${currentTier === '100' ? 'active' : ''}" data-tier="100" ${!backendStatus ? 'disabled' : ''}>
                            Top 100
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

    // Attach event listeners for tier buttons
    document.querySelectorAll('.tier-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tier = btn.dataset.tier;
            if (tier) {
                loadAndRenderTier(tier);
            }
        });
    });

    // Attach event listeners for sortable table headers
    document.querySelectorAll('.sortable-header').forEach(header => {
        header.addEventListener('click', () => {
            const tableType = header.dataset.tableType;
            const column = header.dataset.column;
            if (tableType && column) {
                handleTableSort(tableType, column);
            }
        });
    });

    // Attach click handlers for player expansion
    document.querySelectorAll('.player-row-expandable').forEach(row => {
        row.addEventListener('click', () => {
            const playerId = parseInt(row.dataset.playerId);
            const tableType = row.dataset.tableType;
            if (playerId && tableType) {
                togglePlayerExpansion(playerId, tableType);
            }
        });
    });
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
                        <th class="text-left">Player</th>
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
                            <tr class="player-row-expandable" data-player-id="${player.id}" data-table-type="template-squad" style="cursor: pointer;">
                                <td style="font-weight: 600; ${borderStyle}">
                                    ${player.first_name.charAt(0)}. ${player.second_name}
                                    <span class="player-sub-info">${player.pos} • ${team.short_name}</span>
                                </td>
                                <td class="text-center" style="${borderStyle}">£${(player.now_cost / 10).toFixed(1)}m</td>
                                <td class="text-center" style="${borderStyle}">
                                    <span class="ownership-badge ${getOwnershipClass(ownership)}">
                                        ${ownership.toFixed(1)}%
                                    </span>
                                </td>
                                <td class="text-center" style="font-weight: 600; ${borderStyle}">${player.total_points}</td>
                            </tr>
                            <tr class="player-details-row hidden" id="player-details-template-squad-${player.id}">
                                <td colspan="4" style="padding: 0; background: var(--bg-tertiary);">
                                    <div class="player-details-content"></div>
                                </td>
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
                        <th class="text-left sortable-header ${getSortClass('player')}" data-table-type="${type}" data-column="player">Player</th>
                        <th class="sortable-header ${getSortClass('price')}" data-table-type="${type}" data-column="price">Price</th>
                        <th class="sortable-header ${getSortClass('ownership')}" data-table-type="${type}" data-column="ownership">Ownership</th>
                        <th class="sortable-header ${getSortClass('points')}" data-table-type="${type}" data-column="points">Points</th>
                        <th class="sortable-header ${getSortClass('form')}" data-table-type="${type}" data-column="form">Form</th>
                        <th class="sortable-header ${getSortClass('ppg')}" data-table-type="${type}" data-column="ppg">PPG</th>
                    </tr>
                </thead>
                <tbody>
                    ${players.map(player => {
                        const team = teamMap[player.team];
                        const ownership = player.tier_ownership !== undefined ? player.tier_ownership : parseFloat(player.selected_by_percent);

                        return `
                            <tr class="player-row-expandable" data-player-id="${player.id}" data-table-type="${type}" style="cursor: pointer;">
                                <td style="font-weight: 600;">
                                    ${player.first_name.charAt(0)}. ${player.second_name}
                                    <span class="player-sub-info">${getPositionLabel(player.element_type)} • ${team.short_name}</span>
                                </td>
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
                            <tr class="player-details-row hidden" id="player-details-${type}-${player.id}">
                                <td colspan="6" style="padding: 0; background: var(--bg-tertiary);">
                                    <div class="player-details-content"></div>
                                </td>
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

    // Re-attach click handlers to the newly rendered table
    attachPlayerRowClickHandlers();
}

/**
 * Renders player details content (2-card layout: player card + detailed stats)
 */
function renderPlayerDetails(player) {
    const team = cachedTeamMap[player.team];
    const positionNames = ['', 'GKP', 'DEF', 'MID', 'FWD'];
    const position = positionNames[player.element_type] || '???';
    const price = (player.now_cost / 10).toFixed(1);
    const pointsPerMillion = player.now_cost > 0 ? (player.total_points / (player.now_cost / 10)).toFixed(1) : '0.0';
    const ownership = parseFloat(player.selected_by_percent).toFixed(1);

    // Status badges
    const statusBadges = [];
    if (player.chance_of_playing_next_round !== null && player.chance_of_playing_next_round < 100) {
        statusBadges.push(`<span class="player-status-badge injury">${player.chance_of_playing_next_round}%</span>`);
    }
    if (player.news) {
        statusBadges.push(`<span class="player-status-badge news">!</span>`);
    }

    // Format name with first initial
    const firstInitial = player.first_name ? player.first_name.charAt(0) : '';
    const displayName = firstInitial ? `${firstInitial}. ${player.second_name}` : player.web_name;

    return `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; padding: 1rem;">
            <!-- Left Card: Player Card (from Player Stats Hub) -->
            <div style="background: var(--bg-secondary); border-radius: 8px; padding: 1rem; border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                    <div>
                        <h3 style="margin: 0 0 0.25rem 0; font-size: 1.125rem; font-weight: 700;">${displayName}</h3>
                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                            <span style="display: inline-block; padding: 0.125rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; background: var(--bg-tertiary);">${position}</span>
                            <span style="font-size: 0.875rem; color: var(--text-tertiary);">${team ? team.short_name : '???'}</span>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 1.25rem; font-weight: 700;">£${price}m</div>
                        ${player.cost_change_start !== 0 ? `
                            <div style="font-size: 0.75rem; color: ${player.cost_change_start > 0 ? 'var(--color-success)' : 'var(--color-error)'};">
                                ${player.cost_change_start > 0 ? '+' : ''}£${(player.cost_change_start / 10).toFixed(1)}m
                            </div>
                        ` : ''}
                    </div>
                </div>

                ${statusBadges.length > 0 ? `
                    <div style="margin-bottom: 1rem;">
                        ${statusBadges.join(' ')}
                        ${player.news ? `<div style="font-size: 0.875rem; color: var(--text-tertiary); margin-top: 0.5rem; padding: 0.5rem; background: var(--bg-tertiary); border-radius: 4px;">${player.news}</div>` : ''}
                    </div>
                ` : ''}

                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; margin-bottom: 1rem;">
                    <div style="text-align: center; padding: 0.75rem; background: var(--bg-tertiary); border-radius: 6px;">
                        <div style="font-size: 1.5rem; font-weight: 700;">${player.total_points}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">Points</div>
                    </div>
                    <div style="text-align: center; padding: 0.75rem; background: var(--bg-tertiary); border-radius: 6px;">
                        <div style="font-size: 1.5rem; font-weight: 700;">${player.form}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">Form</div>
                    </div>
                    <div style="text-align: center; padding: 0.75rem; background: var(--bg-tertiary); border-radius: 6px;">
                        <div style="font-size: 1.5rem; font-weight: 700;">${pointsPerMillion}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">Pts/£m</div>
                    </div>
                    <div style="text-align: center; padding: 0.75rem; background: var(--bg-tertiary); border-radius: 6px;">
                        <div style="font-size: 1.5rem; font-weight: 700;">${ownership}%</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">Owned</div>
                    </div>
                </div>

                <div style="border-top: 1px solid var(--border-color); padding-top: 1rem;">
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem;">
                        ${player.element_type === 1 ? `
                            <div style="display: flex; justify-content: space-between; padding: 0.5rem;">
                                <span style="color: var(--text-secondary); font-size: 0.875rem;">Saves:</span>
                                <strong>${player.saves}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 0.5rem;">
                                <span style="color: var(--text-secondary); font-size: 0.875rem;">Clean Sheets:</span>
                                <strong>${player.clean_sheets}</strong>
                            </div>
                        ` : player.element_type === 2 ? `
                            <div style="display: flex; justify-content: space-between; padding: 0.5rem;">
                                <span style="color: var(--text-secondary); font-size: 0.875rem;">Clean Sheets:</span>
                                <strong>${player.clean_sheets}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 0.5rem;">
                                <span style="color: var(--text-secondary); font-size: 0.875rem;">Goals:</span>
                                <strong>${player.goals_scored}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 0.5rem;">
                                <span style="color: var(--text-secondary); font-size: 0.875rem;">Assists:</span>
                                <strong>${player.assists}</strong>
                            </div>
                        ` : `
                            <div style="display: flex; justify-content: space-between; padding: 0.5rem;">
                                <span style="color: var(--text-secondary); font-size: 0.875rem;">Goals:</span>
                                <strong>${player.goals_scored}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 0.5rem;">
                                <span style="color: var(--text-secondary); font-size: 0.875rem;">Assists:</span>
                                <strong>${player.assists}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 0.5rem;">
                                <span style="color: var(--text-secondary); font-size: 0.875rem;">xG:</span>
                                <strong>${parseFloat(player.expected_goals || 0).toFixed(2)}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 0.5rem;">
                                <span style="color: var(--text-secondary); font-size: 0.875rem;">xA:</span>
                                <strong>${parseFloat(player.expected_assists || 0).toFixed(2)}</strong>
                            </div>
                        `}
                    </div>
                </div>

                <div style="display: flex; justify-content: space-around; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                    <div style="text-align: center;">
                        <span style="color: var(--text-secondary); font-size: 0.75rem;">Minutes</span>
                        <strong style="display: block; margin-top: 0.25rem;">${player.minutes}</strong>
                    </div>
                    <div style="text-align: center;">
                        <span style="color: var(--text-secondary); font-size: 0.75rem;">Bonus</span>
                        <strong style="display: block; margin-top: 0.25rem;">${player.bonus}</strong>
                    </div>
                    <div style="text-align: center;">
                        <span style="color: var(--text-secondary); font-size: 0.75rem;">ICT</span>
                        <strong style="display: block; margin-top: 0.25rem;">${parseFloat(player.ict_index).toFixed(1)}</strong>
                    </div>
                </div>
            </div>

            <!-- Right Card: Detailed Stats (from Comparison page) -->
            <div style="background: var(--bg-secondary); border-radius: 8px; padding: 1rem; border: 1px solid var(--border-color);">
                <h4 style="margin: 0 0 1rem 0; font-size: 1rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Detailed Statistics</h4>

                <div style="display: grid; gap: 0.5rem;">
                    <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: var(--bg-tertiary); border-radius: 4px;">
                        <span style="color: var(--text-secondary);">Points per Game</span>
                        <strong>${player.points_per_game}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: var(--bg-tertiary); border-radius: 4px;">
                        <span style="color: var(--text-secondary);">Goals Conceded</span>
                        <strong>${player.goals_conceded}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: var(--bg-tertiary); border-radius: 4px;">
                        <span style="color: var(--text-secondary);">Yellow Cards</span>
                        <strong>${player.yellow_cards}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: var(--bg-tertiary); border-radius: 4px;">
                        <span style="color: var(--text-secondary);">Red Cards</span>
                        <strong>${player.red_cards}</strong>
                    </div>
                    ${player.element_type === 1 ? `
                        <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: var(--bg-tertiary); border-radius: 4px;">
                            <span style="color: var(--text-secondary);">Penalties Saved</span>
                            <strong>${player.penalties_saved}</strong>
                        </div>
                    ` : ''}
                    <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: var(--bg-tertiary); border-radius: 4px;">
                        <span style="color: var(--text-secondary);">Penalties Missed</span>
                        <strong>${player.penalties_missed}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: var(--bg-tertiary); border-radius: 4px;">
                        <span style="color: var(--text-secondary);">Expected Goals (xG)</span>
                        <strong>${parseFloat(player.expected_goals || 0).toFixed(2)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: var(--bg-tertiary); border-radius: 4px;">
                        <span style="color: var(--text-secondary);">Expected Assists (xA)</span>
                        <strong>${parseFloat(player.expected_assists || 0).toFixed(2)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: var(--bg-tertiary); border-radius: 4px;">
                        <span style="color: var(--text-secondary);">Bonus Points System</span>
                        <strong>${parseFloat(player.bps || 0)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: var(--bg-tertiary); border-radius: 4px;">
                        <span style="color: var(--text-secondary);">Influence</span>
                        <strong>${parseFloat(player.influence || 0).toFixed(1)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: var(--bg-tertiary); border-radius: 4px;">
                        <span style="color: var(--text-secondary);">Creativity</span>
                        <strong>${parseFloat(player.creativity || 0).toFixed(1)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: var(--bg-tertiary); border-radius: 4px;">
                        <span style="color: var(--text-secondary);">Threat</span>
                        <strong>${parseFloat(player.threat || 0).toFixed(1)}</strong>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Toggles player row expansion
 */
function togglePlayerExpansion(playerId, tableType) {
    if (!playerId || !tableType) return;

    // Find the details row using unique ID
    const detailsRow = document.getElementById(`player-details-${tableType}-${playerId}`);
    if (!detailsRow) return;

    // Find the clicked row
    const clickedRow = document.querySelector(`.player-row-expandable[data-player-id="${playerId}"][data-table-type="${tableType}"]`);
    if (!clickedRow) return;

    // If this row is already expanded, collapse it
    if (!detailsRow.classList.contains('hidden')) {
        detailsRow.classList.add('hidden');
        clickedRow.classList.remove('expanded');
        return;
    }

    // Close all other expanded rows
    document.querySelectorAll('.player-details-row').forEach(row => row.classList.add('hidden'));
    document.querySelectorAll('.player-row-expandable').forEach(row => row.classList.remove('expanded'));

    // Expand this row
    detailsRow.classList.remove('hidden');
    clickedRow.classList.add('expanded');

    // Load player details
    const player = cachedPlayerMap[playerId];
    if (player) {
        const contentDiv = detailsRow.querySelector('.player-details-content');
        contentDiv.innerHTML = renderPlayerDetails(player);
    }
}

/**
 * Attaches click handlers to all player rows (used after re-rendering tables)
 */
function attachPlayerRowClickHandlers() {
    // Re-attach sorting header listeners
    document.querySelectorAll('.sortable-header').forEach(header => {
        header.addEventListener('click', () => {
            const tableType = header.dataset.tableType;
            const column = header.dataset.column;
            if (tableType && column) {
                handleTableSort(tableType, column);
            }
        });
    });

    // Re-attach player row listeners
    document.querySelectorAll('.player-row-expandable').forEach(row => {
        row.addEventListener('click', () => {
            const playerId = parseInt(row.dataset.playerId);
            const tableType = row.dataset.tableType;
            if (playerId && tableType) {
                togglePlayerExpansion(playerId, tableType);
            }
        });
    });
}

// Register route
router.addRoute('/template', renderTemplatePage);
