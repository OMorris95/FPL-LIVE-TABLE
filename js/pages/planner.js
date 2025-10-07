// Transfer Planner - Multi-week transfer planning tool

let plannerState = {
    managerId: null,
    currentSquad: [],
    transfers: [], // Array of {week: number, playerOut: id, playerIn: id}
    freeTransfers: 1,
    wildcardActive: false,
    budget: 0
};

async function renderPlannerPage(state = {}) {
    const app = document.getElementById('app');
    const nav = document.getElementById('main-nav');

    nav.style.display = 'block';

    // Check if manager ID exists
    const storedManagerId = localStorage.getItem('fpl_manager_id');

    if (!storedManagerId) {
        app.innerHTML = `
            <div class="card text-center container-sm mt-lg">
                <div class="card-header">
                    <h2 class="card-title">Transfer Planner</h2>
                </div>
                <p class="subtitle mb-md">
                    Import your squad from My Stats to start planning transfers.
                </p>
                <button class="btn-primary" onclick="router.navigate('/my-stats')">
                    Go to My Stats
                </button>
            </div>
        `;
        return;
    }

    app.innerHTML = `
        <div class="text-center mt-2">
            <div class="spinner"></div>
            <p class="loading-text">Loading your squad...</p>
        </div>
    `;

    try {
        const bootstrapData = await getBootstrapData();
        const currentGw = getCurrentGameweek(bootstrapData);
        const managerId = parseInt(storedManagerId);

        const [managerData, currentPicks] = await Promise.all([
            getManagerData(managerId),
            getManagerPicks(managerId, currentGw)
        ]);

        if (!managerData || !currentPicks) {
            throw new Error('Could not fetch manager data');
        }

        // Initialize planner state
        plannerState.managerId = managerId;
        plannerState.budget = managerData.last_deadline_bank / 10; // Convert to millions
        plannerState.currentSquad = currentPicks.picks.map(pick => pick.element);
        plannerState.freeTransfers = managerData.last_deadline_total_transfers || 1;

        const playerMap = createPlayerMap(bootstrapData);
        const teamMap = createTeamMap(bootstrapData);

        renderPlannerTool(playerMap, teamMap, currentGw, managerData);

    } catch (error) {
        console.error('Error loading transfer planner:', error);
        app.innerHTML = `
            <div class="card text-center">
                <h2 class="text-error">Error Loading Planner</h2>
                <p>${error.message}</p>
                <button class="btn-primary" onclick="router.navigate('/my-stats');">Go to My Stats</button>
            </div>
        `;
    }
}

function renderPlannerTool(playerMap, teamMap, currentGw, managerData) {
    const app = document.getElementById('app');

    // Calculate current squad value
    let squadValue = 0;
    plannerState.currentSquad.forEach(playerId => {
        const player = playerMap[playerId];
        if (player) {
            squadValue += player.now_cost;
        }
    });
    squadValue = squadValue / 10; // Convert to millions

    const totalValue = squadValue + plannerState.budget;

    // Group squad by position
    const squadByPosition = {
        1: [], // GK
        2: [], // DEF
        3: [], // MID
        4: []  // FWD
    };

    plannerState.currentSquad.forEach(playerId => {
        const player = playerMap[playerId];
        if (player) {
            squadByPosition[player.element_type].push(player);
        }
    });

    app.innerHTML = `
        <div class="planner-container">
            <div class="card">
                <div class="card-header">
                    <div>
                        <h2 class="card-title">Transfer Planner</h2>
                        <p class="subtitle m-0">${managerData.player_first_name} ${managerData.player_last_name}</p>
                    </div>
                </div>

                <!-- Budget Info -->
                <div class="grid-4 mb-1">
                    <div class="stat-card">
                        <div class="stat-value">£${totalValue.toFixed(1)}m</div>
                        <div class="stat-label">Total Value</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">£${plannerState.budget.toFixed(1)}m</div>
                        <div class="stat-label">In Bank</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${plannerState.freeTransfers}</div>
                        <div class="stat-label">Free Transfers</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${plannerState.transfers.length}</div>
                        <div class="stat-label">Planned Transfers</div>
                    </div>
                </div>

                <!-- Current Squad -->
                <h3 class="section-header">Current Squad</h3>
                ${renderSquadByPosition(squadByPosition, teamMap)}

                <!-- Planned Transfers -->
                ${plannerState.transfers.length > 0 ? `
                    <div class="mt-2">
                        <h3 class="section-header">Planned Transfers</h3>
                        ${renderPlannedTransfers(playerMap, teamMap)}
                    </div>
                ` : ''}

                <!-- Actions -->
                <div class="mt-2 flex gap-md flex-wrap">
                    <button id="plan-transfer-btn" class="btn-primary">
                        Plan Transfer
                    </button>
                    ${plannerState.transfers.length > 0 ? `
                        <button id="clear-transfers-btn" class="btn-secondary">
                            Clear All Transfers
                        </button>
                    ` : ''}
                    <button class="btn-secondary" onclick="router.navigate('/my-stats');">
                        Back to My Stats
                    </button>
                </div>
            </div>
        </div>
    `;

    // Add event listeners
    const planTransferBtn = document.getElementById('plan-transfer-btn');
    if (planTransferBtn) {
        planTransferBtn.addEventListener('click', () => {
            showTransferModal(playerMap, teamMap, currentGw);
        });
    }

    const clearTransfersBtn = document.getElementById('clear-transfers-btn');
    if (clearTransfersBtn) {
        clearTransfersBtn.addEventListener('click', () => {
            plannerState.transfers = [];
            renderPlannerTool(playerMap, teamMap, currentGw, managerData);
        });
    }
}

