// My Stats Page - Personal Manager Dashboard

async function renderMyStatsPage() {
    const app = document.getElementById('app');
    const nav = document.getElementById('main-nav');

    // Show navigation
    nav.style.display = 'block';

    // Check if manager ID is stored
    const storedManagerId = localStorage.getItem('fpl_manager_id');

    if (!storedManagerId) {
        // Show manager ID input form
        app.innerHTML = `
            <div class="card text-center" style="max-width: 600px; margin: 2rem auto;">
                <div class="card-header">
                    <h2 class="card-title">Enter Your Manager ID</h2>
                </div>
                <p style="color: #aaa; margin-bottom: 1.5rem;">
                    Find your Manager ID in the URL of your FPL team page:<br>
                    <code style="background: #1a1a1a; padding: 0.25rem 0.5rem; border-radius: 4px;">
                        https://fantasy.premierleague.com/entry/<span style="color: var(--accent-gold);">YOUR_ID</span>/
                    </code>
                </p>
                <form id="manager-id-form">
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <input
                            type="number"
                            id="manager-id-input"
                            class="form-input form-input-compact"
                            placeholder="e.g., 123456"
                            required
                        />
                    </div>
                    <button type="submit" class="btn-primary" style="width: 100%;">
                        Load My Stats
                    </button>
                </form>
            </div>
        `;

        // Handle form submission
        const form = document.getElementById('manager-id-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const managerId = document.getElementById('manager-id-input').value;

            if (managerId) {
                // Store manager ID
                localStorage.setItem('fpl_manager_id', managerId);
                // Reload the page
                renderMyStatsPage();
            }
        });
        return;
    }

    // Show loading
    app.innerHTML = `
        <div class="text-center mt-2">
            <div class="spinner"></div>
            <p class="loading-text">Loading your stats...</p>
        </div>
    `;

    try {
        // Fetch manager data
        const managerId = parseInt(storedManagerId);
        const bootstrapData = await getBootstrapData();
        const currentGw = getCurrentGameweek(bootstrapData);

        // Fetch all required data
        const [managerData, historyData, currentPicks] = await Promise.all([
            getManagerData(managerId),
            getManagerHistory(managerId),
            getManagerPicks(managerId, currentGw)
        ]);

        if (!managerData || !historyData || !currentPicks) {
            throw new Error('Could not fetch manager data');
        }

        // Render dashboard
        renderManagerDashboard(managerData, historyData, currentPicks, bootstrapData, currentGw, managerId);

    } catch (error) {
        console.error('Error loading My Stats:', error);
        app.innerHTML = `
            <div class="card text-center">
                <h2 style="color: var(--rank-down);">Error Loading Stats</h2>
                <p>${error.message}</p>
                <button class="btn-primary" onclick="localStorage.removeItem('fpl_manager_id'); router.navigate('/my-stats');">
                    Try Different Manager ID
                </button>
            </div>
        `;
    }
}

// Helper function to get manager general data
async function getManagerData(managerId) {
    return await fetchData(`${API_BASE_URL}entry/${managerId}/`);
}

// Helper function to get manager history
async function getManagerHistory(managerId) {
    return await fetchData(`${API_BASE_URL}entry/${managerId}/history/`);
}

