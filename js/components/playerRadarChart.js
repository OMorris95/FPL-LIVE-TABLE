// Player Radar Chart Component
// Shows normalized player stats on a radar chart - supports comparing 2 players

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
        selectedPlayers: [],  // Array of selected players (max 2)
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

    await radar_addPlayer(topPlayer.id, state, canvasId);
}

/**
 * Renders the radar chart UI
 */
function radar_renderUI(container, canvasId, state) {
    const html = `
        <div class="radar-chart-controls">
            <div class="selected-players-radar" id="selected-players-radar">
                <!-- Selected player chips will appear here -->
            </div>

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
        const isSelected = state.selectedPlayers.some(p => p.id === player.id);

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
            await radar_addPlayer(playerId, state, canvasId);
            document.getElementById('radar-player-search-input').value = '';
            resultsContainer.classList.remove('active');
        });
    });
}

/**
 * Adds a player to the radar chart
 */
async function radar_addPlayer(playerId, state, canvasId) {
    // Check if already selected
    if (state.selectedPlayers.some(p => p.id === playerId)) {
        return;
    }

    // Check max limit
    if (state.selectedPlayers.length >= 2) {
        alert('Maximum 2 players can be compared on the radar chart');
        return;
    }

    // Find player in bootstrap data
    const player = state.allPlayers.find(p => p.id === playerId);
    if (!player) {
        console.error(`Player ${playerId} not found`);
        return;
    }

    // Validate same position if adding second player
    if (state.selectedPlayers.length === 1) {
        const firstPlayer = state.selectedPlayers[0];
        if (firstPlayer.element_type !== player.element_type) {
            alert(`Players must be in the same position for comparison.\nFirst player: ${radar_getPositionName(firstPlayer.element_type)}\nSelected player: ${radar_getPositionName(player.element_type)}`);
            return;
        }
    }

    // Add to selected players
    state.selectedPlayers.push(player);

    // Update UI
    radar_renderSelectedPlayers(state, canvasId);

    // Update chart
    await radar_updateChart(state, canvasId);
}

/**
 * Removes a player from the radar chart
 */
async function radar_removePlayer(playerId, state, canvasId) {
    state.selectedPlayers = state.selectedPlayers.filter(p => p.id !== playerId);
    radar_renderSelectedPlayers(state, canvasId);
    await radar_updateChart(state, canvasId);
}

/**
 * Renders selected player chips
 */
function radar_renderSelectedPlayers(state, canvasId) {
    const container = document.getElementById('selected-players-radar');

    if (state.selectedPlayers.length === 0) {
        container.innerHTML = '<div class="no-players-message">Select players to compare (max 2, same position)</div>';
        return;
    }

    const html = state.selectedPlayers.map((player, index) => `
        <div class="player-chip-radar" data-player-index="${index}">
            <span class="player-chip-name">${player.web_name}</span>
            <button class="player-chip-remove-radar" data-player-id="${player.id}">&times;</button>
        </div>
    `).join('');

    container.innerHTML = html;

    // Attach remove handlers
    container.querySelectorAll('.player-chip-remove-radar').forEach(btn => {
        btn.addEventListener('click', () => {
            const playerId = parseInt(btn.dataset.playerId);
            radar_removePlayer(playerId, state, canvasId);
        });
    });
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
    if (state.selectedPlayers.length === 0) {
        if (state.chart) {
            state.chart.destroy();
            state.chart = null;
        }
        return;
    }

    try {
        // Define colors for each player
        const playerColors = [
            { border: '#ef4444', bg: 'rgba(239, 68, 68, 0.2)' },  // Red/Pink
            { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.2)' }   // Blue
        ];

        // Fetch player history if needed for range
        const datasets = [];

        for (let i = 0; i < state.selectedPlayers.length; i++) {
            const player = state.selectedPlayers[i];
            let playerHistory = null;

            if (state.range !== 'season') {
                playerHistory = await getPlayerHistory(player.id);
            }

            // Calculate radar data
            const radarData = await calculateRadarData(
                player,
                state.allPlayers,
                state.range,
                state.currentGw,
                playerHistory
            );

            if (!radarData) {
                console.error(`Failed to calculate radar data for ${player.web_name}`);
                continue;
            }

            // Create dataset
            datasets.push({
                label: player.web_name,
                data: radarData.data,
                rawValues: radarData.rawValues,  // For custom tooltip
                backgroundColor: playerColors[i].bg,
                borderColor: playerColors[i].border,
                borderWidth: 2,
                pointBackgroundColor: playerColors[i].border,
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: playerColors[i].border
            });
        }

        // Use labels from first player (they'll be the same for same position)
        const labels = datasets[0] ? (await calculateRadarData(
            state.selectedPlayers[0],
            state.allPlayers,
            state.range,
            state.currentGw,
            state.range !== 'season' ? await getPlayerHistory(state.selectedPlayers[0].id) : null
        )).labels : [];

        // Prepare chart data
        const chartData = {
            labels,
            datasets
        };

        // Destroy existing chart
        if (state.chart) {
            state.chart.destroy();
        }

        // Create new radar chart
        const chartInstance = createChart(canvasId, createRadarChartConfig, chartData);

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
