// My Stats Component
// Shows manager stats with comparison bars vs overall FPL and selected league

/**
 * Initializes the My Stats component
 * @param {string} containerId - ID of the container element
 * @param {function} onLeagueChange - Optional callback when league changes
 */
async function initializeMyStats(containerId, onLeagueChange = null) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container ${containerId} not found`);
        return;
    }

    // Load saved IDs from localStorage
    const savedManagerId = localStorage.getItem('fpl_manager_id') || '';
    const savedLeagueId = localStorage.getItem('fpl_league_id') || '';

    // Initialize state
    const state = {
        managerId: savedManagerId,
        leagueId: savedLeagueId,
        managerData: null,
        leagueData: null,
        overallAverage: null,
        leagueAverage: null,
        squadAnalysis: null,
        currentRange: 'season',
        expandedPlayer: null,
        onLeagueChange: onLeagueChange
    };

    // Render UI
    myStats_renderUI(container, state);

    // If we have saved IDs, fetch data automatically
    if (savedManagerId) {
        await myStats_fetchData(state);

        // Trigger league change callback on initial load if league ID exists
        if (onLeagueChange && savedLeagueId) {
            onLeagueChange(savedLeagueId);
        }
    }
}

/**
 * Renders the My Stats UI
 */
function myStats_renderUI(container, state) {
    // Check if IDs are already saved
    const hasIds = state.managerId && state.managerId.trim() !== '';

    const html = `
        <div class="my-stats-container">
            ${!hasIds ? `
                <div class="my-stats-inputs">
                    <div class="my-stats-input-group">
                        <label for="manager-id-input">Manager ID</label>
                        <input
                            type="text"
                            id="manager-id-input"
                            class="my-stats-input"
                            placeholder="123456"
                            value="${state.managerId}"
                        />
                        <span class="input-help">Find in your team URL: .../entry/123456/...</span>
                    </div>

                    <div class="my-stats-input-group">
                        <label for="league-id-input">League ID</label>
                        <input
                            type="text"
                            id="league-id-input"
                            class="my-stats-input"
                            placeholder="789012"
                            value="${state.leagueId}"
                        />
                        <span class="input-help">Find in league URL: .../leagues/789012/...</span>
                    </div>

                    <button id="fetch-stats-btn" class="fetch-stats-btn">Load Stats</button>
                </div>
            ` : ''}

            <div id="my-stats-display" class="my-stats-display">
                ${state.managerData ? myStats_renderStats(state) : myStats_renderPlaceholder()}
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Attach event listeners only if inputs are shown
    if (!hasIds) {
        myStats_attachEventListeners(state);
    }
}

/**
 * Renders placeholder text when no data is loaded
 */
function myStats_renderPlaceholder() {
    const hasIds = localStorage.getItem('fpl_manager_id');

    if (hasIds) {
        return `
            <div class="my-stats-loading">
                <div class="spinner"></div>
                <p>Loading your stats...</p>
            </div>
        `;
    }

    return `
        <div class="my-stats-placeholder">
            <p>Enter your Manager ID and League ID to view your stats</p>
        </div>
    `;
}

/**
 * Renders the stats display with comparison bars
 */
