// Home Page - League Selection or Live Table

let staticData = {};
let liveGameweekId = null;
let currentLeagueData = null;

// League navigation buttons helper
function renderLeagueNavButtons(currentPage, leagueId) {
    const buttons = [];

    if (currentPage !== 'table') {
        buttons.push(`<button class="btn-primary" onclick="router.navigate('/', {leagueId: '${leagueId}'})">League Table</button>`);
    }
    if (currentPage !== 'dream-team') {
        buttons.push(`<button class="btn-primary" onclick="router.navigate('/dream-team', {leagueId: '${leagueId}'})">Dream Team</button>`);
    }
    if (currentPage !== 'league-stats') {
        buttons.push(`<button class="btn-primary" onclick="router.navigate('/league-stats', {leagueId: '${leagueId}'})">League Stats</button>`);
    }
    if (currentPage !== 'comparison') {
        buttons.push(`<button class="btn-primary" onclick="router.navigate('/comparison', {leagueId: '${leagueId}'})">Manager Comparison</button>`);
    }

    return `<div class="flex gap-md mb-sm flex-wrap">${buttons.join('')}</div>`;
}

async function renderHomePage() {
    const app = document.getElementById('app');
    const nav = document.getElementById('main-nav');

    // Show navigation
    nav.style.display = 'block';

    // Check if we have a stored league ID
    const storedLeagueId = router.getLeagueId();

    if (storedLeagueId) {
        // Render live table
        await renderHomeWithLiveTable(storedLeagueId);
    } else {
        // Render entry boxes
        renderEntryBoxes();
    }
}

function renderEntryBoxes() {
    const app = document.getElementById('app');

    app.innerHTML = `
        <div class="home-container container-lg pt-lg">
            <div class="grid-2">
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">Enter League ID</h2>
                    </div>
                    <form id="league-form">
                        <div class="form-group mb-sm">
                            <input
                                type="number"
                                id="league-id-input"
                                class="form-input form-input-compact"
                                placeholder="e.g., 314"
                                required
                            />
                        </div>

                        <button type="submit" class="btn-primary block">
                            Load League
                        </button>
                    </form>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">Enter Manager ID</h2>
                    </div>
                    <form id="manager-form">
                        <div class="form-group mb-sm">
                            <input
                                type="number"
                                id="manager-id-input"
                                class="form-input form-input-compact"
                                placeholder="e.g., 123456"
                                required
                            />
                        </div>

                        <button type="submit" class="btn-primary block">
                            Load Manager Stats
                        </button>
                    </form>
                </div>
            </div>
        </div>
    `;

    // Handle league form submission
    const leagueForm = document.getElementById('league-form');
    leagueForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const leagueId = document.getElementById('league-id-input').value;

        if (leagueId) {
            // Store league ID and reload home page
            router.setLeagueId(leagueId);
            renderHomePage();
        }
    });

    // Handle manager form submission
    const managerForm = document.getElementById('manager-form');
    managerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const managerId = document.getElementById('manager-id-input').value;

        if (managerId) {
            // Store manager ID and navigate to My Stats
            localStorage.setItem('fpl_manager_id', managerId);
            router.navigate('/my-stats');
        }
    });
}

async function renderHomeWithLiveTable(leagueId) {
    const app = document.getElementById('app');

    // Show loading
    app.innerHTML = `
        <div class="text-center mt-2">
            <div class="spinner"></div>
            <p class="loading-text">Fetching live league data...</p>
        </div>
    `;

    try {
        // Fetch data
        staticData = await getBootstrapData();
        liveGameweekId = getCurrentGameweek(staticData);

        if (!liveGameweekId) {
            const nextEvent = staticData.events.find(event => event.is_next);
            if (nextEvent) {
                liveGameweekId = nextEvent.id;
            } else {
                app.innerHTML = `
                    <div class="card text-center">
                        <h2>No Active Gameweek</h2>
                        <p>No current or next gameweek found. Please check back later.</p>
                    </div>
                `;
                return;
            }
        }

        const leagueData = await getLeagueData(leagueId);
        if (!leagueData || !leagueData.standings || !leagueData.standings.results) {
            throw new Error('Could not fetch league data');
        }

        currentLeagueData = leagueData;

        const liveData = await getLiveGameweekData(liveGameweekId);
        if (!liveData) {
            throw new Error('Could not fetch live data');
        }

        // Calculate live standings
        const livePointsMap = {};
        liveData.elements.forEach(p => {
            livePointsMap[p.id] = p.stats;
        });

        const managersPromises = leagueData.standings.results.map(async (managerInfo) => {
            const teamId = managerInfo.entry;

            const picksData = await getManagerPicks(teamId, liveGameweekId);
            const historyData = await getManagerHistory(teamId);

            if (!picksData || !historyData) return null;

            const livePoints = calculateLivePoints(picksData, liveData, liveGameweekId, historyData);

            return {
                id: teamId,
                name: managerInfo.player_name,
                teamName: managerInfo.entry_name,
                livePoints: livePoints.liveGwPoints,
                totalPoints: livePoints.liveTotalPoints,
                playersPlayed: livePoints.playersPlayed,
                chip: getChipAbbreviation(livePoints.chip),
                originalRank: managerInfo.rank,
                picksData: picksData
            };
        });

        let managers = (await Promise.all(managersPromises)).filter(m => m !== null);
        managers.sort((a, b) => b.totalPoints - a.totalPoints);

        // Render the live table
        renderLiveTable(managers, leagueData.league.name, leagueId);

    } catch (error) {
        console.error('Error loading live table:', error);
        app.innerHTML = `
            <div class="card text-center">
                <h2 class="text-error">Error Loading League</h2>
                <p>${error.message}</p>
                <p>Please check the League ID and try again.</p>
                <button class="btn-primary" onclick="changeLeague()">Try Different League</button>
            </div>
        `;
    }
}

