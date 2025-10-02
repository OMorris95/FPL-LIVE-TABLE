// Players Page - Player Stats Hub

let allPlayers = [];
let filteredPlayers = [];
let bootstrapDataCache = null;
let teamMapCache = null;
let displayLimit = 50; // Number of players to display at once

// Selection state for comparison
let selectedPlayers = [];
const MAX_SELECTED = 4;

// Filter state
let filters = {
    search: '',
    position: 'all',
    team: 'all',
    priceMin: 0,
    priceMax: 150,
    sortBy: 'total_points'
};

async function renderPlayersPage() {
    const app = document.getElementById('app');
    const nav = document.getElementById('main-nav');

    // Show navigation
    nav.style.display = 'block';

    // Show loading
    app.innerHTML = `
        <div class="text-center mt-2">
            <div class="spinner"></div>
            <p class="loading-text">Loading players...</p>
        </div>
    `;

    try {
        // Fetch bootstrap data
        bootstrapDataCache = await getBootstrapData();

        if (!bootstrapDataCache) {
            throw new Error('Could not fetch player data');
        }

        teamMapCache = createTeamMap(bootstrapDataCache);
        allPlayers = bootstrapDataCache.elements;
        filteredPlayers = [...allPlayers];

        // Render the player search interface
        renderPlayerSearchHub();

    } catch (error) {
        console.error('Error loading Players:', error);
        app.innerHTML = `
            <div class="card text-center">
                <h2 class="text-error">Error Loading Players</h2>
                <p>${error.message}</p>
                <button class="btn-primary" onclick="router.navigate('/')">
                    Go to Home
                </button>
            </div>
        `;
    }
}