function myStats_renderStats(state) {
    const { managerData, leagueData, overallAverage, leagueAverage } = state;

    if (!managerData || !managerData.current || managerData.current.length === 0) {
        return '<div class="my-stats-error">Unable to load manager data</div>';
    }

    // Get latest gameweek data
    const lastGw = managerData.current[managerData.current.length - 1];
    const totalPoints = lastGw.total_points;
    const lastGwPoints = lastGw.points - lastGw.event_transfers_cost;

    // Calculate bar widths and colors
    const overallComparison = myStats_calculateComparison(lastGwPoints, overallAverage);
    const leagueComparison = myStats_calculateComparison(lastGwPoints, leagueAverage);

    // Calculate marker positions (only show when above average)
    const overallMarkerPosition = lastGwPoints > overallAverage ? (overallAverage / lastGwPoints) * 100 : null;
    const leagueMarkerPosition = leagueAverage && lastGwPoints > leagueAverage ? (leagueAverage / lastGwPoints) * 100 : null;

    return `
        <div class="my-stats-info">
            <div class="manager-name">${managerData.name}</div>
            <div class="points-summary">
                <div class="points-item">
                    <span class="points-label">Total Points:</span>
                    <span class="points-value">${totalPoints}</span>
                </div>
                <div class="points-divider">|</div>
                <div class="points-item">
                    <span class="points-label">Last GW:</span>
                    <span class="points-value">${lastGwPoints}</span>
                </div>
            </div>
        </div>

        <div class="rank-chart-container">
            <div class="chart-container line">
                <canvas id="rank-over-time-chart"></canvas>
            </div>
        </div>

        <div class="comparison-bars">
            <div class="comparison-bar-container">
                <div class="comparison-label">Last GW vs Overall FPL</div>
                <div class="bar-track">
                    <div class="bar-fill ${overallComparison.color}" style="width: ${overallComparison.percentage}%"></div>
                    ${overallMarkerPosition !== null ? `<div class="bar-average-marker" style="left: ${overallMarkerPosition}%"></div>` : ''}
                </div>
                <div class="comparison-stats">
                    ${lastGwPoints} pts vs ${overallAverage} avg (Overall FPL)
                </div>
            </div>

            ${leagueData ? `
                <div class="comparison-bar-container">
                    <div class="comparison-label">Last GW vs ${leagueData.league.name}</div>
                    <div class="bar-track">
                        <div class="bar-fill ${leagueComparison.color}" style="width: ${leagueComparison.percentage}%"></div>
                        ${leagueMarkerPosition !== null ? `<div class="bar-average-marker" style="left: ${leagueMarkerPosition}%"></div>` : ''}
                    </div>
                    <div class="comparison-stats">
                        ${lastGwPoints} pts vs ${leagueAverage} avg (${leagueData.league.name})
                    </div>
                </div>
            ` : ''}
        </div>

        <div id="squad-analysis-section" class="squad-analysis-section">
            <!-- Squad analysis will be rendered here -->
        </div>
    `;
}

/**
 * Calculates comparison data for bar display
 */
function myStats_calculateComparison(playerPoints, average) {
    if (!average || average === 0) {
        return { percentage: 0, color: 'neutral' };
    }

    const percentage = Math.min((playerPoints / average) * 100, 200); // Cap at 200%
    const color = playerPoints >= average ? 'above-average' : 'below-average';

    return { percentage, color };
}

/**
 * Renders the rank over time chart
 */
function myStats_renderRankChart(managerHistory, state) {
    const canvas = document.getElementById('rank-over-time-chart');
    if (!canvas) {
        console.error('Rank chart canvas not found');
        return;
    }

    // Destroy existing chart if it exists
    if (state.rankChart) {
        state.rankChart.destroy();
    }

    // Extract rank data from manager history
    const rankData = managerHistory.current.map(gw => ({
        gameweek: gw.event,
        rank: gw.overall_rank
    }));

    // Prepare chart data
    const labels = rankData.map(d => `GW${d.gameweek}`);
    const data = rankData.map(d => d.rank);

    // Create chart config with inverted Y-axis
    const chartInstance = createChart('rank-over-time-chart', createLineChartConfig, {
        labels,
        datasets: [{
            label: 'Overall Rank',
            data,
            borderColor: '#3b82f6',
            backgroundColor: '#3b82f6'
        }]
    }, {
        scales: {
            y: {
                reverse: true,  // Invert Y-axis so rank 1 is at top
                ticks: {
                    callback: function(value) {
                        return value.toLocaleString();  // Format with commas
                    }
                }
            }
        },
        plugins: {
            legend: {
                display: false  // Hide legend since it's obvious what the chart shows
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return `Rank: ${context.parsed.y.toLocaleString()}`;
                    }
                }
            }
        }
    });

    // Store chart instance for cleanup
    state.rankChart = chartInstance.chart;
}

/**
 * Renders the squad analysis section
 */
