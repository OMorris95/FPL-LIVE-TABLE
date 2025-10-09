// Fixtures Page - Fixture Difficulty Rating (FDR) Matrix

async function renderFixturesPage(state = {}) {
    const app = document.getElementById('app');
    const nav = document.getElementById('main-nav');

    // Show navigation
    nav.style.display = 'block';

    // Show loading
    app.innerHTML = `
        <div class="text-center mt-2">
            <div class="spinner"></div>
            <p class="loading-text">Loading fixtures...</p>
        </div>
    `;

    try {
        // Fetch bootstrap data and fixtures
        const bootstrapData = await getBootstrapData();
        const fixturesData = await getFixturesData();

        if (!bootstrapData || !fixturesData) {
            throw new Error('Could not fetch fixtures data');
        }

        const currentGw = getCurrentGameweek(bootstrapData);
        if (!currentGw) {
            throw new Error('Could not determine current gameweek');
        }

        // Build FDR matrix
        renderFDRMatrix(bootstrapData, fixturesData, currentGw);

    } catch (error) {
        console.error('Error loading Fixtures:', error);
        app.innerHTML = `
            <div class="card text-center">
                <h2 class="text-error">Error Loading Fixtures</h2>
                <p>${error.message}</p>
                <button class="btn-primary" onclick="router.navigate('/')">
                    Go to Home
                </button>
            </div>
        `;
    }
}

function renderFDRMatrix(bootstrapData, fixturesData, currentGw) {
    const app = document.getElementById('app');

    // Get teams and sort by name
    const teams = [...bootstrapData.teams].sort((a, b) => a.name.localeCompare(b.name));

    // Calculate next 5 gameweeks to display
    const gameweeksToShow = 5;
    const startGw = currentGw;
    const endGw = Math.min(currentGw + gameweeksToShow - 1, 38);
    const gwRange = Array.from({ length: endGw - startGw + 1 }, (_, i) => startGw + i);

    // Build fixture lookup: teamId -> gameweek -> fixture info
    const teamFixtures = {};
    teams.forEach(team => {
        teamFixtures[team.id] = {};
    });

    fixturesData.forEach(fixture => {
        const gw = fixture.event;
        if (!gw || gw < startGw || gw > endGw) return;

        // Home team fixture
        const homeTeamId = fixture.team_h;
        if (teamFixtures[homeTeamId]) {
            teamFixtures[homeTeamId][gw] = {
                opponent: teams.find(t => t.id === fixture.team_a),
                difficulty: fixture.team_h_difficulty,
                isHome: true,
                finished: fixture.finished
            };
        }

        // Away team fixture
        const awayTeamId = fixture.team_a;
        if (teamFixtures[awayTeamId]) {
            teamFixtures[awayTeamId][gw] = {
                opponent: teams.find(t => t.id === fixture.team_h),
                difficulty: fixture.team_a_difficulty,
                isHome: false,
                finished: fixture.finished
            };
        }
    });

    // Generate table HTML
    app.innerHTML = `
        <div class="fixtures-container">
            <div class="card card-top">
                <div class="card-header">
                    <h2 class="card-title">Fixture Difficulty Rating (FDR)</h2>
                </div>

                <!-- FDR Legend -->
                <div class="fdr-legend">
                    <div class="fdr-legend-item">
                        <span class="fdr-badge fdr-easy">1-2</span>
                        <span class="fdr-legend-label">Easy</span>
                    </div>
                    <div class="fdr-legend-item">
                        <span class="fdr-badge fdr-medium">3</span>
                        <span class="fdr-legend-label">Medium</span>
                    </div>
                    <div class="fdr-legend-item">
                        <span class="fdr-badge fdr-hard">4</span>
                        <span class="fdr-legend-label">Hard</span>
                    </div>
                    <div class="fdr-legend-item">
                        <span class="fdr-badge fdr-very-hard">5</span>
                        <span class="fdr-legend-label">Very Hard</span>
                    </div>
                </div>

                <!-- FDR Matrix Table -->
                <div class="fdr-table-container">
                    <table class="fdr-matrix">
                        <thead>
                            <tr>
                                <th class="team-column">Team</th>
                                ${gwRange.map(gw => `<th>GW${gw}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${teams.map(team => {
                                return `
                                    <tr>
                                        <td class="team-name">
                                            <strong>${team.name}</strong>
                                        </td>
                                        ${gwRange.map(gw => {
                                            const fixture = teamFixtures[team.id][gw];
                                            if (!fixture) {
                                                return `<td class="fdr-blank">-</td>`;
                                            }

                                            const difficultyClass = getFDRClass(fixture.difficulty);
                                            const homeAwayBadge = fixture.isHome ? 'H' : 'A';
                                            const opponentName = fixture.opponent ? fixture.opponent.name : '???';

                                            return `
                                                <td class="fdr-cell ${difficultyClass}">
                                                    <div class="fdr-content">
                                                        <span class="fdr-opponent">${opponentName}</span>
                                                        <span class="fdr-location ${fixture.isHome ? 'home' : 'away'}">${homeAwayBadge}</span>
                                                    </div>
                                                </td>
                                            `;
                                        }).join('')}
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

// Helper function to get FDR CSS class based on difficulty
function getFDRClass(difficulty) {
    if (difficulty <= 2) return 'fdr-easy';
    if (difficulty === 3) return 'fdr-medium';
    if (difficulty === 4) return 'fdr-hard';
    return 'fdr-very-hard'; // 5+
}

// Register route
router.addRoute('/fixtures', renderFixturesPage);