function renderPlayerSearchHub() {
    const app = document.getElementById('app');

    // Apply filters and sorting
    applyFiltersAndSort();

    // Get position types for filter
    const positions = [
        { id: 'all', name: 'All Positions' },
        { id: '1', name: 'Goalkeepers' },
        { id: '2', name: 'Defenders' },
        { id: '3', name: 'Midfielders' },
        { id: '4', name: 'Forwards' }
    ];

    // Get teams for filter (sorted by name)
    const teams = [
        { id: 'all', name: 'All Teams' },
        ...Object.values(teamMapCache).sort((a, b) => a.name.localeCompare(b.name))
    ];

    app.innerHTML = `
        <div class="players-container">
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Player Stats Hub</h2>
                </div>

                <!-- Filters Section -->
                <div class="players-filters">
                    <!-- Search Bar -->
                    <div class="filter-group filter-search">
                        <input
                            type="text"
                            id="player-search-input"
                            class="form-input"
                            placeholder="Search players..."
                            value="${filters.search}"
                        />
                    </div>

                    <!-- Position Filter -->
                    <div class="filter-group">
                        <select id="position-filter" class="form-select">
                            ${positions.map(pos => `
                                <option value="${pos.id}" ${filters.position === pos.id ? 'selected' : ''}>
                                    ${pos.name}
                                </option>
                            `).join('')}
                        </select>
                    </div>

                    <!-- Team Filter -->
                    <div class="filter-group">
                        <select id="team-filter" class="form-select">
                            ${teams.map(team => `
                                <option value="${team.id}" ${filters.team === team.id ? 'selected' : ''}>
                                    ${team.name}
                                </option>
                            `).join('')}
                        </select>
                    </div>

                    <!-- Price Range -->
                    <div class="filter-group filter-price">
                        <label class="text-sm text-tertiary mb-xs">
                            Price: £${(filters.priceMin / 10).toFixed(1)}m - £${(filters.priceMax / 10).toFixed(1)}m
                        </label>
                        <div class="flex gap-sm">
                            <input
                                type="range"
                                id="price-min"
                                min="35"
                                max="150"
                                step="5"
                                value="${filters.priceMin}"
                                class="price-slider"
                            />
                            <input
                                type="range"
                                id="price-max"
                                min="35"
                                max="150"
                                step="5"
                                value="${filters.priceMax}"
                                class="price-slider"
                            />
                        </div>
                    </div>

                    <!-- Sort By -->
                    <div class="filter-group">
                        <select id="sort-filter" class="form-select">
                            <option value="total_points" ${filters.sortBy === 'total_points' ? 'selected' : ''}>Points (High to Low)</option>
                            <option value="form" ${filters.sortBy === 'form' ? 'selected' : ''}>Form (High to Low)</option>
                            <option value="now_cost" ${filters.sortBy === 'now_cost' ? 'selected' : ''}>Price (High to Low)</option>
                            <option value="value" ${filters.sortBy === 'value' ? 'selected' : ''}>Value (Points per £m)</option>
                            <option value="selected_by_percent" ${filters.sortBy === 'selected_by_percent' ? 'selected' : ''}>Ownership %</option>
                            <option value="ict_index" ${filters.sortBy === 'ict_index' ? 'selected' : ''}>ICT Index</option>
                            <option value="expected_goals" ${filters.sortBy === 'expected_goals' ? 'selected' : ''}>xG</option>
                            <option value="expected_assists" ${filters.sortBy === 'expected_assists' ? 'selected' : ''}>xA</option>
                        </select>
                    </div>

                    <!-- Clear Filters -->
                    <div class="filter-group">
                        <button id="clear-filters-btn" class="btn-secondary block">
                            Clear Filters
                        </button>
                    </div>

                    <!-- Compare Button -->
                    <div class="filter-group">
                        <button id="compare-players-btn" class="btn-primary block" ${selectedPlayers.length < 2 || selectedPlayers.length > MAX_SELECTED ? 'disabled' : ''}>
                            Compare (${selectedPlayers.length}/${MAX_SELECTED})
                        </button>
                    </div>
                </div>

                <!-- Results Count & Selection Info -->
                <div class="players-results-count" style="display: flex; justify-content: space-between; align-items: center;">
                    <span>Showing <strong>${Math.min(displayLimit, filteredPlayers.length)}</strong> of ${filteredPlayers.length} players</span>
                    ${selectedPlayers.length > 0 ? `<span class="text-secondary"><strong>${selectedPlayers.length}/${MAX_SELECTED}</strong> players selected</span>` : ''}
                </div>

                <!-- Players Grid -->
                <div class="players-grid">
                    ${filteredPlayers.slice(0, displayLimit).map(player => renderPlayerCard(player)).join('')}
                </div>

                ${filteredPlayers.length > displayLimit ? `
                    <div class="text-center mt-md">
                        <button id="load-more-btn" class="btn-primary">
                            Load 50 More Players (${filteredPlayers.length - displayLimit} remaining)
                        </button>
                    </div>
                ` : ''}

                ${filteredPlayers.length === 0 ? `
                    <div class="text-center p-lg text-tertiary">
                        <p class="text-xl">No players found</p>
                        <p class="text-base-sm">Try adjusting your filters</p>
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    // Attach event listeners
    attachFilterListeners();
}

