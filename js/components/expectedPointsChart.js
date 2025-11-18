// Expected Points Chart Component
// Shows actual FPL points vs expected points for a single player

/**
 * Initializes the expected points chart
 * @param {string} containerId - ID of the container element
 * @param {string} canvasId - ID of the canvas element for the chart
 */
async function initializeExpectedPointsChart(containerId, canvasId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container ${containerId} not found`);
        return;
    }

    // Get bootstrap data for player list
    const bootstrapData = await getBootstrapData();
    const currentGw = getCurrentGameweek(bootstrapData);

    // Initialize state
    const state = {
        selectedPlayer: null,
        allPlayers: bootstrapData.elements,
        teamMap: createTeamMap(bootstrapData),
        gameweekRange: {
            start: Math.max(1, currentGw - 9),
            end: currentGw
        },
        preset: '10gw',
        currentGw,
        chart: null,
        pointsData: null
    };

    // Render UI
    expPts_renderUI(container, canvasId, state);

    // Initialize with default player (most selected player)
    const topPlayer = [...bootstrapData.elements]
        .sort((a, b) => parseFloat(b.selected_by_percent) - parseFloat(a.selected_by_percent))[0];

    await expPts_selectPlayer(topPlayer.id, state, canvasId);
}

/**
 * Renders the expected points UI
 */
function expPts_renderUI(container, canvasId, state) {
    const html = `
        <div class="expected-points-controls">
            <div class="expected-points-header">
                <div class="player-search-section-exp">
                    <input
                        type="text"
                        id="exp-player-search-input"
                        class="player-search-input"
                        placeholder="Search for a player..."
                        autocomplete="off"
                    />
                    <div id="exp-player-search-results" class="player-search-results"></div>
                </div>

                <div class="range-select-container">
                    <label for="exp-range-select">Range:</label>
                    <select id="exp-range-select" class="range-select">
                        <option value="5gw">5GW</option>
                        <option value="10gw" selected>10GW</option>
                        <option value="season">Full Season</option>
                    </select>
                </div>

                <div id="performance-indicator" class="performance-indicator"></div>
            </div>

            <div class="selected-player-display" id="selected-player-display">
                <!-- Selected player name will appear here -->
            </div>
        </div>
    `;

    container.insertAdjacentHTML('afterbegin', html);

    // Attach event listeners
    expPts_attachSearchListeners(state, canvasId);
    expPts_attachRangeListener(state, canvasId);
}

/**
 * Attaches event listeners to player search input
 */
function expPts_attachSearchListeners(state, canvasId) {
    const searchInput = document.getElementById('exp-player-search-input');
    const resultsContainer = document.getElementById('exp-player-search-results');

    let searchTimeout;

    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim().toLowerCase();

        if (query.length < 2) {
            resultsContainer.innerHTML = '';
            resultsContainer.classList.remove('active');
            return;
        }

        searchTimeout = setTimeout(() => {
            const results = state.allPlayers.filter(player =>
                player.web_name.toLowerCase().includes(query) ||
                player.first_name.toLowerCase().includes(query) ||
                player.second_name.toLowerCase().includes(query)
            ).slice(0, 10);

            expPts_displaySearchResults(results, state, canvasId);
        }, 300);
    });

    // Close results when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.player-search-section-exp')) {
            resultsContainer.classList.remove('active');
        }
    });
}

/**
 * Displays player search results
 */
function expPts_displaySearchResults(results, state, canvasId) {
    const resultsContainer = document.getElementById('exp-player-search-results');

    if (results.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">No players found</div>';
        resultsContainer.classList.add('active');
        return;
    }

    const html = results.map(player => {
        const isSelected = state.selectedPlayer && state.selectedPlayer.id === player.id;

        return `
            <div class="player-search-result ${isSelected ? 'disabled' : ''}"
                 data-player-id="${player.id}">
                <span class="player-name">${player.web_name}</span>
                <span class="player-meta">${expPts_getPositionAbbr(player.element_type)} • £${(player.now_cost / 10).toFixed(1)}m</span>
            </div>
        `;
    }).join('');

    resultsContainer.innerHTML = html;
    resultsContainer.classList.add('active');

    // Attach click handlers to results
    resultsContainer.querySelectorAll('.player-search-result:not(.disabled)').forEach(el => {
        el.addEventListener('click', async () => {
            const playerId = parseInt(el.dataset.playerId);
            await expPts_selectPlayer(playerId, state, canvasId);
            document.getElementById('exp-player-search-input').value = '';
            resultsContainer.classList.remove('active');
        });
    });
}

/**
 * Selects a player and updates the chart
 */
async function expPts_selectPlayer(playerId, state, canvasId) {
    // Find player in bootstrap data
    const player = state.allPlayers.find(p => p.id === playerId);
    if (!player) {
        console.error(`Player ${playerId} not found`);
        return;
    }

    state.selectedPlayer = player;

    // Update selected player display
    expPts_renderSelectedPlayer(state);

    // Fetch player history and update chart
    await expPts_updateChart(state, canvasId);
}

/**
 * Renders selected player display
 */
function expPts_renderSelectedPlayer(state) {
    const container = document.getElementById('selected-player-display');

    if (!state.selectedPlayer) {
        container.innerHTML = '';
        return;
    }

    const player = state.selectedPlayer;
    container.innerHTML = `
        <div class="selected-player-name">
            <strong>${player.web_name}</strong>
            <span class="player-meta-inline">${expPts_getPositionAbbr(player.element_type)} • ${expPts_getTeamName(player.team, state.teamMap)}</span>
        </div>
    `;
}

/**
 * Attaches event listener to range dropdown
 */
function expPts_attachRangeListener(state, canvasId) {
    const select = document.getElementById('exp-range-select');

    select.addEventListener('change', async (e) => {
        const range = e.target.value;
        state.preset = range;

        // Update gameweek range
        switch (range) {
            case '5gw':
                state.gameweekRange = {
                    start: Math.max(1, state.currentGw - 4),
                    end: state.currentGw
                };
                break;
            case '10gw':
                state.gameweekRange = {
                    start: Math.max(1, state.currentGw - 9),
                    end: state.currentGw
                };
                break;
            case 'season':
                state.gameweekRange = {
                    start: 1,
                    end: state.currentGw
                };
                break;
        }

        await expPts_updateChart(state, canvasId);
    });
}

/**
 * Updates the chart with current state
 */
async function expPts_updateChart(state, canvasId) {
    if (!state.selectedPlayer) {
        // Destroy existing chart
        if (state.chart) {
            state.chart.destroy();
            state.chart = null;
        }
        return;
    }

    try {
        // Fetch player history
        const playerHistory = await getPlayerHistory(state.selectedPlayer.id);

        // Calculate expected points for all gameweeks
        const pointsData = calculateAllExpectedPoints(playerHistory, state.selectedPlayer.element_type);
        state.pointsData = pointsData;

        // Calculate average difference for performance indicator
        const avgDifference = calculateAverageDifference(
            pointsData,
            state.gameweekRange.start,
            state.gameweekRange.end
        );

        // Update performance indicator
        expPts_updatePerformanceIndicator(avgDifference);

        // Process data for chart
        const chartData = expPts_processPlayerData(pointsData, state.gameweekRange);

        // Destroy existing chart
        if (state.chart) {
            state.chart.destroy();
        }

        // Create new chart
        const chartInstance = createChart(canvasId, createLineChartConfig, chartData, {
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom'
                }
            }
        });

        state.chart = chartInstance.chart;

    } catch (error) {
        console.error('Error updating expected points chart:', error);
    }
}

/**
 * Updates the performance indicator box
 */
function expPts_updatePerformanceIndicator(avgDifference) {
    const indicator = document.getElementById('performance-indicator');

    if (avgDifference === 0) {
        indicator.innerHTML = '<div class="performance-neutral">On Target</div>';
        return;
    }

    const isOverperforming = avgDifference > 0;
    const className = isOverperforming ? 'performance-positive' : 'performance-negative';
    const arrow = isOverperforming ? '↑' : '↓';
    const sign = isOverperforming ? '+' : '';

    indicator.innerHTML = `
        <div class="${className}">
            <span class="performance-value">${sign}${avgDifference.toFixed(1)}</span>
            <span class="performance-arrow">${arrow}</span>
        </div>
    `;
}

/**
 * Processes player data for chart
 */
function expPts_processPlayerData(pointsData, range) {
    const { start, end } = range;

    // Generate labels for gameweeks in range
    const labels = [];
    const actualData = [];
    const expectedData = [];

    for (let gw = start; gw <= end; gw++) {
        labels.push(`GW${gw}`);

        const gwData = pointsData.find(d => d.gw === gw);
        if (gwData && gwData.minutes > 0) {
            actualData.push(gwData.actualPoints);
            expectedData.push(gwData.expectedPoints);
        } else {
            actualData.push(null);
            expectedData.push(null);
        }
    }

    return {
        labels,
        datasets: [
            {
                label: 'Actual Points',
                data: actualData,
                borderColor: '#3b82f6',
                backgroundColor: '#3b82f6'
            },
            {
                label: 'Expected Points',
                data: expectedData,
                borderColor: '#f97316',
                backgroundColor: '#f97316',
                borderDash: [5, 5]
            }
        ]
    };
}

/**
 * Helper function to get position abbreviation
 */
function expPts_getPositionAbbr(elementType) {
    const positions = {
        1: 'GKP',
        2: 'DEF',
        3: 'MID',
        4: 'FWD'
    };
    return positions[elementType] || '';
}

/**
 * Helper function to get team abbreviation from team ID
 */
function expPts_getTeamName(teamId, teamMap) {
    const team = teamMap[teamId];
    return team ? team.short_name : `Team ${teamId}`;
}
