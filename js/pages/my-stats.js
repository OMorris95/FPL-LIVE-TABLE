// My Stats Page - Personal Manager Dashboard

async function renderMyStatsPage(state = {}) {
    const app = document.getElementById('app');
    const nav = document.getElementById('main-nav');

    // Show navigation
    nav.style.display = 'block';

    // Extract paramManagerId from state (backwards compatible)
    const paramManagerId = state.managerId || state;

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

    // Create chip lookup: gameweek -> chip name
    const chipByGameweek = {};
    usedChips.forEach(chip => {
        chipByGameweek[chip.event] = chip.name;
    });

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
                    <div class="stat-card clickable-stat" ${bestGw ? `data-gameweek="${bestGw.event}" data-source="gw"` : ''} style="cursor: ${bestGw ? 'pointer' : 'default'};">
                        <div class="stat-value">${bestGw ? bestGw.points : 0}</div>
                        <div class="stat-label">Best GW${bestGw ? bestGw.event : ''}</div>
                    </div>
                    <div class="stat-card clickable-stat" ${worstGw ? `data-gameweek="${worstGw.event}" data-source="gw"` : ''} style="cursor: ${worstGw ? 'pointer' : 'default'};">
                        <div class="stat-value">${worstGw ? worstGw.points : 0}</div>
                        <div class="stat-label">Worst GW${worstGw ? worstGw.event : ''}</div>
                    </div>
                </div>

                <!-- GW Details Expansion Container (for Best/Worst GW) -->
                <div id="gw-details-container" class="hidden" style="margin-top: 1rem; border-top: 1px solid var(--border-color); padding-top: 1rem;">
                    <div class="details-content"></div>
                </div>

                <!-- Chip Usage - Inline -->
                <div style="border-top: 1px solid var(--border-color); padding-top: 1rem; margin-top: 1rem;">
                    <h4 style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px;">Chip Usage</h4>
                    <div class="grid-4" style="gap: 0.5rem;">
                        ${chipStatus.map(chip => `
                            <div class="stat-card text-center ${chip.used ? 'clickable-stat' : ''}"
                                 ${chip.used ? `data-gameweek="${chip.gw}" data-source="chip"` : ''}
                                 style="opacity: ${chip.used ? '1' : '0.5'}; padding: 0.75rem; cursor: ${chip.used ? 'pointer' : 'default'};">
                                <div style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.25rem;">
                                    ${chip.abbrev}
                                </div>
                                <div style="font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">
                                    ${chip.label}
                                </div>
                                ${chip.used ? `
                                    <div class="text-success" style="font-weight: 600; font-size: 0.85rem; margin-top: 0.25rem;">
                                        GW${chip.gw} (${chip.points} pts)
                                    </div>
                                ` : `
                                    <div class="text-quaternary" style="font-style: italic; font-size: 0.75rem; margin-top: 0.25rem;">
                                        Available
                                    </div>
                                `}
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Chip Details Expansion Container (for chip clicks) -->
                <div id="chip-details-container" class="hidden" style="margin-top: 1rem; border-top: 1px solid var(--border-color); padding-top: 1rem;">
                    <div class="details-content"></div>
                </div>

                <p class="note-text mb-xs" style="margin-top: 1rem;">
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
                                <tr class="gameweek-row clickable-row" data-gameweek="${gw.event}" style="cursor: pointer;">
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
                                    <td>${chipByGameweek[gw.event] ? getChipAbbreviation(chipByGameweek[gw.event]) : '-'}</td>
                                </tr>
                                <tr class="details-row hidden" id="details-gw-${gw.event}">
                                    <td colspan="7">
                                        <div class="details-content"></div>
                                    </td>
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
        </div>
    `;

    // Inject matching styles from home page
    const style = document.createElement('style');
    style.textContent = `
        .details-content {
            background-color: #1f1f1f;
            padding: 20px;
            border-radius: 8px;
        }
        .details-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
        }
        .player-list {
            list-style: none;
            padding: 0;
        }
        .player-list li {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            border-bottom: 1px solid #333;
        }
        .player-list li:last-child {
            border-bottom: none;
        }
        .player-name { font-weight: bold; }
        .captain-icon { color: yellow; }
        .vice-captain-icon { color: #ccc; }
    `;
    document.head.appendChild(style);

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

    // Add click event listeners for stat cards
    document.querySelectorAll('.clickable-stat').forEach(card => {
        card.addEventListener('click', () => {
            const gameweek = parseInt(card.dataset.gameweek);
            const source = card.dataset.source || 'gw'; // Read from data-source attribute
            if (gameweek) {
                toggleGameweekDetails(gameweek, managerId, bootstrapData, source);
            }
        });
    });

    // Add click event listeners for gameweek table rows
    document.querySelectorAll('.gameweek-row').forEach(row => {
        row.addEventListener('click', () => {
            const gameweek = parseInt(row.dataset.gameweek);
            if (gameweek) {
                toggleGameweekDetails(gameweek, managerId, bootstrapData, 'table');
            }
        });
    });
}

// Toggle gameweek details expansion
async function toggleGameweekDetails(gameweek, managerId, bootstrapData, clickSource = 'table') {
    let detailsContainer, detailsContent, clickedElement;

    if (clickSource === 'gw') {
        // Expanding from Best/Worst GW cards - use gw-details-container
        detailsContainer = document.getElementById('gw-details-container');
        detailsContent = detailsContainer.querySelector('.details-content');
        clickedElement = document.querySelector(`.clickable-stat[data-gameweek="${gameweek}"][data-source="gw"]`);

        // If clicking same gameweek, close it
        if (!detailsContainer.classList.contains('hidden') &&
            detailsContainer.dataset.currentGameweek == gameweek) {
            detailsContainer.classList.add('hidden');
            // Remove expanded class from all stat cards
            document.querySelectorAll('.stat-card.expanded').forEach(card => card.classList.remove('expanded'));
            return;
        }

        // Close chip details container and all table detail rows
        const chipContainer = document.getElementById('chip-details-container');
        if (chipContainer) chipContainer.classList.add('hidden');
        document.querySelectorAll('.details-row').forEach(r => r.classList.add('hidden'));

        // Remove expanded class from all elements
        document.querySelectorAll('.stat-card.expanded').forEach(card => card.classList.remove('expanded'));
        document.querySelectorAll('.gameweek-row.expanded').forEach(row => row.classList.remove('expanded'));

    } else if (clickSource === 'chip') {
        // Expanding from chip cards - use chip-details-container
        detailsContainer = document.getElementById('chip-details-container');
        detailsContent = detailsContainer.querySelector('.details-content');
        clickedElement = document.querySelector(`.clickable-stat[data-gameweek="${gameweek}"][data-source="chip"]`);

        // If clicking same gameweek, close it
        if (!detailsContainer.classList.contains('hidden') &&
            detailsContainer.dataset.currentGameweek == gameweek) {
            detailsContainer.classList.add('hidden');
            // Remove expanded class from all stat cards
            document.querySelectorAll('.stat-card.expanded').forEach(card => card.classList.remove('expanded'));
            return;
        }

        // Close gw details container and all table detail rows
        const gwContainer = document.getElementById('gw-details-container');
        if (gwContainer) gwContainer.classList.add('hidden');
        document.querySelectorAll('.details-row').forEach(r => r.classList.add('hidden'));

        // Remove expanded class from all elements
        document.querySelectorAll('.stat-card.expanded').forEach(card => card.classList.remove('expanded'));
        document.querySelectorAll('.gameweek-row.expanded').forEach(row => row.classList.remove('expanded'));

    } else {
        // Expanding from table row click - use table row details
        const detailsRow = document.getElementById(`details-gw-${gameweek}`);
        detailsContainer = detailsRow;
        detailsContent = detailsRow.querySelector('.details-content');
        clickedElement = document.querySelector(`.gameweek-row[data-gameweek="${gameweek}"]`);

        // If clicking same row, close it
        if (!detailsRow.classList.contains('hidden')) {
            detailsRow.classList.add('hidden');
            // Remove expanded class from all gameweek rows
            document.querySelectorAll('.gameweek-row.expanded').forEach(row => row.classList.remove('expanded'));
            return;
        }

        // Close all other table detail rows and both card containers
        document.querySelectorAll('.details-row').forEach(r => r.classList.add('hidden'));
        const gwContainer = document.getElementById('gw-details-container');
        if (gwContainer) gwContainer.classList.add('hidden');
        const chipContainer = document.getElementById('chip-details-container');
        if (chipContainer) chipContainer.classList.add('hidden');

        // Remove expanded class from all elements
        document.querySelectorAll('.stat-card.expanded').forEach(card => card.classList.remove('expanded'));
        document.querySelectorAll('.gameweek-row.expanded').forEach(row => row.classList.remove('expanded'));
    }

    // Add expanded class to clicked element
    if (clickedElement) {
        clickedElement.classList.add('expanded');
    }

    // Show loading
    detailsContainer.classList.remove('hidden');
    detailsContainer.dataset.currentGameweek = gameweek;
    detailsContent.innerHTML = '<p style="text-align: center; padding: 1rem;">Loading GW' + gameweek + ' details...</p>';

    try {
        // Fetch picks for this specific gameweek
        const picksData = await getManagerPicks(managerId, gameweek);

        if (!picksData || !picksData.picks) {
            throw new Error('Could not fetch gameweek picks');
        }

        // Fetch live gameweek data for points
        const liveData = await getLiveGameweekData(gameweek);
        const playerMap = createPlayerMap(bootstrapData);

        const livePointsMap = {};
        liveData.elements.forEach(p => {
            livePointsMap[p.id] = p.stats;
        });

        let startingXIHtml = '';
        let benchHtml = '';

        picksData.picks.forEach(pick => {
            const player = playerMap[pick.element];
            const stats = livePointsMap[pick.element] || {};
            const points = (stats.total_points || 0) * pick.multiplier;
            const minutes = stats.minutes || 0;

            let captaincy = '';
            if (pick.is_captain) captaincy = ' <span class="captain-icon">(C)</span>';
            if (pick.is_vice_captain) captaincy = ' <span class="vice-captain-icon">(V)</span>';

            const playerHtml = `
                <li>
                    <span class="player-name">${player.web_name}${captaincy}</span>
                    <span>Pts: ${points} | Mins: ${minutes}</span>
                </li>
            `;

            if (pick.position <= 11) {
                startingXIHtml += playerHtml;
            } else {
                benchHtml += playerHtml;
            }
        });

        const chip = picksData.active_chip ? picksData.active_chip.replace(/_/g, ' ').toUpperCase() : 'None';
        const transfersCost = picksData.entry_history.event_transfers_cost;

        const contentHtml = `
            <div class="details-grid">
                <div class="details-section">
                    <h3>Starting XI</h3>
                    <ul class="player-list">${startingXIHtml}</ul>
                </div>
                <div class="details-section">
                    <h3>Bench</h3>
                    <ul class="player-list">${benchHtml}</ul>
                </div>
                <div class="details-section">
                    <h3>Gameweek Info</h3>
                    <ul class="player-list">
                        <li><span>Points Hit:</span> <span>-${transfersCost}</span></li>
                        <li><span>Chip Played:</span> <span>${chip}</span></li>
                    </ul>
                </div>
            </div>
        `;

        detailsContent.innerHTML = contentHtml;

    } catch (error) {
        console.error('Error loading gameweek details:', error);
        detailsContent.innerHTML = `
            <p style="text-align: center; padding: 1rem; color: var(--text-error);">
                Could not load gameweek details. ${error.message}
            </p>
        `;
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
