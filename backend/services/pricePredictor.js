const { getDailyTransferData } = require('./transferTracker');

// Price change thresholds (based on research)
const RISE_THRESHOLD_1 = 70000;   // First rise
const RISE_THRESHOLD_2 = 140000;  // Second rise
const RISE_THRESHOLD_3 = 210000;  // Third rise

// Chip discount factors
const CHIP_DISCOUNT_NORMAL = 0.85;  // 15% discount for normal weeks
const CHIP_DISCOUNT_DGW = 0.70;     // 30% discount for double gameweeks

/**
 * Determines if current gameweek is a DGW/BGW (higher chip usage)
 * In real implementation, check bootstrap-static events for is_dgw flag
 */
function isDGWWeek() {
    // Placeholder - would check FPL API for DGW status
    // For now, assume normal week
    return false;
}

/**
 * Calculates fall threshold based on ownership
 * Fall threshold ≈ 10% of ownership (in number of managers)
 */
function calculateFallThreshold(ownershipPercent) {
    // Total FPL managers ≈ 10 million (approximate)
    const totalManagers = 10000000;
    const managersOwning = (ownershipPercent / 100) * totalManagers;
    return -Math.round(managersOwning * 0.1); // Negative for falls
}

/**
 * Applies chip discount to raw net transfers
 */
function applyChipDiscount(netTransfers) {
    const discountFactor = isDGWWeek() ? CHIP_DISCOUNT_DGW : CHIP_DISCOUNT_NORMAL;
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

        if (!dailyData || !dailyData.players) {
            console.log('No daily transfer data available');
            return {
                risers: [],
                fallers: [],
                watchlist: [],
                metadata: {
                    generated_at: new Date().toISOString(),
                    last_data_update: null,
                    chip_discount_applied: isDGWWeek() ? 'DGW (30%)' : 'Normal (15%)'
                }
            };
        }

        const predictions = {
            risers: [],
            fallers: [],
            watchlist: []
        };

        // Process each player
        Object.values(dailyData.players).forEach(player => {
            const rawNetTransfers = player.daily_net_delta || 0;

            // Skip players with no transfer activity
            if (rawNetTransfers === 0) return;

            // Apply chip discount
            const effectiveNetTransfers = applyChipDiscount(rawNetTransfers);

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
        });

        // Sort by likelihood
        predictions.risers.sort((a, b) => b.likelihood - a.likelihood);
        predictions.fallers.sort((a, b) => b.likelihood - a.likelihood);
        predictions.watchlist.sort((a, b) => Math.abs(b.effective_net_transfers) - Math.abs(a.effective_net_transfers));

        predictions.metadata = {
            generated_at: new Date().toISOString(),
            last_data_update: dailyData.last_updated,
            chip_discount_applied: isDGWWeek() ? 'DGW (30%)' : 'Normal (15%)',
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