function renderPlayerCard(player) {
    const team = teamMapCache[player.team];
    const positionNames = ['', 'GKP', 'DEF', 'MID', 'FWD'];
    const position = positionNames[player.element_type] || '???';
    const price = (player.now_cost / 10).toFixed(1);
    const pointsPerMillion = player.now_cost > 0 ? (player.total_points / (player.now_cost / 10)).toFixed(1) : '0.0';
    const ownership = parseFloat(player.selected_by_percent).toFixed(1);

    // Status indicators
    const statusBadges = [];
    if (player.chance_of_playing_next_round !== null && player.chance_of_playing_next_round < 100) {
        statusBadges.push(`<span class="player-status-badge injury">${player.chance_of_playing_next_round}%</span>`);
    }
    if (player.news) {
        statusBadges.push(`<span class="player-status-badge news">!</span>`);
    }

    // Format name with first initial
    const firstInitial = player.first_name ? player.first_name.charAt(0) : '';
    const displayName = firstInitial ? `${firstInitial}. ${player.second_name}` : player.web_name;

    const isSelected = selectedPlayers.includes(player.id);

    return `
        <div class="player-card ${isSelected ? 'selected' : ''}" data-player-id="${player.id}">
            <div class="player-card-header">
                <div class="player-name-section">
                    <h3 class="player-name">${displayName}</h3>
                    <div class="player-meta">
                        <span class="player-position position-${player.element_type}">${position}</span>
                        <span class="player-team">${team ? team.short_name : '???'}</span>
                    </div>
                </div>
                <div class="player-price">
                    <div class="price-value">£${price}m</div>
                    ${player.cost_change_start !== 0 ? `
                        <div class="price-change ${player.cost_change_start > 0 ? 'price-up' : 'price-down'}">
                            ${player.cost_change_start > 0 ? '+' : ''}£${(player.cost_change_start / 10).toFixed(1)}m
                        </div>
                    ` : ''}
                </div>
            </div>

            ${statusBadges.length > 0 ? `
                <div class="player-status-badges">
                    ${statusBadges.join('')}
                    ${player.news ? `<div class="player-news-text">${player.news}</div>` : ''}
                </div>
            ` : ''}

            <div class="player-stats-grid">
                <div class="stat-item">
                    <div class="stat-value">${player.total_points}</div>
                    <div class="stat-label">Points</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${player.form}</div>
                    <div class="stat-label">Form</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${pointsPerMillion}</div>
                    <div class="stat-label">Pts/£m</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${ownership}%</div>
                    <div class="stat-label">Owned</div>
                </div>
            </div>

            <div class="player-performance-stats">
                ${player.element_type === 1 ? `
                    <!-- Goalkeeper Stats -->
                    <div class="perf-stat">
                        <span class="perf-label">Saves:</span>
                        <span class="perf-value">${player.saves}</span>
                    </div>
                    <div class="perf-stat">
                        <span class="perf-label">Clean Sheets:</span>
                        <span class="perf-value">${player.clean_sheets}</span>
                    </div>
                ` : player.element_type === 2 ? `
                    <!-- Defender Stats -->
                    <div class="perf-stat">
                        <span class="perf-label">Clean Sheets:</span>
                        <span class="perf-value">${player.clean_sheets}</span>
                    </div>
                    <div class="perf-stat">
                        <span class="perf-label">Goals:</span>
                        <span class="perf-value">${player.goals_scored}</span>
                    </div>
                    <div class="perf-stat">
                        <span class="perf-label">Assists:</span>
                        <span class="perf-value">${player.assists}</span>
                    </div>
                ` : `
                    <!-- Midfielder/Forward Stats -->
                    <div class="perf-stat">
                        <span class="perf-label">Goals:</span>
                        <span class="perf-value">${player.goals_scored}</span>
                    </div>
                    <div class="perf-stat">
                        <span class="perf-label">Assists:</span>
                        <span class="perf-value">${player.assists}</span>
                    </div>
                    <div class="perf-stat">
                        <span class="perf-label">xG:</span>
                        <span class="perf-value">${parseFloat(player.expected_goals || 0).toFixed(2)}</span>
                    </div>
                    <div class="perf-stat">
                        <span class="perf-label">xA:</span>
                        <span class="perf-value">${parseFloat(player.expected_assists || 0).toFixed(2)}</span>
                    </div>
                `}
            </div>

            <div class="player-card-footer">
                <div class="footer-stat">
                    <span>Minutes:</span>
                    <strong>${player.minutes}</strong>
                </div>
                <div class="footer-stat">
                    <span>Bonus:</span>
                    <strong>${player.bonus}</strong>
                </div>
                <div class="footer-stat">
                    <span>ICT:</span>
                    <strong>${parseFloat(player.ict_index).toFixed(1)}</strong>
                </div>
            </div>
        </div>
    `;
}

function applyFiltersAndSort() {
    filteredPlayers = allPlayers.filter(player => {
        // Search filter
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            const fullName = `${player.first_name} ${player.second_name}`.toLowerCase();
            const webName = player.web_name.toLowerCase();
            if (!fullName.includes(searchLower) && !webName.includes(searchLower)) {
                return false;
            }
        }

        // Position filter
        if (filters.position !== 'all' && player.element_type !== parseInt(filters.position)) {
            return false;
        }

        // Team filter
        if (filters.team !== 'all' && player.team !== parseInt(filters.team)) {
            return false;
        }

        // Price filter
        if (player.now_cost < filters.priceMin || player.now_cost > filters.priceMax) {
            return false;
        }

        return true;
    });

    // Sort
    filteredPlayers.sort((a, b) => {
        if (filters.sortBy === 'value') {
            const valueA = a.now_cost > 0 ? a.total_points / (a.now_cost / 10) : 0;
            const valueB = b.now_cost > 0 ? b.total_points / (b.now_cost / 10) : 0;
            return valueB - valueA;
        }

        const aValue = parseFloat(a[filters.sortBy]) || 0;
        const bValue = parseFloat(b[filters.sortBy]) || 0;
        return bValue - aValue;
    });
}

