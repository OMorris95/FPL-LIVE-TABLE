// Template Team Tracker - Track top 10k ownership and template players

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
        const bootstrapData = await getBootstrapData();
        const playerMap = createPlayerMap(bootstrapData);
        const teamMap = createTeamMap(bootstrapData);

        // Get all players
        const allPlayers = Object.values(playerMap);

        // Sort by ownership
        allPlayers.sort((a, b) => parseFloat(b.selected_by_percent) - parseFloat(a.selected_by_percent));

        renderTemplateTracker(allPlayers, teamMap, bootstrapData);

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

function renderTemplateTracker(allPlayers, teamMap, bootstrapData) {
    const app = document.getElementById('app');

    // Define ownership thresholds for template
    const HIGH_OWNERSHIP = 50;
    const MEDIUM_OWNERSHIP = 30;

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
    const templatePlayers = allPlayers.filter(p => parseFloat(p.selected_by_percent) >= HIGH_OWNERSHIP);

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

    app.innerHTML = `
        <div class="template-container">
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Template Team Tracker</h2>
                    <p class="subtitle">Most owned players and template analysis</p>
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
                        <div class="stat-value">${allPlayers.filter(p => parseFloat(p.selected_by_percent) >= MEDIUM_OWNERSHIP).length}</div>
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
                            parseFloat(p.selected_by_percent) >= MEDIUM_OWNERSHIP &&
                            parseFloat(p.selected_by_percent) < HIGH_OWNERSHIP
                        ).slice(0, 20),
                        teamMap,
                        'medium'
                    )}
                </div>

                <!-- Differential Players -->
                <div class="mt-2">
                    <h3 class="section-header">
                        Top Differential Players (<${MEDIUM_OWNERSHIP}% ownership, 100+ pts)
                    </h3>
                    ${renderOwnershipTable(
                        allPlayers
                            .filter(p => parseFloat(p.selected_by_percent) < MEDIUM_OWNERSHIP && p.total_points >= 100)
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
    const ownership = parseFloat(player.selected_by_percent);

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
                    ${ownership}% owned
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
                        const ownership = parseFloat(player.selected_by_percent);

                        return `
                            <tr>
                                <td style="font-weight: 600;">${player.first_name.charAt(0)}. ${player.second_name}</td>
                                <td>${team.short_name}</td>
                                <td class="text-center">${getPositionLabel(player.element_type)}</td>
                                <td class="text-center">£${(player.now_cost / 10).toFixed(1)}m</td>
                                <td class="text-center">
                                    <span class="ownership-badge ${getOwnershipClass(ownership)}">
                                        ${ownership}%
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
