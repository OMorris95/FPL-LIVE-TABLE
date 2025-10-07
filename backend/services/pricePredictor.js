const { getDailyTransferData } = require('./transferTracker');
const { loadDGWInfo } = require('./weeklyDataSync');
const { getBootstrapData, getCurrentGameweek } = require('./fplDataFetcher');

// Price change thresholds (calibrated for realistic predictions)
const RISE_THRESHOLD_1 = 45000;   // First rise (reduced from 70K for more accurate predictions)
const RISE_THRESHOLD_2 = 90000;   // Second rise
const RISE_THRESHOLD_3 = 135000;  // Third rise

// Minimum transfer activity to show prediction (filters out noise)
const MIN_ACTIVITY_THRESHOLD = 1000;

// Chip discount factors
const CHIP_DISCOUNT_NORMAL = 0.85;  // 15% discount for normal weeks
const CHIP_DISCOUNT_DGW = 0.70;     // 30% discount for double gameweeks

/**
 * Determines if current gameweek is a DGW (double gameweek)
 * Uses pre-synced fixture data to accurately identify DGWs
 */
async function isDGWWeek(gameweek) {
    try {
        const dgwInfo = await loadDGWInfo();
        return dgwInfo[gameweek]?.isDGW || false;
    } catch (error) {
        console.warn('Could not load DGW info, assuming normal week:', error.message);
        return false;
    }
}

/**
 * Calculates fall threshold using hybrid approach
 * Base threshold scaled by ownership (prevents extreme values for low-owned players)
 */
function calculateFallThreshold(ownershipPercent) {
    // Base fall threshold (symmetric with rise threshold for fairness)
    const BASE_FALL_THRESHOLD = -35000;

    // Scale by ownership (higher owned = harder to fall)
    // Divide by 15 so a 15% owned player has factor of 1.0
    const ownershipFactor = Math.max(1, parseFloat(ownershipPercent) / 15);

    return Math.round(BASE_FALL_THRESHOLD * ownershipFactor);
}

/**
 * Applies chip discount to raw net transfers
 */
async function applyChipDiscount(netTransfers, gameweek) {
    const isDGW = await isDGWWeek(gameweek);
    const discountFactor = isDGW ? CHIP_DISCOUNT_DGW : CHIP_DISCOUNT_NORMAL;
    return Math.round(netTransfers * discountFactor);
}

/**
 * Determines prediction type and confidence
 */
function getPrediction(effectiveNetTransfers, ownershipPercent, currentPriceChanges) {
    // Determine appropriate rise threshold (accounts for multiple rises)
    let riseThreshold = RISE_THRESHOLD_1;
    if (currentPriceChanges >= 2) {
        riseThreshold = RISE_THRESHOLD_3;
    } else if (currentPriceChanges >= 1) {
        riseThreshold = RISE_THRESHOLD_2;
    }

    const fallThreshold = calculateFallThreshold(ownershipPercent);

    let prediction = 'stable';
    let likelihood = 0;
    let confidence = 'low';

    if (effectiveNetTransfers > 0) {
        // Potential rise
        likelihood = (effectiveNetTransfers / riseThreshold) * 100;

        if (likelihood >= 100) {
            prediction = 'rise';
            confidence = 'high';
        } else if (likelihood >= 80) {
            prediction = 'rise';
            confidence = 'medium';
        } else if (likelihood >= 60) {
            prediction = 'watch';
            confidence = 'low';
        }
    } else if (effectiveNetTransfers < 0) {
        // Potential fall
        likelihood = (effectiveNetTransfers / fallThreshold) * 100;

        if (likelihood >= 100) {
            prediction = 'fall';
            confidence = 'high';
        } else if (likelihood >= 80) {
            prediction = 'fall';
            confidence = 'medium';
        } else if (likelihood >= 60) {
            prediction = 'watch';
            confidence = 'low';
        }
    }

    return {
        prediction,
        likelihood: Math.min(100, Math.max(0, Math.round(likelihood))),
        confidence,
        threshold: effectiveNetTransfers > 0 ? riseThreshold : fallThreshold
    };
}

/**
 * Generates price change predictions from daily transfer data
 */
async function generatePredictions() {
    console.log('\n=== Generating Price Predictions ===');

    try {
        const dailyData = await getDailyTransferData();
        const bootstrapData = await getBootstrapData();
        const currentGw = getCurrentGameweek(bootstrapData);
        const isDGW = await isDGWWeek(currentGw);

        if (!dailyData || !dailyData.players) {
            console.log('No daily transfer data available');
            return {
                risers: [],
                fallers: [],
                watchlist: [],
                metadata: {
                    generated_at: new Date().toISOString(),
                    last_data_update: null,
                    chip_discount_applied: isDGW ? 'DGW (30%)' : 'Normal (15%)',
                    current_gameweek: currentGw
                }
            };
        }

        const predictions = {
            risers: [],
            fallers: [],
            watchlist: []
        };

        // Process each player
        for (const player of Object.values(dailyData.players)) {
            const rawNetTransfers = player.daily_net_delta || 0;

            // Skip players with no transfer activity
            if (rawNetTransfers === 0) continue;

            // Apply chip discount
            const effectiveNetTransfers = await applyChipDiscount(rawNetTransfers, currentGw);

            // Skip players with minimal activity (noise filter)
            if (Math.abs(effectiveNetTransfers) < MIN_ACTIVITY_THRESHOLD) continue;

            // Get prediction
            const result = getPrediction(
                effectiveNetTransfers,
                player.selected_by_percent,
                0 // TODO: Track price changes this gameweek
            );

            const playerPrediction = {
                id: player.id,
                web_name: player.web_name,
                now_cost: player.now_cost,
                ownership: player.selected_by_percent,
                raw_net_transfers: rawNetTransfers,
                effective_net_transfers: effectiveNetTransfers,
                predicted_price: player.now_cost + (result.prediction === 'rise' ? 1 : result.prediction === 'fall' ? -1 : 0),
                ...result
            };

            // Categorize
            if (result.prediction === 'rise') {
                predictions.risers.push(playerPrediction);
            } else if (result.prediction === 'fall') {
                predictions.fallers.push(playerPrediction);
            } else if (result.prediction === 'watch') {
                predictions.watchlist.push(playerPrediction);
            }
        }

        // Sort by likelihood
        predictions.risers.sort((a, b) => b.likelihood - a.likelihood);
        predictions.fallers.sort((a, b) => b.likelihood - a.likelihood);
        predictions.watchlist.sort((a, b) => Math.abs(b.effective_net_transfers) - Math.abs(a.effective_net_transfers));

        predictions.metadata = {
            generated_at: new Date().toISOString(),
            last_data_update: dailyData.last_updated,
            chip_discount_applied: isDGW ? 'DGW (30%)' : 'Normal (15%)',
            current_gameweek: currentGw,
            is_double_gameweek: isDGW,
            total_predictions: predictions.risers.length + predictions.fallers.length + predictions.watchlist.length
        };

        console.log(`Predicted risers: ${predictions.risers.length}`);
        console.log(`Predicted fallers: ${predictions.fallers.length}`);
        console.log(`Watch list: ${predictions.watchlist.length}`);
        console.log('=== Predictions generated ===\n');

        return predictions;
    } catch (error) {
        console.error('Error generating predictions:', error);
        throw error;
    }
}

module.exports = {
    generatePredictions
};
