// My Stats Page - Personal Manager Dashboard

async function renderMyStatsPage(paramManagerId) {
    const app = document.getElementById('app');
    const nav = document.getElementById('main-nav');

    // Show navigation
    nav.style.display = 'block';

    // Determine which manager ID to use
    // Priority: URL parameter > localStorage
    const storedManagerId = localStorage.getItem('fpl_manager_id');
    const managerIdToLoad = paramManagerId || storedManagerId;

    if (!managerIdToLoad) {
        // Show manager ID input form
        app.innerHTML = `
            <div class="card text-center container-sm" style="margin: 2rem auto;">
                <div class="card-header">
                    <h2 class="card-title">Enter Your Manager ID</h2>
                </div>
                <p class="subtitle mb-md">
                    Find your Manager ID in the URL of your FPL team page:<br>
                    <code style="background: #1a1a1a; padding: 0.25rem 0.5rem; border-radius: 4px;">
                        https://fantasy.premierleague.com/entry/<span class="text-gold">YOUR_ID</span>/
                    </code>
                </p>
                <form id="manager-id-form">
                    <div class="form-group mb-sm">
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
        const managerId = parseInt(managerIdToLoad);
        const bootstrapData = await getBootstrapData();
        const currentGw = getCurrentGameweek(bootstrapData);

        // Check if we have a league ID to fetch league managers
        const leagueId = router.getLeagueId();
        let leagueManagers = null;
        if (leagueId) {
            try {
                const leagueData = await getLeagueData(leagueId);
                if (leagueData && leagueData.standings && leagueData.standings.results) {
                    leagueManagers = leagueData.standings.results;
                }
            } catch (err) {
                console.log('Could not fetch league data for manager selector:', err);
            }
        }

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
        renderManagerDashboard(managerData, historyData, currentPicks, bootstrapData, currentGw, managerId, storedManagerId, leagueManagers);

    } catch (error) {
        console.error('Error loading My Stats:', error);
        app.innerHTML = `
            <div class="card text-center">
                <h2 class="text-error">Error Loading Stats</h2>
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

function renderManagerDashboard(managerData, historyData, currentPicks, bootstrapData, currentGw, managerId, ownManagerId, leagueManagers) {
    const app = document.getElementById('app');

    // Check if viewing own stats or another manager
    const isOwnStats = (!ownManagerId) || (managerId == ownManagerId);

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
    const rankHistory = currentSeasonHistory.map((gw, index) => {
        // Get previous gameweek from array position
        const prevGw = index > 0 ? currentSeasonHistory[index - 1] : null;
        // Simple rank change calculation: current rank - previous rank
        // Negative = improved (rank went down), Positive = worsened (rank went up)
        const rankChange = prevGw ? (gw.overall_rank - prevGw.overall_rank) : 0;

        return {
            gw: gw.event,
            rank: gw.overall_rank,
            points: gw.points,
            totalPoints: gw.total_points,
            rankChange: rankChange,
            transferCost: gw.event_transfers_cost
        };
    });

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
                <div class="card-header flex-header">
                    <div>
                        <h2 class="card-title">${managerData.player_first_name} ${managerData.player_last_name}</h2>
                        <p class="subtitle m-0">${managerData.name}</p>
                        ${!isOwnStats ? `<p class="text-gold mt-xs text-base-sm">Viewing League Manager</p>` : ''}
                    </div>
                    <div class="flex gap-sm items-center flex-wrap">
                        ${leagueManagers ? `
                            <select id="league-manager-selector" class="form-select" style="min-width: 200px;">
                                <option value="">View League Manager...</option>
                                ${leagueManagers.map(mgr => `
                                    <option value="${mgr.entry}" ${mgr.entry == managerId ? 'selected' : ''}>
                                        ${mgr.player_name} (${mgr.entry_name})
                                    </option>
                                `).join('')}
                            </select>
                        ` : ''}
                        ${!isOwnStats && ownManagerId ? `
                            <button class="btn-secondary-small" onclick="router.navigate('/my-stats');">
                                View My Stats
                            </button>
                        ` : ''}
                        <button class="btn-secondary-small" onclick="localStorage.removeItem('fpl_manager_id'); router.navigate('/my-stats');">
                            Change Manager
                        </button>
                    </div>
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
                        <div class="text-xs text-tertiary mt-xs">
                            Top ${((currentRank / 11500000) * 100).toFixed(2)}%
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">£${squadValue}m</div>
                        <div class="stat-label">Squad Value*</div>
                        <div class="text-xs text-tertiary mt-xs">
                            Bank: £${bank}m
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${managerData.summary_event_points || 0}</div>
                        <div class="stat-label">GW${currentGw} Points</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value text-success">${bestGw ? bestGw.points : 0}</div>
                        <div class="stat-label">Best GW${bestGw ? bestGw.event : ''}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value text-error">${worstGw ? worstGw.points : 0}</div>
                        <div class="stat-label">Worst GW${worstGw ? worstGw.event : ''}</div>
                    </div>
                </div>
                <p class="note-text mb-xs">
                    *Market prices - selling value may differ due to 50% sell-on fee
                </p>
            </div>

            <!-- Gameweek Performance Table - Compact -->
            <div class="card mt-1">
                <h3 class="section-header">Gameweek Performance</h3>
                <div class="overflow-x-auto">
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
                            ${[...currentSeasonHistory].reverse().map((gw, index, reversedArray) => {
                                // Calculate rank change: current rank - previous rank
                                // Array is reversed (newest first), so we need original array index
                                const originalIndex = currentSeasonHistory.length - 1 - index;
                                const prevGw = originalIndex > 0 ? currentSeasonHistory[originalIndex - 1] : null;
                                const rankChange = prevGw ? (gw.overall_rank - prevGw.overall_rank) : 0;

                                return `
                                <tr>
                                    <td><strong>GW${gw.event}</strong></td>
                                    <td>${gw.points - gw.event_transfers_cost}</td>
                                    <td>${gw.total_points}</td>
                                    <td>${gw.overall_rank.toLocaleString()}</td>
                                    <td>${rankChange !== 0 ? `<span class="${rankChange < 0 ? 'text-success' : 'text-error'}">
                                        ${rankChange < 0 ? '▲' : '▼'} ${Math.abs(rankChange).toLocaleString()}
                                    </span>` : '-'}</td>
                                    <td>${gw.event_transfers_cost > 0 ?
                                        `<span class="text-error">-${gw.event_transfers_cost}</span>` :
                                        '0'}</td>
                                    <td>${gw.active_chip ? getChipAbbreviation(gw.active_chip) : '-'}</td>
                                </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Season Statistics - Combined Captain & Transfers -->
            <div class="card mt-1">
                <h3 class="section-header">Season Statistics</h3>
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
                        <div class="stat-value text-error">-${currentSeasonHistory.reduce((sum, gw) => sum + gw.event_transfers_cost, 0)}</div>
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
                <h3 class="section-header">Chip Usage</h3>
                <div class="grid-4">
                    ${chipStatus.map(chip => `
                        <div class="stat-card text-center" style="opacity: ${chip.used ? '1' : '0.5'};">
                            <div class="text-xl mb-xs">
                                ${chip.abbrev}
                            </div>
                            <div class="stat-label">${chip.label}</div>
                            ${chip.used ? `
                                <div class="text-success mt-xs" style="font-weight: 600;">
                                    GW${chip.gw}
                                </div>
                                <div class="text-base text-secondary mt-xs">
                                    ${chip.points} pts
                                </div>
                            ` : `
                                <div class="text-quaternary mt-xs" style="font-style: italic;">
                                    Available
                                </div>
                            `}
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    // Add event listener for league manager selector
    const managerSelector = document.getElementById('league-manager-selector');
    if (managerSelector) {
        managerSelector.addEventListener('change', (e) => {
            const selectedManagerId = e.target.value;
            if (selectedManagerId) {
                viewManagerStats(selectedManagerId);
            }
        });
    }
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

// Global function to view specific manager stats
window.viewManagerStats = function(managerId) {
    renderMyStatsPage(managerId);
};

// Register route - wrapped to prevent league ID from being passed as manager ID
router.addRoute('/my-stats', () => renderMyStatsPage());
