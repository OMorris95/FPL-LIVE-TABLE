// Template Team Tracker - Track ownership and template players

let currentTier = 'overall'; // overall, 100, 1k, 10k
let backendStatus = null;
let cachedBootstrapData = null;
let cachedPlayerMap = null;
let cachedTeamMap = null;

async function renderTemplatePage() {
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

    // Backend status indicator
    const backendIndicator = backendStatus ? `
        <div class="mb-1 p-sm" style="background: var(--bg-secondary); border-radius: var(--radius-md); font-size: var(--font-base-sm);">
            <strong class="text-success">✓ Backend Connected</strong>
            <span class="text-tertiary"> • Last update: GW${backendStatus.last_update?.gameweek || 'N/A'}</span>
        </div>
    ` : '';

    app.innerHTML = `
        <div class="template-container">
            <div class="card">
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
                    </div>
                    ${!backendStatus ? '<p class="text-xs text-tertiary mt-xs">Backend data not available. Showing overall ownership.</p>' : ''}
                </div>

                <!-- Summary Stats -->
                <div class="grid-3 mb-1">
                    <div class="stat-card">
                        <div class="stat-value">${templatePlayers.length}</div>
                        <div class="stat-label">High Ownership (>${HIGH_OWNERSHIP}%)</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">£${templateCost.toFixed(1)}m</div>
                        <div class="stat-label">Template Squad Cost</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${allPlayers.filter(p => getOwnership(p) >= MEDIUM_OWNERSHIP).length}</div>
                        <div class="stat-label">Medium Ownership (>${MEDIUM_OWNERSHIP}%)</div>
                    </div>
                </div>

                <!-- Template Squad -->
                <h3 class="section-header">Most Owned Template Squad</h3>
                <p class="text-tertiary text-base-sm mb-sm">
                    Top 2 GK, 5 DEF, 5 MID, 3 FWD by ownership
                </p>
                ${renderTemplateSquad(templateTeam, teamMap)}

                <!-- High Ownership Players -->
                <div class="mt-2">
                    <h3 class="section-header">
                        High Ownership Players (>${HIGH_OWNERSHIP}%)
                    </h3>
                    ${renderOwnershipTable(templatePlayers, teamMap, 'high')}
                </div>

                <!-- Medium Ownership Players -->
                <div class="mt-2">
                    <h3 class="section-header">
                        Medium Ownership Players (${MEDIUM_OWNERSHIP}-${HIGH_OWNERSHIP}%)
                    </h3>
                    ${renderOwnershipTable(
                        allPlayers.filter(p =>
                            getOwnership(p) >= MEDIUM_OWNERSHIP &&
                            getOwnership(p) < HIGH_OWNERSHIP
                        ).slice(0, 20),
                        teamMap,
                        'medium'
                    )}
                </div>

                <!-- Differential Players -->
                <div class="mt-2">
                    <h3 class="section-header">
                        Top Differential Players (<${MEDIUM_OWNERSHIP}% ownership, 5+ PPG)
                    </h3>
                    ${renderOwnershipTable(
                        allPlayers
                            .filter(p => getOwnership(p) < MEDIUM_OWNERSHIP && parseFloat(p.points_per_game) >= 5.0)
                            .slice(0, 20),
                        teamMap,
                        'differential'
                    )}
                </div>
            </div>
        </div>
    `;
}

function renderTemplateSquad(templateTeam, teamMap) {
    const positionLabels = {
        gk: 'Goalkeepers',
        def: 'Defenders',
        mid: 'Midfielders',
        fwd: 'Forwards'
    };

    return `
        <div class="template-squad">
            ${Object.entries(templateTeam).map(([position, players]) => `
                <div class="template-position-group">
                    <h4 class="text-gold text-base-sm mb-xs">
                        ${positionLabels[position]}
                    </h4>
                    <div class="template-players-grid">
                        ${players.map(player => renderTemplatePlayerCard(player, teamMap)).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderTemplatePlayerCard(player, teamMap) {
    const team = teamMap[player.team];
    const ownership = player.tier_ownership !== undefined ? player.tier_ownership : parseFloat(player.selected_by_percent);

    return `
        <div class="template-player-card">
            <div class="flex justify-between items-start mb-xs">
                <div style="flex: 1;">
                    <div class="player-name">${player.first_name.charAt(0)}. ${player.second_name}</div>
                    <div class="text-xs text-tertiary">${team.short_name}</div>
                </div>
                <div class="text-right">
                    <div class="text-secondary text-base-sm" style="font-weight: 700;">
                        £${(player.now_cost / 10).toFixed(1)}m
                    </div>
                </div>
            </div>
            <div class="flex justify-between items-center">
                <div class="ownership-badge ${getOwnershipClass(ownership)}">
                    ${ownership.toFixed(1)}% owned
                </div>
                <div class="text-base-sm text-tertiary">
                    ${player.total_points} pts
                </div>
            </div>
        </div>
    `;
}

function renderOwnershipTable(players, teamMap, type) {
    if (players.length === 0) {
        return `<p class="text-center text-tertiary p-sm">No players in this category</p>`;
    }

    return `
        <div class="overflow-x-auto">
            <table class="data-table ownership-table">
                <thead>
                    <tr>
                        <th class="text-left">Player</th>
                        <th class="text-left">Team</th>
                        <th>Position</th>
                        <th>Price</th>
                        <th>Ownership</th>
                        <th>Points</th>
                        <th>Form</th>
                        <th>PPG</th>
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

// Register route
router.addRoute('/template', renderTemplatePage);
