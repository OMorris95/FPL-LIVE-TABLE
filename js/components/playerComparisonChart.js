// Player Comparison Chart Component
// Multi-player performance comparison over time

/**
 * Initializes the player comparison chart
 * @param {string} containerId - ID of the container element
 * @param {string} canvasId - ID of the canvas element for the chart
 */
async function initializePlayerComparisonChart(containerId, canvasId) {
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
        selectedPlayers: [],
        allPlayers: bootstrapData.elements,
        selectedMetric: 'total_points',
        gameweekRange: {
            start: Math.max(1, currentGw - 9),
            end: currentGw
        },
        preset: '10gw',
        currentGw,
        chart: null
    };

    // Render UI
    compChart_renderUI(container, canvasId, state);

    // Initialize with default players (top 3 most selected)
    const topPlayers = [...bootstrapData.elements]
        .sort((a, b) => parseFloat(b.selected_by_percent) - parseFloat(a.selected_by_percent))
        .slice(0, 3);

    for (const player of topPlayers) {
        await compChart_addPlayer(player.id, state, canvasId);
    }
}

/**
 * Renders the player comparison UI
 */
function compChart_renderUI(container, canvasId, state) {
    const html = `
        <div class="player-comparison-controls">
            <div class="selected-players" id="selected-players">
                <!-- Selected player chips will appear here -->
            </div>

            <div class="chart-controls-row">
                <div class="player-search-section">
                    <input
                        type="text"
                        id="player-search-input"
                        class="player-search-input"
                        placeholder="Search for a player..."
                        autocomplete="off"
                    />
                    <div id="player-search-results" class="player-search-results"></div>
                </div>

                <div class="metric-select-container">
                    <label for="metric-select">Metric:</label>
                    <select id="metric-select" class="metric-select">
                        <option value="total_points">Points</option>
                        <option value="expected_goal_involvements">xGI (xG + xA)</option>
                        <option value="expected_goals">xG</option>
                        <option value="expected_assists">xA</option>
                        <option value="goals_scored">Goals</option>
                        <option value="assists">Assists</option>
                        <option value="bonus">Bonus</option>
                        <option value="ict_index">ICT Index</option>
                        <option value="bps">BPS</option>
                    </select>
                </div>

                <div class="range-select-container">
                    <label for="range-select">Range:</label>
                    <select id="range-select" class="range-select">
                        <option value="5gw">5GW</option>
                        <option value="10gw" selected>10GW</option>
                        <option value="season">Full Season</option>
                    </select>
                </div>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('afterbegin', html);

    // Attach event listeners
    compChart_attachSearchListeners(state, canvasId);
    compChart_attachMetricListener(state, canvasId);
    compChart_attachRangeListener(state, canvasId);
}

/**
 * Attaches event listeners to player search input
 */
function compChart_attachSearchListeners(state, canvasId) {
    const searchInput = document.getElementById('player-search-input');
    const resultsContainer = document.getElementById('player-search-results');

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

            compChart_displaySearchResults(results, state, canvasId);
        }, 300);
    });

    // Close results when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.player-search-section')) {
            resultsContainer.classList.remove('active');
        }
    });
}

/**
 * Displays player search results
 */
function compChart_displaySearchResults(results, state, canvasId) {
    const resultsContainer = document.getElementById('player-search-results');

    if (results.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">No players found</div>';
        resultsContainer.classList.add('active');
        return;
    }

    const html = results.map(player => {
        const isSelected = state.selectedPlayers.some(p => p.id === player.id);
        const team = state.allPlayers.find(p => p.id === player.id)?.team || 0;

        return `
            <div class="player-search-result ${isSelected ? 'disabled' : ''}"
                 data-player-id="${player.id}">
                <span class="player-name">${player.web_name}</span>
                <span class="player-meta">${compChart_getPositionAbbr(player.element_type)} • £${(player.now_cost / 10).toFixed(1)}m</span>
            </div>
        `;
    }).join('');

    resultsContainer.innerHTML = html;
    resultsContainer.classList.add('active');

    // Attach click handlers to results
    resultsContainer.querySelectorAll('.player-search-result:not(.disabled)').forEach(el => {
        el.addEventListener('click', async () => {
            const playerId = parseInt(el.dataset.playerId);
            await compChart_addPlayer(playerId, state, canvasId);
            document.getElementById('player-search-input').value = '';
            resultsContainer.classList.remove('active');
        });
    });
}

/**
 * Adds a player to the comparison
 */
async function compChart_addPlayer(playerId, state, canvasId) {
    // Check if already selected
    if (state.selectedPlayers.some(p => p.id === playerId)) {
        return;
    }

    // Check max limit
    if (state.selectedPlayers.length >= 5) {
        alert('Maximum 5 players can be compared');
        return;
    }

    // Find player in bootstrap data
    const player = state.allPlayers.find(p => p.id === playerId);
    if (!player) {
        console.error(`Player ${playerId} not found`);
        return;
    }

    // Add to selected players
    state.selectedPlayers.push(player);

    // Update UI
    compChart_renderSelectedPlayers(state, canvasId);

    // Update chart
    await compChart_updateChart(state, canvasId);
}

/**
 * Removes a player from the comparison
 */
async function compChart_removePlayer(playerId, state, canvasId) {
    state.selectedPlayers = state.selectedPlayers.filter(p => p.id !== playerId);
    compChart_renderSelectedPlayers(state, canvasId);
    await compChart_updateChart(state, canvasId);
}

/**
 * Renders selected player chips
 */
function compChart_renderSelectedPlayers(state, canvasId) {
    const container = document.getElementById('selected-players');

    if (state.selectedPlayers.length === 0) {
        container.innerHTML = '<div class="no-players-message">Select players to compare</div>';
        return;
    }

    const html = state.selectedPlayers.map(player => `
        <div class="player-chip">
            <span class="player-chip-name">${player.web_name}</span>
            <button class="player-chip-remove" data-player-id="${player.id}">&times;</button>
        </div>
    `).join('');

    container.innerHTML = html;

    // Attach remove handlers
    container.querySelectorAll('.player-chip-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const playerId = parseInt(btn.dataset.playerId);
            compChart_removePlayer(playerId, state, canvasId);
        });
    });
}

/**
 * Attaches event listener to metric dropdown
 */
function compChart_attachMetricListener(state, canvasId) {
    const select = document.getElementById('metric-select');
    select.addEventListener('change', async (e) => {
        state.selectedMetric = e.target.value;
        await compChart_updateChart(state, canvasId);
    });
}

/**
 * Attaches event listener to range dropdown
 */
function compChart_attachRangeListener(state, canvasId) {
    const select = document.getElementById('range-select');

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

        await compChart_updateChart(state, canvasId);
    });
}

/**
 * Updates the chart with current state
 */
async function compChart_updateChart(state, canvasId) {
    if (state.selectedPlayers.length === 0) {
        // Destroy existing chart
        if (state.chart) {
            state.chart.destroy();
            state.chart = null;
        }
        return;
    }

    // Show loading state
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext('2d');

    // Fetch data for all selected players
    const playerDataPromises = state.selectedPlayers.map(player =>
        getPlayerHistory(player.id)
    );

    try {
        const playerHistories = await Promise.all(playerDataPromises);

        // Process data
        const chartData = compChart_processPlayerData(
            state.selectedPlayers,
            playerHistories,
            state.selectedMetric,
            state.gameweekRange
        );

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
        console.error('Error updating chart:', error);
        // Show error message
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#ef4444';
        ctx.textAlign = 'center';
        ctx.fillText('Error loading player data', canvas.width / 2, canvas.height / 2);
    }
}

/**
 * Processes player data for chart
 */
function compChart_processPlayerData(players, histories, metric, range) {
    const { start, end } = range;

    // Generate labels for gameweeks in range
    const labels = [];
    for (let gw = start; gw <= end; gw++) {
        labels.push(`GW${gw}`);
    }

    // Create datasets
    const datasets = players.map((player, index) => {
        const history = histories[index];

        // Extract data for metric
        const data = [];
        for (let gw = start; gw <= end; gw++) {
            const gwData = history.history?.find(h => h.round === gw);
            const value = gwData ? (gwData[metric] || 0) : null;
            data.push(value);
        }

        return {
            label: player.web_name,
            data: data,
            // Colors will be auto-assigned by createLineChartConfig
        };
    });

    return {
        labels,
        datasets
    };
}

/**
 * Helper function to get position abbreviation
 */
function compChart_getPositionAbbr(elementType) {
    const positions = {
        1: 'GKP',
        2: 'DEF',
        3: 'MID',
        4: 'FWD'
    };
    return positions[elementType] || '';
}
