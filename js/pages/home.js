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
            <!-- Main Chart Grid - 3 Columns -->
            <div class="chart-grid chart-grid-3col">
                <!-- Chart 1 - Player Comparison Chart -->
                <div class="chart-card" id="player-comparison-card">
                    <div class="chart-card-header">
                        <h3 class="chart-card-title">Player Performance Comparison</h3>
                    </div>
                    <div class="chart-container line">
                        <canvas id="player-comparison-chart"></canvas>
                    </div>
                </div>

                <!-- Chart 2 - Expected Points Chart -->
                <div class="chart-card" id="expected-points-card">
                    <div class="chart-card-header">
                        <h3 class="chart-card-title">Actual vs Expected Points</h3>
                    </div>
                    <div class="chart-container line">
                        <canvas id="expected-points-chart"></canvas>
                    </div>
                </div>

                <!-- Chart 3 - Player Radar Chart -->
                <div class="chart-card square" id="player-radar-card">
                    <div class="chart-card-header">
                        <h3 class="chart-card-title">Player Stats Radar</h3>
                    </div>
                    <div class="chart-container radar">
                        <canvas id="player-radar-chart"></canvas>
                    </div>
                </div>

                <!-- Chart 4 - Line Chart -->
                <div class="chart-card">
                    <div class="chart-card-header">
                        <h3 class="chart-card-title">Chart.js Line Chart</h3>
                    </div>
                    <div class="chart-container line">
                        <canvas id="chart-4"></canvas>
                    </div>
                </div>

                <!-- Chart 5 - Line Chart -->
                <div class="chart-card">
                    <div class="chart-card-header">
                        <h3 class="chart-card-title">Chart.js Line Chart</h3>
                    </div>
                    <div class="chart-container line">
                        <canvas id="chart-5"></canvas>
                    </div>
                </div>

                <!-- Chart 6 - Radar Chart -->
                <div class="chart-card square">
                    <div class="chart-card-header">
                        <h3 class="chart-card-title">Chart.js Radar Chart</h3>
                    </div>
                    <div class="chart-container radar">
                        <canvas id="chart-6"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Initialize all charts
    initializeHomepageCharts();

    // Initialize expand buttons for full-screen view
    initializeChartExpanders();
}

// Initialize all homepage charts with placeholder data
function initializeHomepageCharts() {
    // Chart 1 - Player Comparison Chart (real FPL data)
    initializePlayerComparisonChart('player-comparison-card', 'player-comparison-chart');

    // Chart 2 - Expected Points Chart (real FPL data)
    initializeExpectedPointsChart('expected-points-card', 'expected-points-chart');

    // Chart 3 - Player Radar Chart (real FPL data)
    initializePlayerRadarChart('player-radar-card', 'player-radar-chart');

    // Chart 4 - Line Chart
    const lineData3 = {
        labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November'],
        datasets: [
            {
                label: 'Dataset 1',
                data: generateSampleData(11, -80, 80),
            },
            {
                label: 'Dataset 2',
                data: generateSampleData(11, -80, 80),
            }
        ]
    };
    createChart('chart-4', createLineChartConfig, lineData3);

    // Chart 5 - Line Chart
    const lineData4 = {
        labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November'],
        datasets: [
            {
                label: 'Dataset 1',
                data: generateSampleData(11, -80, 80),
            },
            {
                label: 'Dataset 2',
                data: generateSampleData(11, -80, 80),
            }
        ]
    };
    createChart('chart-5', createLineChartConfig, lineData4);

    // Chart 6 - Radar Chart
    const radarData2 = {
        labels: ['Pace', 'Shooting', 'Passing', 'Dribbling', 'Defence', 'Physical'],
        datasets: [
            {
                label: 'Dataset 1',
                data: [28, 48, 40, 19, 96, 27],
            }
        ]
    };
    createChart('chart-6', createRadarChartConfig, radarData2);
}

// Register the home route with the router
router.addRoute('/', renderHomePage);