function attachFilterListeners() {
    // Search input
    const searchInput = document.getElementById('player-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filters.search = e.target.value;
            displayLimit = 50; // Reset display limit when filters change
            renderPlayerSearchHub();
        });
    }

    // Position filter
    const positionFilter = document.getElementById('position-filter');
    if (positionFilter) {
        positionFilter.addEventListener('change', (e) => {
            filters.position = e.target.value;
            displayLimit = 50; // Reset display limit when filters change
            renderPlayerSearchHub();
        });
    }

    // Team filter
    const teamFilter = document.getElementById('team-filter');
    if (teamFilter) {
        teamFilter.addEventListener('change', (e) => {
            filters.team = e.target.value;
            displayLimit = 50; // Reset display limit when filters change
            renderPlayerSearchHub();
        });
    }

    // Price sliders
    const priceMin = document.getElementById('price-min');
    const priceMax = document.getElementById('price-max');
    if (priceMin) {
        priceMin.addEventListener('input', (e) => {
            filters.priceMin = parseInt(e.target.value);
            if (filters.priceMin > filters.priceMax) {
                filters.priceMin = filters.priceMax;
            }
            displayLimit = 50; // Reset display limit when filters change
            renderPlayerSearchHub();
        });
    }
    if (priceMax) {
        priceMax.addEventListener('input', (e) => {
            filters.priceMax = parseInt(e.target.value);
            if (filters.priceMax < filters.priceMin) {
                filters.priceMax = filters.priceMin;
            }
            displayLimit = 50; // Reset display limit when filters change
            renderPlayerSearchHub();
        });
    }

    // Sort filter
    const sortFilter = document.getElementById('sort-filter');
    if (sortFilter) {
        sortFilter.addEventListener('change', (e) => {
            filters.sortBy = e.target.value;
            displayLimit = 50; // Reset display limit when filters change
            renderPlayerSearchHub();
        });
    }

    // Clear filters button
    const clearBtn = document.getElementById('clear-filters-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            filters = {
                search: '',
                position: 'all',
                team: 'all',
                priceMin: 35,
                priceMax: 150,
                sortBy: 'total_points'
            };
            selectedPlayers = []; // Clear selected players
            displayLimit = 50; // Reset display limit
            renderPlayerSearchHub();
        });
    }

    // Compare button
    const compareBtn = document.getElementById('compare-players-btn');
    if (compareBtn) {
        compareBtn.addEventListener('click', () => {
            if (selectedPlayers.length >= 2 && selectedPlayers.length <= MAX_SELECTED) {
                // Navigate to compare page with selected player IDs
                router.navigate('/compare-players', { playerIds: selectedPlayers });
            }
        });
    }

    // Player card selection
    const playerCards = document.querySelectorAll('.player-card');
    playerCards.forEach(card => {
        card.addEventListener('click', () => {
            const playerId = parseInt(card.dataset.playerId);
            togglePlayerSelection(playerId);
        });
    });

    // Load more button
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            displayLimit += 50;
            renderPlayerSearchHub();
        });
    }
}

// Toggle player selection
function togglePlayerSelection(playerId) {
    const index = selectedPlayers.indexOf(playerId);

    if (index > -1) {
        // Player already selected, remove it
        selectedPlayers.splice(index, 1);
    } else {
        // Add player if under limit
        if (selectedPlayers.length < MAX_SELECTED) {
            selectedPlayers.push(playerId);
        }
    }

    // Re-render to update UI
    renderPlayerSearchHub();
}

// Register route
router.addRoute('/players', renderPlayersPage);
