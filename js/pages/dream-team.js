// Dream Team Page - Shows optimal XI from league

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

async function renderDreamTeamPage(state = {}) {
    const app = document.getElementById('app');
    const nav = document.getElementById('main-nav');

    // Extract leagueId from state (backwards compatible)
    const leagueId = state.leagueId || state || router.getLeagueId();

    if (!leagueId) {
        app.innerHTML = `
            <div class="card text-center">
                <h2>No League Selected</h2>
                <p>Please select a league from the home page.</p>
                <button class="btn-primary" onclick="router.navigate('/')">Go to Home</button>
            </div>
        `;
        return;
    }

    // Show navigation
    nav.style.display = 'block';

    // Show loading
    app.innerHTML = `
        <div class="text-center mt-2">
            <div class="spinner"></div>
            <p class="loading-text">Calculating dream team...</p>
        </div>
    `;

    try {
        // Fetch data
        const bootstrapData = await getBootstrapData();
        const lastCompletedGw = getLastCompletedGameweek(bootstrapData);

        if (!lastCompletedGw) {
            app.innerHTML = `
                <div class="card text-center">
                    <h2>No Completed Gameweeks</h2>
                    <p>Dream team will be available after the first gameweek is completed.</p>
                </div>
            `;
            return;
        }

        const leagueData = await getLeagueData(leagueId);
        if (!leagueData) {
            throw new Error('Could not fetch league data');
        }

        const completedGwData = await getLiveGameweekData(lastCompletedGw);
        const playerMap = createPlayerMap(bootstrapData);
        const teamMap = createTeamMap(bootstrapData);

        // Get all unique players from all managers' squads
        const allSquadPlayers = await getAllSquadPlayers(
            leagueData,
            lastCompletedGw,
            playerMap,
            completedGwData
        );

        // Find optimal dream team
        const { bestTeam, bestFormation, totalPoints } = findOptimalDreamteam(allSquadPlayers);

        if (!bestTeam) {
            app.innerHTML = `
                <div class="card text-center">
                    <h2>Could not create dream team</h2>
                    <p>Insufficient players in each position.</p>
                </div>
            `;
            return;
        }

        // Find Player of the Week
        const playerOfWeek = findPlayerOfTheWeek(bestTeam, allSquadPlayers);

        // Arrange team by position
        const positions = arrangeDreamTeamByPosition(bestTeam, allSquadPlayers);

        // Render the page
        renderDreamTeam(
            positions,
            playerOfWeek,
            bestFormation,
            totalPoints,
            lastCompletedGw,
            leagueData.league.name,
            teamMap,
            leagueId
        );

    } catch (error) {
        console.error('Error loading dream team:', error);
        app.innerHTML = `
            <div class="card text-center">
                <h2 class="text-error">Error Loading Dream Team</h2>
                <p>${error.message}</p>
                <button class="btn-primary" onclick="router.navigate('/')">Go to Home</button>
            </div>
        `;
    }
}

