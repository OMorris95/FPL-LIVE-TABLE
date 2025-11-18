// Player Radar Chart Component
// Shows normalized player stats on a radar chart

/**
 * Initializes the player radar chart
 * @param {string} containerId - ID of the container element
 * @param {string} canvasId - ID of the canvas element for the chart
 */
async function initializePlayerRadarChart(containerId, canvasId) {
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
        range: 'season',
        currentGw,
        chart: null
    };

    // Render UI
    radar_renderUI(container, canvasId, state);

    // Initialize with default player (most selected player)
    const topPlayer = [...bootstrapData.elements]
        .sort((a, b) => parseFloat(b.selected_by_percent) - parseFloat(a.selected_by_percent))[0];

    await radar_selectPlayer(topPlayer.id, state, canvasId);
}

/**
 * Renders the radar chart UI
 */
function radar_renderUI(container, canvasId, state) {
    const html = `
        <div class="radar-chart-controls">
            <div class="radar-header">
                <div class="player-search-section-radar">
                    <input
                        type="text"
                        id="radar-player-search-input"
                        class="player-search-input"
                        placeholder="Search for a player..."
                        autocomplete="off"
                    />
                    <div id="radar-player-search-results" class="player-search-results"></div>
                </div>

                <div class="range-select-container">
                    <label for="radar-range-select">Range:</label>
                    <select id="radar-range-select" class="range-select">
                        <option value="5gw">Last 5GW</option>
                        <option value="10gw">Last 10GW</option>
                        <option value="season" selected>Full Season</option>
                    </select>
                </div>
            </div>

            <div class="selected-player-display-radar" id="selected-player-display-radar">
                <!-- Selected player info will appear here -->
            </div>
        </div>
    `;

    container.insertAdjacentHTML('afterbegin', html);

    // Attach event listeners
    radar_attachSearchListeners(state, canvasId);
    radar_attachRangeListener(state, canvasId);
}

/**
 * Attaches event listeners to player search input
 */
function radar_attachSearchListeners(state, canvasId) {
    const searchInput = document.getElementById('radar-player-search-input');
    const resultsContainer = document.getElementById('radar-player-search-results');

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

            radar_displaySearchResults(results, state, canvasId);
        }, 300);
    });

    // Close results when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.player-search-section-radar')) {
            resultsContainer.classList.remove('active');
        }
    });
}

/**
 * Displays player search results
 */
function radar_displaySearchResults(results, state, canvasId) {
    const resultsContainer = document.getElementById('radar-player-search-results');

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
                <span class="player-meta">${radar_getPositionAbbr(player.element_type)} • £${(player.now_cost / 10).toFixed(1)}m</span>
            </div>
        `;
    }).join('');

    resultsContainer.innerHTML = html;
    resultsContainer.classList.add('active');

    // Attach click handlers to results
    resultsContainer.querySelectorAll('.player-search-result:not(.disabled)').forEach(el => {
        el.addEventListener('click', async () => {
            const playerId = parseInt(el.dataset.playerId);
            await radar_selectPlayer(playerId, state, canvasId);
            document.getElementById('radar-player-search-input').value = '';
            resultsContainer.classList.remove('active');
        });
    });
}

/**
 * Selects a player and updates the chart
 */
async function radar_selectPlayer(playerId, state, canvasId) {
    // Find player in bootstrap data
    const player = state.allPlayers.find(p => p.id === playerId);
    if (!player) {
        console.error(`Player ${playerId} not found`);
        return;
    }

    state.selectedPlayer = player;

    // Update selected player display
    radar_renderSelectedPlayer(state);

    // Update chart
    await radar_updateChart(state, canvasId);
}

/**
 * Renders selected player display
 */
function radar_renderSelectedPlayer(state) {
    const container = document.getElementById('selected-player-display-radar');

    if (!state.selectedPlayer) {
        container.innerHTML = '';
        return;
    }

    const player = state.selectedPlayer;
    const positionName = radar_getPositionName(player.element_type);

    container.innerHTML = `
        <div class="selected-player-info-radar">
            <strong>${player.web_name}</strong>
            <span class="player-meta-inline">${positionName}</span>
        </div>
    `;
}

/**
 * Attaches event listener to range dropdown
 */
function radar_attachRangeListener(state, canvasId) {
    const select = document.getElementById('radar-range-select');

    select.addEventListener('change', async (e) => {
        state.range = e.target.value;
        await radar_updateChart(state, canvasId);
    });
}

/**
 * Updates the chart with current state
 */
async function radar_updateChart(state, canvasId) {
    if (!state.selectedPlayer) {
        if (state.chart) {
            state.chart.destroy();
            state.chart = null;
        }
        return;
    }

    try {
        // Fetch player history if needed for range
        let playerHistory = null;
        if (state.range !== 'season') {
            playerHistory = await getPlayerHistory(state.selectedPlayer.id);
        }

        // Calculate radar data
        const radarData = await calculateRadarData(
            state.selectedPlayer,
            state.allPlayers,
            state.range,
            state.currentGw,
            playerHistory
        );

        if (!radarData) {
            console.error('Failed to calculate radar data');
            return;
        }

        // Prepare chart data
        const chartData = {
            labels: radarData.labels,
            datasets: [{
                label: state.selectedPlayer.web_name,
                data: radarData.data,
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                borderColor: '#3b82f6',
                borderWidth: 2,
                pointBackgroundColor: '#3b82f6',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#3b82f6'
            }]
        };

        // Destroy existing chart
        if (state.chart) {
            state.chart.destroy();
        }

        // Create new radar chart
        const chartInstance = createChart(canvasId, createRadarChartConfig, chartData, {
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        stepSize: 20
                    }
                }
            }
        });

        state.chart = chartInstance.chart;

    } catch (error) {
        console.error('Error updating radar chart:', error);
    }
}

/**
 * Helper function to get position abbreviation
 */
function radar_getPositionAbbr(elementType) {
    const positions = {
        1: 'GKP',
        2: 'DEF',
        3: 'MID',
        4: 'FWD'
    };
    return positions[elementType] || '';
}

/**
 * Helper function to get position full name
 */
function radar_getPositionName(elementType) {
    const positions = {
        1: 'Goalkeeper',
        2: 'Defender',
        3: 'Midfielder',
        4: 'Forward'
    };
    return positions[elementType] || '';
}
