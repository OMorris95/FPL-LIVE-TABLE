// Home Page - General FPL Statistics (No Login Required)
// Modern redesigned homepage with placeholder charts

async function renderHomePage(state = {}) {
    const app = document.getElementById('app');
    const nav = document.getElementById('main-nav');

    // Show navigation
    nav.style.display = 'block';

    // Show loading briefly
    app.innerHTML = `
        <div class="text-center mt-2">
            <div class="spinner"></div>
            <p class="loading-text">Loading FPL Stats...</p>
        </div>
    `;

    try {
        // Fetch bootstrap data for current gameweek info
        const bootstrapData = await getBootstrapData();
        const currentGw = getCurrentGameweek(bootstrapData);
        const currentEvent = bootstrapData.events.find(e => e.id === currentGw);

        // Render the modern homepage
        renderModernHomepage(currentGw, currentEvent);

    } catch (error) {
        console.error('Error loading homepage:', error);
        app.innerHTML = `
            <div class="card text-center">
                <h2 class="text-error">Error Loading Data</h2>
                <p>${error.message}</p>
                <button class="btn-primary" onclick="renderHomePage()">
                    Try Again
                </button>
            </div>
        `;
    }
}

function renderModernHomepage(currentGw, currentEvent) {
    const app = document.getElementById('app');

    app.innerHTML = `
        <div class="home-modern-container">
            <!-- Main Grid - 2 Columns (My Stats + League Table) -->
            <div class="chart-grid chart-grid-2col">
                <!-- My Stats Component (left column) -->
                <div class="chart-card my-stats-card" id="my-stats-card">
                </div>

                <!-- League Table (right column) -->
                <div class="chart-card league-table-card" id="league-table-card">
                    <div class="chart-card-header">
                        <h3 class="chart-card-title">Live League Table</h3>
                    </div>
                    <div id="league-table-container">
                        <p class="loading-text">Select a league in My Stats to view the table</p>
                    </div>
                </div>

                <!-- CHARTS TEMPORARILY HIDDEN - Code kept for future move to separate page -->
                <!--
                <div class="chart-card square" id="player-radar-card">
                    <div class="chart-card-header">
                        <h3 class="chart-card-title">Player Stats Radar</h3>
                    </div>
                    <div class="chart-container radar">
                        <canvas id="player-radar-chart"></canvas>
                    </div>
                </div>

                <div class="chart-card" id="player-comparison-card">
                    <div class="chart-card-header">
                        <h3 class="chart-card-title">Player Performance Comparison</h3>
                    </div>
                    <div class="chart-container line">
                        <canvas id="player-comparison-chart"></canvas>
                    </div>
                </div>

                <div class="chart-card" id="expected-points-card">
                    <div class="chart-card-header">
                        <h3 class="chart-card-title">Actual vs Expected Points</h3>
                    </div>
                    <div class="chart-container line">
                        <canvas id="expected-points-chart"></canvas>
                    </div>
                </div>
                -->
            </div>
        </div>
    `;

    // Initialize all charts
    initializeHomepageCharts();

    // Initialize expand buttons for full-screen view
    initializeChartExpanders();
}

// Initialize all homepage components
function initializeHomepageCharts() {
    // My Stats Component
    initializeMyStats('my-stats-card', onLeagueChange);

    // Initialize empty league table
    initializeLeagueTable();

    // CHART INITIALIZATIONS COMMENTED OUT - Will be moved to separate page
    /*
    // Chart 3 - Player Radar Chart (real FPL data)
    initializePlayerRadarChart('player-radar-card', 'player-radar-chart');

    // Chart 1 - Player Comparison Chart (real FPL data)
    initializePlayerComparisonChart('player-comparison-card', 'player-comparison-chart');

    // Chart 2 - Expected Points Chart (real FPL data)
    initializeExpectedPointsChart('expected-points-card', 'expected-points-chart');
    */
}

// Callback when league changes in My Stats
function onLeagueChange(leagueId) {
    if (leagueId) {
        loadLeagueTable(leagueId);
    }
}

// Initialize league table component
function initializeLeagueTable() {
    const container = document.getElementById('league-table-container');
    container.innerHTML = '<p class="loading-text">Enter a League ID in My Stats to view the table</p>';
}

// Load and render league table data
async function loadLeagueTable(leagueId) {
    const container = document.getElementById('league-table-container');

    try {
        container.innerHTML = '<div class="spinner"></div><p class="loading-text">Loading league table...</p>';

        // Fetch league standings
        const leagueData = await getLeagueData(leagueId);
        const bootstrapData = await getBootstrapData();
        const currentGw = getCurrentGameweek(bootstrapData);

        // Render league table
        renderLeagueTable(leagueData, currentGw, container);

    } catch (error) {
        console.error('Error loading league table:', error);
        container.innerHTML = `
            <div class="error-message">
                <p>Failed to load league table</p>
                <p class="error-detail">${error.message}</p>
            </div>
        `;
    }
}

// Render league table HTML
function renderLeagueTable(leagueData, currentGw, container) {
    const standings = leagueData.standings.results;

    let html = `
        <div class="league-table-wrapper">
            <table class="league-table">
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Manager</th>
                        <th>Team</th>
                        <th>Total</th>
                        <th>GW${currentGw}</th>
                    </tr>
                </thead>
                <tbody>
    `;

    standings.forEach(entry => {
        html += `
            <tr>
                <td class="rank-cell">${entry.rank}</td>
                <td class="manager-cell">${entry.player_name}</td>
                <td class="team-cell">${entry.entry_name}</td>
                <td class="total-cell">${entry.total}</td>
                <td class="gw-cell">${entry.event_total || '-'}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = html;
}

// Register the home route with the router
router.addRoute('/', renderHomePage);
