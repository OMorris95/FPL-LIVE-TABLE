// Price Predictor Page - Price Change Predictions

let priceData = null;
let bootstrapCache = null;
let teamCache = null;
let accuracyData = null;
let refreshTimer = null;  // Track the refresh timer to prevent orphaned timers

async function renderPricePredictorPage(state = {}) {
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
        // Fetch bootstrap data for team info
        bootstrapCache = await getBootstrapData();

        if (!bootstrapCache) {
            throw new Error('Could not fetch player data');
        }

        teamCache = createTeamMap(bootstrapCache);

        // Fetch predictions from backend API
        const predictionsResponse = await fetch('/api/price-predictions');
        if (!predictionsResponse.ok) {
            throw new Error('Failed to fetch price predictions from backend');
        }
        const predictions = await predictionsResponse.json();

        // Fetch accuracy data
        try {
            const accuracyResponse = await fetch('/api/price-accuracy');
            if (accuracyResponse.ok) {
                accuracyData = await accuracyResponse.json();
            }
        } catch (error) {
            console.log('Accuracy data not available yet');
        }

        // Render the price predictor interface
        renderPricePredictorHub(predictions);

        // Auto-refresh every 5 minutes (only if still on this page)
        // Clear any existing timer first to prevent multiple timers
        if (refreshTimer) {
            clearTimeout(refreshTimer);
        }

        refreshTimer = setTimeout(() => {
            // Only refresh if user is still on the prices page
            if (router.currentRoute === '/prices') {
                console.log('Auto-refreshing price predictions...');
                renderPricePredictorPage();
            } else {
                console.log('User left prices page, canceling auto-refresh');
            }
        }, 5 * 60 * 1000);

    } catch (error) {
        console.error('Error loading Price Predictor:', error);
        app.innerHTML = `
            <div class="card text-center">
                <h2 class="text-error">Error Loading Price Predictor</h2>
                <p>${error.message}</p>
                <p class="text-sm text-tertiary mt-xs">Make sure the backend server is running</p>
                <button class="btn-primary" id="go-home-btn">
                    Go to Home
                </button>
            </div>
        `;

        // Add event listener
        document.getElementById('go-home-btn').addEventListener('click', () => {
            router.navigate('/');
        });
    }
}

// Old calculation function removed - now using backend API

function renderPricePredictorHub(predictions) {
    const app = document.getElementById('app');

    const lastUpdated = predictions.metadata?.last_data_update
        ? new Date(predictions.metadata.last_data_update).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        : 'Unknown';

    const chipDiscount = predictions.metadata?.chip_discount_applied || 'Unknown';

    app.innerHTML = `
        <div class="price-predictor-container">
            <div class="card card-top">
                <div class="card-header">
                    <div>
                        <h2 class="card-title">Price Change Predictor</h2>
                        <p class="subtitle text-base-sm mt-xs">
                            Predicted price changes for tonight • Last updated: ${lastUpdated}
                        </p>
                        <p class="text-xs text-tertiary mt-xs">
                            Updates every 30 mins • ${chipDiscount} chip discount applied
                        </p>
                    </div>
                </div>

                ${accuracyData && accuracyData.overall.total > 0 ? `
                    <!-- Accuracy Section -->
                    <div class="mb-1 p-sm" style="background: var(--bg-secondary); border-radius: var(--radius-md); border-left: 3px solid var(--secondary-color);">
                        <h3 class="text-base" style="color: var(--secondary-color); margin-bottom: 0.5rem;">
                            📊 Predictor Accuracy
                        </h3>
                        <div class="grid-3 gap-sm">
                            <div class="text-center">
                                <div class="text-xl" style="font-weight: 700; color: var(--accent-gold);">${accuracyData.overall.accuracy}%</div>
                                <div class="text-xs text-tertiary">Overall</div>
                                <div class="text-xs text-quaternary">${accuracyData.overall.correct}/${accuracyData.overall.total}</div>
                            </div>
                            <div class="text-center">
                                <div class="text-xl" style="font-weight: 700; color: var(--success);">${accuracyData.risers.accuracy}%</div>
                                <div class="text-xs text-tertiary">Risers</div>
                                <div class="text-xs text-quaternary">${accuracyData.risers.correct}/${accuracyData.risers.total}</div>
                            </div>
                            <div class="text-center">
                                <div class="text-xl" style="font-weight: 700; color: var(--error);">${accuracyData.fallers.accuracy}%</div>
                                <div class="text-xs text-tertiary">Fallers</div>
                                <div class="text-xs text-quaternary">${accuracyData.fallers.correct}/${accuracyData.fallers.total}</div>
                            </div>
                        </div>
                        <p class="text-xs text-tertiary mt-xs text-center">
                            Based on ${accuracyData.overall.total} predictions over ${accuracyData.history.length} days • Algorithm uses daily transfer deltas, not cumulative gameweek totals
                        </p>
                    </div>
                ` : ''}

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
                        <div class="summary-value">${predictions.watchlist.length}</div>
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
                        Watch List (${predictions.watchlist.length})
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
                                <p class="text-xs text-tertiary">Check back later or wait for transfer tracking to accumulate data</p>
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
                                <p class="text-xs text-tertiary">Check back later or wait for transfer tracking to accumulate data</p>
                            </div>
                        `}
                    </div>

                    <!-- Watch List -->
                    <div class="tab-pane" data-pane="watch">
                        ${predictions.watchlist.length > 0 ? `
                            <div class="price-players-list">
                                ${predictions.watchlist.slice(0, 30).map(player => renderPricePlayerRow(player, 'watch')).join('')}
                            </div>
                        ` : `
                            <div class="empty-state">
                                <p>No players on watch list</p>
                                <p class="text-xs text-tertiary">Players with moderate transfer activity will appear here</p>
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
    // Get player data from bootstrap for team info
    const playerData = bootstrapCache.elements.find(p => p.id === player.id);
    const team = playerData ? teamCache[playerData.team] : null;
    const positionNames = ['', 'GKP', 'DEF', 'MID', 'FWD'];
    const position = playerData ? positionNames[playerData.element_type] : '???';

    const price = (player.now_cost / 10).toFixed(1);
    const predictedPrice = (player.predicted_price / 10).toFixed(1);
    const ownership = parseFloat(player.ownership).toFixed(1);

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

    // Confidence badge
    const confidenceBadge = player.confidence === 'high' ? '🔥 High'
        : player.confidence === 'medium' ? '⚠️ Medium'
        : '📊 Low';

    return `
        <div class="price-player-row ${colorClass}">
            <div class="price-player-info">
                <div class="price-player-name">
                    <strong>${player.web_name}</strong>
                    <span class="price-player-meta">
                        <span class="player-position position-${playerData?.element_type || 0}">${position}</span>
                        <span>${team ? team.short_name : '???'}</span>
                        <span style="color: var(--text-quaternary); font-size: 0.7rem;">• ${confidenceBadge}</span>
                    </span>
                </div>
            </div>

            <div class="price-stats">
                <div class="price-stat">
                    <span class="price-stat-label">Price</span>
                    <span class="price-stat-value">
                        £${price}m ${arrow} £${predictedPrice}m
                    </span>
                </div>
                <div class="price-stat">
                    <span class="price-stat-label">Daily Net</span>
                    <span class="price-stat-value ${player.effective_net_transfers > 0 ? 'positive' : 'negative'}">
                        ${player.effective_net_transfers > 0 ? '+' : ''}${player.effective_net_transfers.toLocaleString()}
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
