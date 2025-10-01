// Price Predictor Page - Price Change Predictions

let priceData = null;
let bootstrapCache = null;
let teamCache = null;

async function renderPricePredictorPage() {
    const app = document.getElementById('app');
    const nav = document.getElementById('main-nav');

    // Show navigation
    nav.style.display = 'block';

    // Show loading
    app.innerHTML = `
        <div class="text-center mt-2">
            <div class="spinner"></div>
            <p class="loading-text">Loading price predictions...</p>
        </div>
    `;

    try {
        // Fetch bootstrap data
        bootstrapCache = await getBootstrapData();

        if (!bootstrapCache) {
            throw new Error('Could not fetch player data');
        }

        teamCache = createTeamMap(bootstrapCache);

        // Calculate price change predictions
        const predictions = calculatePriceChangePredictions(bootstrapCache.elements);

        // Render the price predictor interface
        renderPricePredictorHub(predictions);

    } catch (error) {
        console.error('Error loading Price Predictor:', error);
        app.innerHTML = `
            <div class="card text-center">
                <h2 style="color: var(--rank-down);">Error Loading Price Predictor</h2>
                <p>${error.message}</p>
                <button class="btn-primary" onclick="router.navigate('/')">
                    Go to Home
                </button>
            </div>
        `;
    }
}

function calculatePriceChangePredictions(players) {
    const predictions = {
        risers: [],
        fallers: [],
        stable: []
    };

    players.forEach(player => {
        const ownership = parseFloat(player.selected_by_percent) || 0;
        const transfersIn = player.transfers_in_event || 0;
        const transfersOut = player.transfers_out_event || 0;
        const netTransfers = transfersIn - transfersOut;

        // Calculate transfer delta percentage
        // Formula based on common FPL price change mechanics
        const transferDelta = ownership > 0 ? (netTransfers / (ownership * 10000)) : 0;

        // Price change thresholds (simplified model)
        // Real FPL algorithm is more complex and proprietary
        const riseThreshold = 0.5;  // 50% transfer delta
        const fallThreshold = -0.5; // -50% transfer delta

        // Determine likelihood (0-100%)
        let likelihood = 0;
        let prediction = 'stable';

        if (transferDelta > 0) {
            likelihood = Math.min(100, (transferDelta / riseThreshold) * 100);
            if (likelihood >= 80) {
                prediction = 'rise';
            }
        } else if (transferDelta < 0) {
            likelihood = Math.min(100, (Math.abs(transferDelta) / Math.abs(fallThreshold)) * 100);
            if (likelihood >= 80) {
                prediction = 'fall';
            }
        }

        const playerData = {
            ...player,
            netTransfers,
            transferDelta,
            likelihood: Math.round(likelihood),
            prediction
        };

        if (prediction === 'rise') {
            predictions.risers.push(playerData);
        } else if (prediction === 'fall') {
            predictions.fallers.push(playerData);
        } else if (Math.abs(transferDelta) > 0.1) {
            predictions.stable.push(playerData);
        }
    });

    // Sort by likelihood
    predictions.risers.sort((a, b) => b.likelihood - a.likelihood);
    predictions.fallers.sort((a, b) => b.likelihood - a.likelihood);
    predictions.stable.sort((a, b) => Math.abs(b.transferDelta) - Math.abs(a.transferDelta));

    return predictions;
}