function myStats_renderSquadAnalysis(state, teamMap) {
    const container = document.getElementById('squad-analysis-section');
    if (!container) return;

    if (!state.squadAnalysis || !state.squadAnalysis.players) {
        container.innerHTML = '<div class="squad-analysis-loading">Loading squad analysis...</div>';
        return;
    }

    const { players } = state.squadAnalysis;
    const currentRange = state.currentRange;

    const html = `
        <div class="squad-analysis-container">
            <div class="squad-analysis-header">
                <h4 class="squad-analysis-title">Squad Value Analysis</h4>
                <div class="range-tabs">
                    <button class="range-tab ${currentRange === 'season' ? 'active' : ''}" data-range="season">Full Season</button>
                    <button class="range-tab ${currentRange === '10gw' ? 'active' : ''}" data-range="10gw">Last 10 GW</button>
                    <button class="range-tab ${currentRange === '5gw' ? 'active' : ''}" data-range="5gw">Last 5 GW</button>
                </div>
            </div>

            <div class="squad-analysis-table">
                <div class="squad-table-header">
                    <div class="col-player">Player</div>
                    <div class="col-pos">Pos</div>
                    <div class="col-price">Price</div>
                    <div class="col-points">Pts</div>
                    <div class="col-ppm">Pts/£m</div>
                    <div class="col-vs-avg">
                        vs Avg
                        <span class="info-icon" data-tooltip="info">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <circle cx="7" cy="7" r="6.5" stroke="currentColor" stroke-width="1"/>
                                <text x="7" y="10" text-anchor="middle" font-size="10" font-weight="bold" fill="currentColor">i</text>
                            </svg>
                        </span>
                    </div>
                    <div class="col-action"></div>
                </div>

                ${players.map(player => myStats_renderPlayerRow(player, state, teamMap)).join('')}
            </div>

            <div class="squad-analysis-tooltip" id="squad-analysis-tooltip" style="display: none;">
                <div class="tooltip-content">
                    <h5>Performance Metrics Explained</h5>
                    <p><strong>Points Per Million (Pts/£m):</strong> Total points divided by player price. Shows value for money.</p>
                    <p><strong>Position Average:</strong> Weighted average of all players in the same position with 40%+ playing time (33% for Last 5 GW). This excludes bench fodder.</p>
                    <p><strong>vs Avg %:</strong> Shows how much better or worse your player performs compared to the position average.</p>
                    <p><strong>Color Coding:</strong></p>
                    <ul>
                        <li><span style="color: #4caf50;">Green (↑)</span> = Above average (good value)</li>
                        <li><span style="color: #f44336;">Red (↓)</span> = Below average (underperforming)</li>
                    </ul>
                    <p style="font-size: 0.85em; opacity: 0.8; margin-top: 8px;">Based on selected range: Full Season, Last 10 GW, or Last 5 GW</p>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Attach event listeners
    myStats_attachSquadAnalysisListeners(state);
    myStats_attachTooltipListeners();
}

/**
 * Renders a single player row in the squad analysis table
 */
function myStats_renderPlayerRow(player, state, teamMap) {
    const team = teamMap[player.team];
    const teamName = team ? team.short_name : '';
    const performanceClass = player.underperforming ? 'below-average' : 'above-average';
    const indicator = player.underperforming ? '↓' : '↑';
    const indicatorClass = player.underperforming ? 'indicator-negative' : 'indicator-positive';
    const isExpanded = state.expandedPlayer === player.id;

    return `
        <div class="squad-player-row ${performanceClass}" data-player-id="${player.id}">
            <div class="col-player">
                <span class="player-name">${player.web_name}</span>
                <span class="player-team">${teamName}</span>
            </div>
            <div class="col-pos">${getPositionAbbr(player.element_type)}</div>
            <div class="col-price">£${(player.now_cost / 10).toFixed(1)}m</div>
            <div class="col-points">${player.rangePoints}</div>
            <div class="col-ppm">${player.pointsPerMillion.toFixed(2)}</div>
            <div class="col-vs-avg">
                <span class="${indicatorClass}">
                    ${indicator} ${Math.abs(player.percentDifference).toFixed(1)}%
                </span>
            </div>
            <div class="col-action">
                ${player.underperforming ? `
                    <button class="view-replacements-btn" data-player-id="${player.id}">
                        ${isExpanded ? 'Hide' : 'View'} Alternatives
                    </button>
                ` : ''}
            </div>
        </div>

        ${isExpanded ? myStats_renderReplacements(player, state, teamMap) : ''}
    `;
}

/**
 * Renders replacement suggestions for a player
 */
function myStats_renderReplacements(player, state, teamMap) {
    const replacements = state.squadAnalysis.replacements[player.id] || [];

    if (replacements.length === 0) {
        return `
            <div class="replacements-section">
                <div class="no-replacements">No better alternatives found</div>
            </div>
        `;
    }

    return `
        <div class="replacements-section">
            <div class="replacements-header">Suggested Replacements for ${player.web_name}</div>
            <div class="replacements-table">
                ${replacements.map(rep => {
                    const team = teamMap[rep.team];
                    const teamName = team ? team.short_name : '';
                    return `
                        <div class="replacement-player-row">
                            <div class="col-player">
                                <span class="player-name">${rep.web_name}</span>
                                <span class="player-team">${teamName}</span>
                            </div>
                            <div class="col-pos">${getPositionAbbr(rep.element_type)}</div>
                            <div class="col-price">£${rep.price.toFixed(1)}m</div>
                            <div class="col-points">${rep.rangePoints}</div>
                            <div class="col-ppm highlight">${rep.pointsPerMillion.toFixed(2)}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

/**
 * Attaches event listeners for squad analysis
 */
function myStats_attachSquadAnalysisListeners(state) {
    // Range tab listeners
    const rangeTabs = document.querySelectorAll('.range-tab');
    rangeTabs.forEach(tab => {
        tab.addEventListener('click', async () => {
            const range = tab.dataset.range;
            if (range !== state.currentRange) {
                state.currentRange = range;
                await myStats_fetchSquadAnalysis(state, range);
            }
        });
    });

    // View replacements listeners
    const viewBtns = document.querySelectorAll('.view-replacements-btn');
    viewBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const playerId = parseInt(btn.dataset.playerId);
            if (state.expandedPlayer === playerId) {
                state.expandedPlayer = null;
            } else {
                state.expandedPlayer = playerId;
            }
            // Re-render squad analysis
            const teamMap = createTeamMap({ teams: state.squadAnalysis.teams });
            myStats_renderSquadAnalysis(state, teamMap);
        });
    });
}

/**
 * Attaches tooltip hover listeners for info icon
 */
function myStats_attachTooltipListeners() {
    const infoIcon = document.querySelector('.info-icon[data-tooltip="info"]');
    const tooltip = document.getElementById('squad-analysis-tooltip');

    if (!infoIcon || !tooltip) return;

    infoIcon.addEventListener('mouseenter', (e) => {
        const rect = infoIcon.getBoundingClientRect();
        tooltip.style.display = 'block';
        tooltip.style.top = `${rect.bottom + window.scrollY + 8}px`;
        tooltip.style.left = `${rect.left + window.scrollX - 150}px`; // Center tooltip above icon
    });

    infoIcon.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
    });

    tooltip.addEventListener('mouseenter', () => {
        tooltip.style.display = 'block';
    });

    tooltip.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
    });
}

/**
 * Attaches event listeners
 */
function myStats_attachEventListeners(state) {
    const fetchBtn = document.getElementById('fetch-stats-btn');
    const managerInput = document.getElementById('manager-id-input');
    const leagueInput = document.getElementById('league-id-input');

    if (fetchBtn) {
        fetchBtn.addEventListener('click', async () => {
            const managerId = managerInput.value.trim();
            const leagueId = leagueInput.value.trim();

            if (!managerId) {
                alert('Please enter a Manager ID');
                return;
            }

            // Save to localStorage
            localStorage.setItem('fpl_manager_id', managerId);
            localStorage.setItem('fpl_league_id', leagueId);

            // Update state
            state.managerId = managerId;
            state.leagueId = leagueId;

            // Fetch data
            await myStats_fetchData(state);

            // Trigger league change callback if provided
            if (state.onLeagueChange && leagueId) {
                state.onLeagueChange(leagueId);
            }
        });
    }

    // Allow Enter key to submit
    [managerInput, leagueInput].forEach(input => {
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    fetchBtn.click();
                }
            });
        }
    });
}

/**
 * Fetches manager and league data
 */
async function myStats_fetchData(state) {
    const container = document.getElementById('my-stats-display');
    if (!container) return;

    try {
        container.innerHTML = '<div class="my-stats-loading">Loading stats...</div>';

        // Fetch manager data
        const managerData = await getManagerData(state.managerId);
        const managerHistory = await getManagerHistory(state.managerId);

        // Get current gameweek
        const bootstrapData = await getBootstrapData();
        const currentGw = getCurrentGameweek(bootstrapData);

        // Get overall average from bootstrap data
        // Use last completed gameweek since average_entry_score is only populated after GW finishes
        const lastCompletedGw = getLastCompletedGameweek(bootstrapData);
        const targetGw = lastCompletedGw || currentGw;
        const targetEvent = bootstrapData.events.find(e => e.id === targetGw);
        const overallAverage = targetEvent?.average_entry_score || null;

        // Fetch league data if league ID provided
        let leagueData = null;
        let leagueAverage = null;

        if (state.leagueId) {
            try {
                leagueData = await getLeagueData(state.leagueId, 1);

                // Calculate league average for last GW
                if (leagueData && leagueData.standings && leagueData.standings.results) {
                    const leagueManagers = leagueData.standings.results;
                    const totalLastGwPoints = leagueManagers.reduce((sum, m) => sum + (m.event_total || 0), 0);
                    leagueAverage = Math.round(totalLastGwPoints / leagueManagers.length);
                }
            } catch (error) {
                console.error('Failed to fetch league data:', error);
            }
        }

        // Update state
        state.managerData = { ...managerData, current: managerHistory.current };
        state.leagueData = leagueData;
        state.overallAverage = overallAverage;
        state.leagueAverage = leagueAverage;

        // Re-render with data
        const displayContainer = document.querySelector('.my-stats-container');
        if (displayContainer) {
            const newContainer = document.createElement('div');
            newContainer.id = displayContainer.parentElement.id;
            displayContainer.parentElement.replaceChild(newContainer, displayContainer);
            myStats_renderUI(newContainer, state);

            // Render rank chart after DOM is updated
            setTimeout(() => {
                myStats_renderRankChart(managerHistory, state);
            }, 0);

            // Fetch squad analysis after UI is rendered
            setTimeout(async () => {
                await myStats_fetchSquadAnalysis(state, state.currentRange);
            }, 100);
        }

    } catch (error) {
        console.error('Error fetching manager stats:', error);
        container.innerHTML = '<div class="my-stats-error">Failed to load stats. Please check your Manager ID.</div>';
    }
}

/**
 * Fetches and analyzes squad data
 */
async function myStats_fetchSquadAnalysis(state, range) {
    try {
        // Get bootstrap data
        const bootstrapData = await getBootstrapData();
        const currentGw = getCurrentGameweek(bootstrapData);
        const allPlayers = bootstrapData.elements;
        const teamMap = createTeamMap(bootstrapData);

        // Get manager's current picks
        const picksData = await getManagerPicks(state.managerId, currentGw);
        if (!picksData || !picksData.picks) {
            console.error('No picks data available');
            return;
        }

        const squadPlayerIds = picksData.picks.map(p => p.element);

        // Get full player data for squad
        const playerMap = createPlayerMap(bootstrapData);
        const squadPlayers = squadPlayerIds.map(id => playerMap[id]).filter(p => p);

        // Fetch pre-computed stats from backend
        const recentStatsResponse = await fetch('/api/player-stats/recent');
        if (!recentStatsResponse.ok) {
            throw new Error('Failed to fetch pre-computed player stats');
        }
        const recentStats = await recentStatsResponse.json();

        // Calculate position averages from pre-computed data
        const positionAverages = calculatePositionAverages(recentStats, range);

        // Analyze squad using pre-computed stats
        const analyzedSquad = analyzeSquadValue(squadPlayers, recentStats.players, positionAverages, range);

        // Find replacements for underperforming players
        const replacements = {};
        for (const player of analyzedSquad) {
            if (player.underperforming) {
                replacements[player.id] = findReplacements(
                    player,
                    allPlayers,
                    recentStats.players,
                    squadPlayerIds,
                    range,
                    5
                );
            }
        }

        // Sort squad by position, then by PPM
        analyzedSquad.sort((a, b) => {
            if (a.element_type !== b.element_type) {
                return a.element_type - b.element_type;
            }
            return b.pointsPerMillion - a.pointsPerMillion;
        });

        // Update state
        state.squadAnalysis = {
            players: analyzedSquad,
            replacements,
            teams: bootstrapData.teams
        };

        // Render squad analysis
        myStats_renderSquadAnalysis(state, teamMap);

    } catch (error) {
        console.error('Error fetching squad analysis:', error);
        const container = document.getElementById('squad-analysis-section');
        if (container) {
            container.innerHTML = '<div class="squad-analysis-error">Failed to load squad analysis</div>';
        }
    }
}