function renderDreamTeam(positions, playerOfWeek, formation, totalPoints, gameweek, leagueName, teamMap, leagueId) {
    const app = document.getElementById('app');

    app.innerHTML = `
        <div class="dream-team-container">
            <!-- League Navigation Buttons -->
            ${renderLeagueNavButtons('dream-team', leagueId)}

            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">${leagueName} - Dream Team GW ${gameweek}</h2>
                    <div class="text-right">
                        <p class="text-lg text-secondary m-0">
                            Formation: ${formation}
                        </p>
                        <p class="text-xl text-secondary m-0" style="font-weight: 700;">
                            Total: ${totalPoints} pts
                        </p>
                    </div>
                </div>

                ${playerOfWeek ? renderPlayerOfTheWeek(playerOfWeek, teamMap) : ''}

                <div class="pitch-container">
                    ${renderFormation(positions, teamMap)}
                </div>

                <div class="mt-2">
                    <h3 class="text-secondary mb-sm">Top Performers</h3>
                    <div class="grid-3">
                        ${renderTopPerformers(positions)}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderPlayerOfTheWeek(player, teamMap) {
    const team = teamMap[player.player_info.team];
    const teamName = team ? team.name : '';

    return `
        <div class="potw-badge">
            <div class="potw-title text-center">⭐ PLAYER OF THE WEEK ⭐</div>
            <div class="potw-content">
                <div class="potw-player-info">
                    <div class="potw-player-name">${player.fullName}</div>
                    <p class="text-quaternary text-md m-0">${teamName}</p>
                    <div class="potw-player-stats">
                        <div class="potw-stat">
                            <div class="potw-stat-value">${player.points}</div>
                            <div class="potw-stat-label">Points</div>
                        </div>
                        <div class="potw-stat">
                            <div class="potw-stat-value">${player.goals}</div>
                            <div class="potw-stat-label">Goals</div>
                        </div>
                        <div class="potw-stat">
                            <div class="potw-stat-value">${player.assists}</div>
                            <div class="potw-stat-label">Assists</div>
                        </div>
                        <div class="potw-stat">
                            <div class="potw-stat-value">${player.minutes}</div>
                            <div class="potw-stat-label">Minutes</div>
                        </div>
                        ${player.clean_sheets > 0 ? `
                            <div class="potw-stat">
                                <div class="potw-stat-value">${player.clean_sheets}</div>
                                <div class="potw-stat-label">Clean Sheets</div>
                            </div>
                        ` : ''}
                        ${player.bonus > 0 ? `
                            <div class="potw-stat">
                                <div class="potw-stat-value">${player.bonus}</div>
                                <div class="potw-stat-label">Bonus</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderFormation(positions, teamMap) {
    const { goalkeepers, defenders, midfielders, forwards } = positions;

    return `
        <div class="formation-row">
            ${forwards.map(p => renderDreamTeamPlayerCard(p, teamMap)).join('')}
        </div>
        <div class="formation-row">
            ${midfielders.map(p => renderDreamTeamPlayerCard(p, teamMap)).join('')}
        </div>
        <div class="formation-row">
            ${defenders.map(p => renderDreamTeamPlayerCard(p, teamMap)).join('')}
        </div>
        <div class="formation-row">
            ${goalkeepers.map(p => renderDreamTeamPlayerCard(p, teamMap)).join('')}
        </div>
    `;
}

function renderDreamTeamPlayerCard(player, teamMap) {
    const team = teamMap[player.team];
    const teamShortName = team ? team.short_name : '';

    return `
        <div class="dream-team-player-card">
            <div class="player-name">${player.name}</div>
            <div class="text-sm text-quaternary">${teamShortName}</div>
            <div class="player-points">${player.points} pts</div>
            <div class="player-stats">
                ${player.goals > 0 ? `G: ${player.goals}` : ''}
                ${player.assists > 0 ? ` A: ${player.assists}` : ''}
                ${player.clean_sheets > 0 ? ` CS: ${player.clean_sheets}` : ''}
            </div>
        </div>
    `;
}

function renderTopPerformers(positions) {
    const allPlayers = [
        ...positions.goalkeepers,
        ...positions.defenders,
        ...positions.midfielders,
        ...positions.forwards
    ];

    // Sort by points
    allPlayers.sort((a, b) => b.points - a.points);

    // Take top 3
    const top3 = allPlayers.slice(0, 3);

    return top3.map((player, index) => `
        <div class="stat-card" style="background: ${index === 0 ? 'linear-gradient(135deg, #ffd700, #ffed4e)' : 'var(--card-bg)'}">
            <div class="text-3xl mb-xs">
                ${index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
            </div>
            <div class="stat-value">${player.points}</div>
            <div class="stat-label">${player.name}</div>
            <div class="text-base-sm text-tertiary mt-xs">
                ${player.goals > 0 ? `${player.goals} Goals ` : ''}
                ${player.assists > 0 ? `${player.assists} Assists` : ''}
            </div>
        </div>
    `).join('');
}

// Register route
router.addRoute('/dream-team', renderDreamTeamPage);