function renderPricePredictorHub(predictions) {
    const app = document.getElementById('app');

    const now = new Date();
    const lastUpdated = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    app.innerHTML = `
        <div class="price-predictor-container">
            <div class="card">
                <div class="card-header">
                    <div>
                        <h2 class="card-title">Price Change Predictor</h2>
                        <p style="color: #aaa; margin: 0.5rem 0 0 0; font-size: 0.875rem;">
                            Predicted price changes for tonight • Last updated: ${lastUpdated}
                        </p>
                    </div>
                </div>

                <!-- Disclaimer -->
                <div class="price-disclaimer">
                    <strong>⚠️ Disclaimer:</strong> Price predictions are estimates based on transfer data.
                    The actual FPL price change algorithm is proprietary and more complex.
                    Use these predictions as a guide, not a guarantee.
                </div>

                <!-- Summary Stats -->
                <div class="price-summary">
                    <div class="summary-stat stat-risers">
                        <div class="summary-value">${predictions.risers.length}</div>
                        <div class="summary-label">Predicted Risers</div>
                    </div>
                    <div class="summary-stat stat-fallers">
                        <div class="summary-value">${predictions.fallers.length}</div>
                        <div class="summary-label">Predicted Fallers</div>
                    </div>
                    <div class="summary-stat">
                        <div class="summary-value">${predictions.stable.length}</div>
                        <div class="summary-label">Watch List</div>
                    </div>
                </div>

                <!-- Tabs -->
                <div class="price-tabs">
                    <button class="price-tab active" data-tab="risers">
                        Risers (${predictions.risers.length})
                    </button>
                    <button class="price-tab" data-tab="fallers">
                        Fallers (${predictions.fallers.length})
                    </button>
                    <button class="price-tab" data-tab="watch">
                        Watch List (${predictions.stable.length})
                    </button>
                </div>

                <!-- Tab Content -->
                <div class="price-tab-content">
                    <!-- Risers -->
                    <div class="tab-pane active" data-pane="risers">
                        ${predictions.risers.length > 0 ? `
                            <div class="price-players-list">
                                ${predictions.risers.slice(0, 30).map(player => renderPricePlayerRow(player, 'rise')).join('')}
                            </div>
                        ` : `
                            <div class="empty-state">
                                <p>No players predicted to rise tonight</p>
                            </div>
                        `}
                    </div>

                    <!-- Fallers -->
                    <div class="tab-pane" data-pane="fallers">
                        ${predictions.fallers.length > 0 ? `
                            <div class="price-players-list">
                                ${predictions.fallers.slice(0, 30).map(player => renderPricePlayerRow(player, 'fall')).join('')}
                            </div>
                        ` : `
                            <div class="empty-state">
                                <p>No players predicted to fall tonight</p>
                            </div>
                        `}
                    </div>

                    <!-- Watch List -->
                    <div class="tab-pane" data-pane="watch">
                        ${predictions.stable.length > 0 ? `
                            <div class="price-players-list">
                                ${predictions.stable.slice(0, 30).map(player => renderPricePlayerRow(player, 'watch')).join('')}
                            </div>
                        ` : `
                            <div class="empty-state">
                                <p>No players on watch list</p>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        </div>
    `;

    // Attach tab listeners
    attachTabListeners();
}

function renderPricePlayerRow(player, type) {
    const team = teamCache[player.team];
    const positionNames = ['', 'GKP', 'DEF', 'MID', 'FWD'];
    const position = positionNames[player.element_type] || '???';
    const price = (player.now_cost / 10).toFixed(1);
    const newPrice = type === 'rise'
        ? ((player.now_cost + 1) / 10).toFixed(1)
        : type === 'fall'
            ? ((player.now_cost - 1) / 10).toFixed(1)
            : price;

    const ownership = parseFloat(player.selected_by_percent).toFixed(1);

    // Get arrow and color based on type
    let arrow = '';
    let colorClass = '';
    if (type === 'rise') {
        arrow = '▲';
        colorClass = 'price-rise';
    } else if (type === 'fall') {
        arrow = '▼';
        colorClass = 'price-fall';
    } else {
        arrow = '—';
        colorClass = 'price-watch';
    }

    return `
        <div class="price-player-row ${colorClass}">
            <div class="price-player-info">
                <div class="price-player-name">
                    <strong>${player.web_name}</strong>
                    <span class="price-player-meta">
                        <span class="player-position position-${player.element_type}">${position}</span>
                        <span>${team ? team.short_name : '???'}</span>
                    </span>
                </div>
            </div>

            <div class="price-stats">
                <div class="price-stat">
                    <span class="price-stat-label">Price</span>
                    <span class="price-stat-value">
                        £${price}m ${arrow} £${newPrice}m
                    </span>
                </div>
                <div class="price-stat">
                    <span class="price-stat-label">Net Transfers</span>
                    <span class="price-stat-value ${player.netTransfers > 0 ? 'positive' : 'negative'}">
                        ${player.netTransfers > 0 ? '+' : ''}${player.netTransfers.toLocaleString()}
                    </span>
                </div>
                <div class="price-stat">
                    <span class="price-stat-label">Ownership</span>
                    <span class="price-stat-value">${ownership}%</span>
                </div>
                <div class="price-stat">
                    <span class="price-stat-label">Likelihood</span>
                    <div class="likelihood-bar">
                        <div class="likelihood-fill ${colorClass}" style="width: ${player.likelihood}%"></div>
                        <span class="likelihood-text">${player.likelihood}%</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function attachTabListeners() {
    const tabs = document.querySelectorAll('.price-tab');
    const panes = document.querySelectorAll('.tab-pane');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetPane = tab.dataset.tab;

            // Remove active class from all tabs and panes
            tabs.forEach(t => t.classList.remove('active'));
            panes.forEach(p => p.classList.remove('active'));

            // Add active class to clicked tab and corresponding pane
            tab.classList.add('active');
            const pane = document.querySelector(`.tab-pane[data-pane="${targetPane}"]`);
            if (pane) {
                pane.classList.add('active');
            }
        });
    });
}

// Register route
router.addRoute('/prices', renderPricePredictorPage);