function renderLiveTable(managers, leagueName, leagueId) {
    const app = document.getElementById('app');

    const lastUpdated = new Date().toLocaleTimeString();

    app.innerHTML = `
        <div class="live-table-container">
            <!-- League Navigation Buttons -->
            ${renderLeagueNavButtons('table', leagueId)}

            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">GW ${liveGameweekId} Live Table</h2>
                    <div class="flex items-center gap-lg flex-wrap">
                        <p class="subtitle m-0">${leagueName}</p>
                        <button id="change-league-btn" class="btn-secondary-small">
                            Change League
                        </button>
                        <p class="subtitle text-base-sm m-0">
                            Last Updated: ${lastUpdated}
                        </p>
                        <button id="refresh-btn" class="btn-secondary">
                            Refresh Points
                        </button>
                    </div>
                </div>

                <div class="overflow-x-auto">
                    <table class="data-table ownership-table">
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Manager</th>
                                <th>Team</th>
                                <th>GW Points</th>
                                <th>Total Points</th>
                                <th>Players Played</th>
                            </tr>
                        </thead>
                        <tbody id="league-body">
                            ${managers.map((manager, index) => {
                                const liveRank = index + 1;
                                const chipHtml = manager.chip ? `<span class="chip-active">${manager.chip}</span>` : '';

                                return `
                                    <tr class="manager-row" data-manager-id="${manager.id}">
                                        <td>${liveRank}</td>
                                        <td>${manager.name}</td>
                                        <td>${manager.teamName}</td>
                                        <td>${manager.livePoints} ${chipHtml}</td>
                                        <td>${manager.totalPoints}</td>
                                        <td>${manager.playersPlayed} / 11</td>
                                    </tr>
                                    <tr class="details-row hidden" id="details-${manager.id}">
                                        <td colspan="6">
                                            <div class="details-content"></div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    // Add chip styling
    const style = document.createElement('style');
    style.textContent = `
        .chip-active {
            font-size: 0.8em;
            font-weight: bold;
            color: var(--secondary-color);
            margin-left: 5px;
            background-color: rgba(0, 255, 133, 0.1);
            padding: 2px 5px;
            border-radius: 4px;
        }
        .manager-row {
            cursor: pointer;
        }
        .details-content {
            background-color: #1f1f1f;
            padding: 20px;
            border-radius: 8px;
        }
        .details-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
        }
        .details-section h3 {
            color: var(--secondary-color);
            margin-top: 0;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 5px;
        }
        .player-list {
            list-style: none;
            padding: 0;
        }
        .player-list li {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            border-bottom: 1px solid #333;
        }
        .player-list li:last-child {
            border-bottom: none;
        }
        .player-name { font-weight: bold; }
        .captain-icon { color: yellow; }
        .vice-captain-icon { color: #ccc; }
    `;
    document.head.appendChild(style);

    // Add click handlers for manager rows
    const managerRows = document.querySelectorAll('.manager-row');
    managerRows.forEach(row => {
        row.addEventListener('click', () => {
            const managerId = row.getAttribute('data-manager-id');
            const manager = managers.find(m => m.id === parseInt(managerId));
            if (manager) {
                toggleDetailsRow(manager, row);
            }
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
            }
        });

        const chip = manager.picksData.active_chip ? manager.picksData.active_chip.replace(/_/g, ' ').toUpperCase() : 'None';
        const transfersCost = manager.picksData.entry_history.event_transfers_cost;

        const contentHtml = `
            <div class="details-grid">
                <div class="details-section">
                    <h3>Starting XI</h3>
                    <ul class="player-list">${startingXIHtml}</ul>
                </div>
                <div class="details-section">
                    <h3>Bench</h3>
                    <ul class="player-list">${benchHtml}</ul>
                </div>
                <div class="details-section">
                    <h3>Gameweek Info</h3>
                    <ul class="player-list">
                        <li><span>Points Hit:</span> <span>-${transfersCost}</span></li>
                        <li><span>Chip Played:</span> <span>${chip}</span></li>
                    </ul>
                </div>
            </div>
        `;

        detailsRow.querySelector('.details-content').innerHTML = contentHtml;

    } catch (error) {
        console.error('Error loading details:', error);
        detailsRow.querySelector('.details-content').innerHTML = '<p>Could not load details.</p>';
    }
}

// Global function to change league
window.changeLeague = function() {
    localStorage.removeItem('fpl_league_id');
    router.currentLeagueId = null;
    renderHomePage();
};

// Register home route
router.addRoute('/', renderHomePage);
