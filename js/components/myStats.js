// My Stats Component
// Shows manager stats with comparison bars vs overall FPL and selected league

/**
 * Initializes the My Stats component
 * @param {string} containerId - ID of the container element
 */
async function initializeMyStats(containerId) {
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
        leagueAverage: null
    };

    // Render UI
    myStats_renderUI(container, state);

    // If we have saved IDs, fetch data automatically
    if (savedManagerId) {
        await myStats_fetchData(state);
    }
}

/**
 * Renders the My Stats UI
 */
function myStats_renderUI(container, state) {
    const html = `
        <div class="my-stats-container">
            <div class="my-stats-header">
                <h3 class="chart-card-title">My Stats</h3>
            </div>

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

            <div id="my-stats-display" class="my-stats-display">
                ${state.managerData ? myStats_renderStats(state) : myStats_renderPlaceholder()}
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Attach event listeners
    myStats_attachEventListeners(state);
}

/**
 * Renders placeholder text when no data is loaded
 */
function myStats_renderPlaceholder() {
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

    return `
        <div class="my-stats-info">
            <div class="manager-name">${managerData.name}</div>
            <div class="points-summary">
                <div class="points-item">
                    <span class="points-label">Total Points</span>
                    <span class="points-value">${totalPoints}</span>
                </div>
                <div class="points-divider">|</div>
                <div class="points-item">
                    <span class="points-label">Last GW</span>
                    <span class="points-value">${lastGwPoints}</span>
                </div>
            </div>
        </div>

        <div class="comparison-bars">
            <div class="comparison-bar-container">
                <div class="comparison-label">Last GW vs Overall FPL</div>
                <div class="bar-track">
                    <div class="bar-fill ${overallComparison.color}" style="width: ${overallComparison.percentage}%"></div>
                    <div class="bar-average-marker"></div>
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
                        <div class="bar-average-marker"></div>
                    </div>
                    <div class="comparison-stats">
                        ${lastGwPoints} pts vs ${leagueAverage} avg (${leagueData.league.name})
                    </div>
                </div>
            ` : ''}
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
        }

    } catch (error) {
        console.error('Error fetching manager stats:', error);
        container.innerHTML = '<div class="my-stats-error">Failed to load stats. Please check your Manager ID.</div>';
    }
}