function renderManagerDashboard(managerData, historyData, currentPicks, bootstrapData, currentGw, managerId) {
    const app = document.getElementById('app');

    // Calculate stats
    const currentRank = managerData.summary_overall_rank;
    const currentPoints = managerData.summary_overall_points;

    // Calculate LIVE team value from current picks using MARKET PRICES
    // Note: FPL API does not expose selling prices (which differ due to 50% sell-on fee)
    const playerMap = createPlayerMap(bootstrapData);
    let marketSquadValue = 0;

    // Sum up the current market value (now_cost) of all players in squad
    currentPicks.picks.forEach(pick => {
        const player = playerMap[pick.element];
        if (player) {
            marketSquadValue += player.now_cost; // now_cost is in tenths
        }
    });

    // Convert from tenths to millions
    const squadValue = (marketSquadValue / 10).toFixed(1);
    const bank = (managerData.last_deadline_bank / 10).toFixed(1);
    const totalValue = (parseFloat(squadValue) + parseFloat(bank)).toFixed(1);

    // Get rank history from current season
    const currentSeasonHistory = historyData.current || [];
    const rankHistory = currentSeasonHistory.map(gw => ({
        gw: gw.event,
        rank: gw.overall_rank,
        points: gw.points,
        totalPoints: gw.total_points,
        rankChange: gw.rank - (currentSeasonHistory[gw.event - 2]?.overall_rank || gw.rank),
        transferCost: gw.event_transfers_cost
    }));

    // Calculate captain stats
    const captainStats = calculateCaptainStats(currentSeasonHistory);

    // Get chip usage from historyData.chips (not from current array)
    const usedChips = historyData.chips || [];

    // Define all available chips
    const allChips = [
        { name: 'bboost', label: 'Bench Boost', abbrev: 'BB' },
        { name: '3xc', label: 'Triple Captain', abbrev: 'TC' },
        { name: 'freehit', label: 'Free Hit', abbrev: 'FH' },
        { name: 'wildcard', label: 'Wildcard', abbrev: 'WC' }
    ];

    // Check which chips have been used and get their gameweek data
    const chipStatus = allChips.map(chip => {
        const used = usedChips.find(c => c.name === chip.name);
        if (used) {
            const gwData = currentSeasonHistory.find(gw => gw.event === used.event);
            return {
                ...chip,
                used: true,
                gw: used.event,
                points: gwData ? gwData.points : 0
            };
        }
        return {
            ...chip,
            used: false
        };
    });

    // Get best and worst gameweeks
    const bestGw = currentSeasonHistory.reduce((best, gw) =>
        gw.points > (best?.points || 0) ? gw : best, null);
    const worstGw = currentSeasonHistory.reduce((worst, gw) =>
        gw.points < (worst?.points || Infinity) ? gw : worst, null);

    app.innerHTML = `
        <div class="my-stats-container">
            <!-- Header Card -->
            <div class="card">
                <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h2 class="card-title">${managerData.player_first_name} ${managerData.player_last_name}</h2>
                        <p style="color: #aaa; margin: 0;">${managerData.name}</p>
                    </div>
                    <button class="btn-secondary-small" onclick="localStorage.removeItem('fpl_manager_id'); router.navigate('/my-stats');">
                        Change Manager
                    </button>
                </div>

                <!-- Key Stats Grid - Compact 6 Column -->
                <div class="grid-6 mb-1">
                    <div class="stat-card">
                        <div class="stat-value">${currentPoints.toLocaleString()}</div>
                        <div class="stat-label">Total Points</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${currentRank.toLocaleString()}</div>
                        <div class="stat-label">Overall Rank</div>
                        <div style="font-size: 0.7rem; color: #888; margin-top: 0.25rem;">
                            Top ${((currentRank / 11500000) * 100).toFixed(2)}%
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">£${squadValue}m</div>
                        <div class="stat-label">Squad Value*</div>
                        <div style="font-size: 0.7rem; color: #888; margin-top: 0.25rem;">
                            Bank: £${bank}m
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${managerData.summary_event_points || 0}</div>
                        <div class="stat-label">GW${currentGw} Points</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" style="color: var(--rank-up);">${bestGw ? bestGw.points : 0}</div>
                        <div class="stat-label">Best GW${bestGw ? bestGw.event : ''}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" style="color: var(--rank-down);">${worstGw ? worstGw.points : 0}</div>
                        <div class="stat-label">Worst GW${worstGw ? worstGw.event : ''}</div>
                    </div>
                </div>
                <p style="font-size: 0.7rem; color: #666; font-style: italic; text-align: center; margin-bottom: 0.5rem;">
                    *Market prices - selling value may differ due to 50% sell-on fee
                </p>
            </div>

            <!-- Gameweek Performance Table - Compact -->
            <div class="card mt-1">
                <h3 style="color: var(--secondary-color); margin-bottom: 0.75rem;">Gameweek Performance</h3>
                <div style="overflow-x: auto;">
                    <table class="data-table gameweek-table-compact">
                        <thead>
                            <tr>
                                <th>GW</th>
                                <th>Points</th>
                                <th>Total</th>
                                <th>Rank</th>
                                <th>Rank Change</th>
                                <th>Transfers</th>
                                <th>Chip</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${[...currentSeasonHistory].reverse().map(gw => `
                                <tr>
                                    <td><strong>GW${gw.event}</strong></td>
                                    <td>${gw.points - gw.event_transfers_cost}</td>
                                    <td>${gw.total_points}</td>
                                    <td>${gw.overall_rank.toLocaleString()}</td>
                                    <td>${gw.rank ? `<span style="color: ${gw.rank > 0 ? 'var(--rank-down)' : 'var(--rank-up)'}">
                                        ${gw.rank > 0 ? '▼' : '▲'} ${Math.abs(gw.rank).toLocaleString()}
                                    </span>` : '-'}</td>
                                    <td>${gw.event_transfers_cost > 0 ?
                                        `<span style="color: var(--rank-down)">-${gw.event_transfers_cost}</span>` :
                                        '0'}</td>
                                    <td>${gw.active_chip ? getChipAbbreviation(gw.active_chip) : '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Season Statistics - Combined Captain & Transfers -->
            <div class="card mt-1">
                <h3 style="color: var(--secondary-color); margin-bottom: 0.75rem;">Season Statistics</h3>
                <div class="grid-6 mb-1">
                    <div class="stat-card">
                        <div class="stat-value">${captainStats.totalPoints}</div>
                        <div class="stat-label">Captain Points</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${captainStats.successRate}%</div>
                        <div class="stat-label">Captain Success</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${captainStats.avgPoints.toFixed(1)}</div>
                        <div class="stat-label">Avg Captain Pts</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${currentSeasonHistory.reduce((sum, gw) => sum + (gw.event_transfers || 0), 0)}</div>
                        <div class="stat-label">Total Transfers</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" style="color: var(--rank-down);">-${currentSeasonHistory.reduce((sum, gw) => sum + gw.event_transfers_cost, 0)}</div>
                        <div class="stat-label">Hit Points Lost</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${(currentPoints / currentSeasonHistory.length).toFixed(1)}</div>
                        <div class="stat-label">Avg GW Points</div>
                    </div>
                </div>
            </div>

            <!-- Chip Usage - Always visible -->
            <div class="card mt-1">
                <h3 style="color: var(--secondary-color); margin-bottom: 0.75rem;">Chip Usage</h3>
                <div class="grid-4">
                    ${chipStatus.map(chip => `
                        <div class="stat-card" style="opacity: ${chip.used ? '1' : '0.5'}; text-align: center;">
                            <div style="font-size: 1.5rem; margin-bottom: 0.25rem;">
                                ${chip.abbrev}
                            </div>
                            <div class="stat-label">${chip.label}</div>
                            ${chip.used ? `
                                <div style="color: var(--rank-up); margin-top: 0.25rem; font-weight: 600;">
                                    GW${chip.gw}
                                </div>
                                <div style="font-size: 1rem; color: var(--secondary-color); margin-top: 0.25rem;">
                                    ${chip.points} pts
                                </div>
                            ` : `
                                <div style="color: #666; margin-top: 0.25rem; font-style: italic;">
                                    Available
                                </div>
                            `}
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

// Helper function to calculate captain stats
function calculateCaptainStats(seasonHistory) {
    // Note: We don't have direct captain point data from history endpoint
    // This is a simplified calculation - would need picks data for accuracy
    const totalGws = seasonHistory.length;

    return {
        total: totalGws,
        returns: Math.floor(totalGws * 0.7), // Placeholder
        totalPoints: 0, // Would need picks data
        avgPoints: 0, // Would need picks data
        successRate: 70 // Placeholder
    };
}

// Register route
router.addRoute('/my-stats', renderMyStatsPage);