function renderSquadByPosition(squadByPosition, teamMap) {
    const positionLabels = {
        1: 'Goalkeepers',
        2: 'Defenders',
        3: 'Midfielders',
        4: 'Forwards'
    };

    return Object.entries(squadByPosition).map(([position, players]) => `
        <div class="position-group mb-1">
            <h4 class="text-gold text-base-sm mb-xs">
                ${positionLabels[position]} (${players.length})
            </h4>
            <div class="squad-grid">
                ${players.map(player => renderSquadPlayerCard(player, teamMap)).join('')}
            </div>
        </div>
    `).join('');
}

function renderSquadPlayerCard(player, teamMap) {
    const team = teamMap[player.team];

    return `
        <div class="squad-player-card">
            <div class="flex justify-between items-start">
                <div style="flex: 1;">
                    <div class="player-name">${player.first_name.charAt(0)}. ${player.second_name}</div>
                    <div class="text-xs text-tertiary">${team.short_name}</div>
                </div>
                <div class="text-right">
                    <div class="section-header" style="font-weight: 700;">£${(player.now_cost / 10).toFixed(1)}m</div>
                    <div class="text-xs text-tertiary">${player.total_points} pts</div>
                </div>
            </div>
        </div>
    `;
}

function renderPlannedTransfers(playerMap, teamMap) {
    return `
        <div class="transfers-list">
            ${plannerState.transfers.map((transfer, index) => {
                const playerOut = playerMap[transfer.playerOut];
                const playerIn = playerMap[transfer.playerIn];
                const teamOut = teamMap[playerOut.team];
                const teamIn = teamMap[playerIn.team];

                return `
                    <div class="transfer-item">
                        <div class="transfer-week">GW${transfer.week}</div>
                        <div class="transfer-details">
                            <div class="transfer-player transfer-out">
                                <span class="text-error">OUT:</span>
                                <strong>${playerOut.first_name.charAt(0)}. ${playerOut.second_name}</strong>
                                <span class="text-sm text-tertiary">${teamOut.short_name}</span>
                                <span style="font-weight: 600;">£${(playerOut.now_cost / 10).toFixed(1)}m</span>
                            </div>
                            <div class="transfer-player transfer-in">
                                <span class="text-success">IN:</span>
                                <strong>${playerIn.first_name.charAt(0)}. ${playerIn.second_name}</strong>
                                <span class="text-sm text-tertiary">${teamIn.short_name}</span>
                                <span style="font-weight: 600;">£${(playerIn.now_cost / 10).toFixed(1)}m</span>
                            </div>
                        </div>
                        <button class="remove-transfer-btn" onclick="removeTransfer(${index})">×</button>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

async function showTransferModal(playerMap, teamMap, currentGw) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content container-md">
            <div class="modal-header">
                <h3>Plan a Transfer</h3>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="mb-1">
                    <label class="form-label">Gameweek</label>
                    <input type="number" id="transfer-gw" class="form-input" value="${currentGw + 1}" min="${currentGw + 1}" />
                </div>

                <div class="mb-1">
                    <label class="form-label">Player Out</label>
                    <select id="player-out-select" class="form-select">
                        <option value="">Select player to transfer out...</option>
                        ${plannerState.currentSquad.map(playerId => {
                            const player = playerMap[playerId];
                            const team = teamMap[player.team];
                            return `
                                <option value="${player.id}">
                                    ${player.first_name.charAt(0)}. ${player.second_name} (${team.short_name}) - £${(player.now_cost / 10).toFixed(1)}m
                                </option>
                            `;
                        }).join('')}
                    </select>
                </div>

                <div class="mb-1">
                    <label class="form-label">Player In</label>
                    <input type="text" id="player-in-search" class="form-input" placeholder="Search for player..." />
                    <div id="player-in-results" class="search-results-dropdown"></div>
                </div>

                <div id="selected-player-in" class="mt-sm"></div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                <button id="confirm-transfer-btn" class="btn-primary" disabled>Add Transfer</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Setup modal event listeners
    let selectedPlayerIn = null;
    const playerInSearch = document.getElementById('player-in-search');
    const playerInResults = document.getElementById('player-in-results');
    const selectedPlayerInDiv = document.getElementById('selected-player-in');
    const confirmBtn = document.getElementById('confirm-transfer-btn');
    const playerOutSelect = document.getElementById('player-out-select');

    // Player search
    let searchTimeout;
    playerInSearch.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const query = e.target.value.toLowerCase().trim();

            if (query.length < 2) {
                playerInResults.innerHTML = '';
                playerInResults.style.display = 'none';
                return;
            }

            const allPlayers = Object.values(playerMap);
            const matches = allPlayers
                .filter(p =>
                    (p.web_name.toLowerCase().includes(query) ||
                    p.first_name.toLowerCase().includes(query) ||
                    p.second_name.toLowerCase().includes(query)) &&
                    !plannerState.currentSquad.includes(p.id)
                )
                .slice(0, 10);

            if (matches.length === 0) {
                playerInResults.innerHTML = '<div class="search-result-item">No players found</div>';
                playerInResults.style.display = 'block';
                return;
            }

            playerInResults.innerHTML = matches.map(player => {
                const team = teamMap[player.team];
                return `
                    <div class="search-result-item" data-player-id="${player.id}">
                        <div>
                            <div style="font-weight: 600;">${player.first_name.charAt(0)}. ${player.second_name}</div>
                            <div class="text-sm text-tertiary">${team.short_name} - ${getPositionLabel(player.element_type)}</div>
                        </div>
                        <div class="text-right">
                            <div style="font-weight: 600;">£${(player.now_cost / 10).toFixed(1)}m</div>
                            <div class="text-sm text-tertiary">${player.total_points} pts</div>
                        </div>
                    </div>
                `;
            }).join('');

            playerInResults.style.display = 'block';

            playerInResults.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', () => {
                    const playerId = parseInt(item.dataset.playerId);
                    selectedPlayerIn = playerMap[playerId];

                    const team = teamMap[selectedPlayerIn.team];
                    selectedPlayerInDiv.innerHTML = `
                        <div class="selected-player-badge">
                            <strong>${selectedPlayerIn.first_name.charAt(0)}. ${selectedPlayerIn.second_name}</strong>
                            <span>${team.short_name}</span>
                            <span>£${(selectedPlayerIn.now_cost / 10).toFixed(1)}m</span>
                        </div>
                    `;

                    playerInSearch.value = '';
                    playerInResults.innerHTML = '';
                    playerInResults.style.display = 'none';

                    updateConfirmButton();
                });
            });
        }, 300);
    });

    // Update confirm button state
    function updateConfirmButton() {
        const playerOut = playerOutSelect.value;
        confirmBtn.disabled = !(playerOut && selectedPlayerIn);
    }

    playerOutSelect.addEventListener('change', updateConfirmButton);

    // Confirm transfer
    confirmBtn.addEventListener('click', () => {
        const week = parseInt(document.getElementById('transfer-gw').value);
        const playerOut = parseInt(playerOutSelect.value);

        plannerState.transfers.push({
            week: week,
            playerOut: playerOut,
            playerIn: selectedPlayerIn.id
        });

        // Update squad
        const outIndex = plannerState.currentSquad.indexOf(playerOut);
        if (outIndex > -1) {
            plannerState.currentSquad[outIndex] = selectedPlayerIn.id;
        }

        modal.remove();

        // Re-render
        (async () => {
            const bootstrapData = await getBootstrapData();
            const currentGw = getCurrentGameweek(bootstrapData);
            const managerId = plannerState.managerId;
            const managerData = await getManagerData(managerId);
            const playerMap = createPlayerMap(bootstrapData);
            const teamMap = createTeamMap(bootstrapData);

            renderPlannerTool(playerMap, teamMap, currentGw, managerData);
        })();
    });
}

window.removeTransfer = function(index) {
    plannerState.transfers.splice(index, 1);

    // Re-render
    (async () => {
        const bootstrapData = await getBootstrapData();
        const currentGw = getCurrentGameweek(bootstrapData);
        const managerId = plannerState.managerId;
        const managerData = await getManagerData(managerId);
        const playerMap = createPlayerMap(bootstrapData);
        const teamMap = createTeamMap(bootstrapData);

        renderPlannerTool(playerMap, teamMap, currentGw, managerData);
    })();
};

async function getManagerData(managerId) {
    return await fetchData(`${API_BASE_URL}entry/${managerId}/`);
}

async function getManagerPicks(managerId, gameweek) {
    return await fetchData(`${API_BASE_URL}entry/${managerId}/event/${gameweek}/picks/`);
}

// Register route
router.addRoute('/planner', renderPlannerPage);
