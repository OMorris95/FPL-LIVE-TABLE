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
                <!-- Chart 1 - Line Chart -->
                <div class="chart-card">
                    <div class="chart-card-header">
                        <h3 class="chart-card-title">Chart.js Line Chart</h3>
                    </div>
                    <div class="chart-container line">
                        <canvas id="chart-1"></canvas>
                    </div>
                </div>

                <!-- Chart 2 - Line Chart -->
                <div class="chart-card">
                    <div class="chart-card-header">
                        <h3 class="chart-card-title">Chart.js Line Chart</h3>
                    </div>
                    <div class="chart-container line">
                        <canvas id="chart-2"></canvas>
                    </div>
                </div>

                <!-- Chart 3 - Radar Chart -->
                <div class="chart-card square">
                    <div class="chart-card-header">
                        <h3 class="chart-card-title">Chart.js Radar Chart</h3>
                    </div>
                    <div class="chart-container radar">
                        <canvas id="chart-3"></canvas>
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
}

// Initialize all homepage charts with placeholder data
function initializeHomepageCharts() {
    // Chart 1 - Line Chart
    const lineData1 = {
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
    createChart('chart-1', createLineChartConfig, lineData1);

<<<<<<< HEAD
    // Chart 2 - Line Chart
    const lineData2 = {
        labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November'],
        datasets: [
            {
                label: 'Dataset 1',
                data: generateSampleData(11, -80, 80),
            },
            {
                label: 'Dataset 2',
                data: generateSampleData(11, -80, 80),
=======
    // Add click handlers for stats rows (captain and ownership)
    const statsRows = document.querySelectorAll('.clickable-stats-row');
    statsRows.forEach(row => {
        row.addEventListener('click', () => {
            const playerId = row.getAttribute('data-player-id');
            const playerType = row.getAttribute('data-player-type');
            toggleStatsDetailsRow(playerId, playerType, captainStats, ownershipStats);
        });
    });

    // Add refresh button handler
    document.getElementById('refresh-btn').addEventListener('click', () => {
        renderHomePage();
    });

    // Add change league button handler
    document.getElementById('change-league-btn').addEventListener('click', () => {
        changeLeague();
    });

    // Add comparison button handler
    const comparisonBtn = document.getElementById('comparison-btn');
    if (comparisonBtn) {
        comparisonBtn.addEventListener('click', () => {
            const leagueId = comparisonBtn.dataset.leagueId;
            router.navigate('/comparison', { leagueId });
        });
    }

    // Initialize modern charts
    initializeModernCharts();

    // Add timeframe toggle handlers
    const timeframeButtons = document.querySelectorAll('.timeframe-btn');
    timeframeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            timeframeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update appState
            const timeframe = btn.dataset.timeframe;
            appState.update({ timeframe });

            // Charts will auto-update via state subscription
            console.log('Timeframe changed to:', timeframe);
        });
    });
}

// Initialize modern placeholder charts
function initializeModernCharts() {
    // Manager Points Progression Chart
    const managerProgressionData = {
        labels: generateGameweekLabels(10),
        datasets: [
            {
                label: 'Manager 1',
                data: generateSampleData(10, 400, 650),
            },
            {
                label: 'Manager 2',
                data: generateSampleData(10, 380, 630),
            },
            {
                label: 'Manager 3',
                data: generateSampleData(10, 370, 610),
            }
        ]
    };
    createSampleLineChart('manager-progression-chart', 'Manager Points Progression');

    // Captain Performance Chart (Bar chart)
    const captainPerformanceData = {
        labels: ['Haaland', 'Salah', 'Palmer', 'Saka', 'Son'],
        datasets: [
            {
                label: 'Avg Points',
                data: [12.5, 10.2, 9.8, 8.5, 7.9],
            }
        ]
    };
    const captainChart = createChart(
        'captain-performance-chart',
        createBarChartConfig,
        captainPerformanceData,
        {
            plugins: {
                title: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    );

    // Position Performance Chart (Radar)
    const positionPerformanceData = {
        labels: ['Goals', 'Assists', 'Clean Sheets', 'Bonus', 'Saves', 'xG'],
        datasets: [
            {
                label: 'DEF',
                data: [45, 52, 85, 70, 20, 38],
            },
            {
                label: 'MID',
                data: [78, 88, 35, 82, 10, 75],
            },
            {
                label: 'FWD',
                data: [92, 68, 15, 75, 5, 88],
            }
        ]
    };
    createChart(
        'position-performance-chart',
        createRadarChartConfig,
        positionPerformanceData
    );

    // Team Value Distribution Chart (Line)
    const teamValueData = {
        labels: generateGameweekLabels(10),
        datasets: [
            {
                label: 'Avg Team Value',
                data: [100.0, 100.3, 100.8, 101.2, 101.5, 101.9, 102.3, 102.6, 103.0, 103.4],
                borderColor: getThemeColors().primary,
                backgroundColor: getThemeColors().primary + '20',
            }
        ]
    };
    createChart(
        'team-value-chart',
        createLineChartConfig,
        teamValueData,
        {
            scales: {
                y: {
                    min: 99,
                    max: 104
                }
            }
        }
    );
}

async function toggleDetailsRow(manager, row) {
    const detailsRow = document.getElementById(`details-${manager.id}`);
    const allDetailsRows = document.querySelectorAll('.details-row');

    // If clicking the same row, close it
    if (!detailsRow.classList.contains('hidden')) {
        detailsRow.classList.add('hidden');
        return;
    }

    // Close all other detail rows
    allDetailsRows.forEach(r => r.classList.add('hidden'));

    // Show loading
    detailsRow.classList.remove('hidden');
    detailsRow.querySelector('.details-content').innerHTML = '<p>Loading details...</p>';

    try {
        const liveData = await getLiveGameweekData(liveGameweekId);
        const playerMap = createPlayerMap(staticData);

        const livePointsMap = {};
        liveData.elements.forEach(p => {
            livePointsMap[p.id] = p.stats;
        });

        let startingXIHtml = '';
        let benchHtml = '';

        manager.picksData.picks.forEach(pick => {
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
>>>>>>> 17ec8b456af64aac843fde14ccafe785066fc0e4
            }
        ]
    };
    createChart('chart-2', createLineChartConfig, lineData2);

    // Chart 3 - Radar Chart
    const radarData1 = {
        labels: ['Pace', 'Shooting', 'Passing', 'Dribbling', 'Defence', 'Physical'],
        datasets: [
            {
                label: 'Dataset 1',
                data: [65, 59, 90, 81, 56, 55],
            }
        ]
    };
    createChart('chart-3', createRadarChartConfig, radarData1);

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
