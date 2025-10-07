const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');
const { getBootstrapData } = require('../services/fplDataFetcher');
const { resetDailyDeltas } = require('../services/transferTracker');

const PREDICTIONS_DIR = path.join(__dirname, '../data/price_predictions');
const ACCURACY_FILE = path.join(__dirname, '../data/price_accuracy.json');

/**
 * Ensures predictions directory exists
 */
async function ensurePredictionsDir() {
    try {
        await fs.access(PREDICTIONS_DIR);
    } catch {
        await fs.mkdir(PREDICTIONS_DIR, { recursive: true });
    }
}

/**
 * Saves today's predictions for verification tomorrow
 */
async function saveTodaysPredictions(predictions) {
    await ensurePredictionsDir();

    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filepath = path.join(PREDICTIONS_DIR, `predictions_${date}.json`);

    await fs.writeFile(filepath, JSON.stringify(predictions, null, 2));
    console.log(`Saved predictions for ${date}`);
}

/**
 * Loads yesterday's predictions
 */
async function loadYesterdaysPredictions() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const date = yesterday.toISOString().split('T')[0];

    const filepath = path.join(PREDICTIONS_DIR, `predictions_${date}.json`);

    try {
        const data = await fs.readFile(filepath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.log(`No predictions found for ${date}`);
        return null;
    }
}

/**
 * Loads current accuracy data
 */
async function loadAccuracyData() {
    try {
        const data = await fs.readFile(ACCURACY_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        return {
            overall: { correct: 0, total: 0, accuracy: 0 },
            risers: { correct: 0, total: 0, accuracy: 0 },
            fallers: { correct: 0, total: 0, accuracy: 0 },
            history: []
        };
    }
}

/**
 * Saves accuracy data
 */
async function saveAccuracyData(data) {
    await fs.writeFile(ACCURACY_FILE, JSON.stringify(data, null, 2));
}

/**
 * Compares predictions with actual price changes
 */
async function verifyPredictions() {
    console.log('\n=== Verifying Price Change Predictions ===');
    console.log(`Timestamp: ${new Date().toISOString()}`);

    try {
        // 1. Load yesterday's predictions
        const yesterdaysPredictions = await loadYesterdaysPredictions();

        if (!yesterdaysPredictions) {
            console.log('No predictions to verify');
            return;
        }

        // 2. Fetch current bootstrap data (has updated prices)
        const bootstrapData = await getBootstrapData();
        const currentPrices = {};
        bootstrapData.elements.forEach(player => {
            currentPrices[player.id] = player.now_cost;
        });

        // 3. Create map of yesterday's prices from predictions
        const yesterdayPrices = {};
        [...yesterdaysPredictions.risers, ...yesterdaysPredictions.fallers, ...yesterdaysPredictions.watchlist].forEach(p => {
            yesterdayPrices[p.id] = p.now_cost;
        });

        // 4. Verify each prediction
        let risersCorrect = 0;
        let risersFalse = 0;
        let fallersCorrect = 0;
        let fallersFalse = 0;

        yesterdaysPredictions.risers.forEach(prediction => {
            const actualChange = currentPrices[prediction.id] - yesterdayPrices[prediction.id];
            if (actualChange > 0) {
                risersCorrect++;
            } else {
                risersFalse++;
            }
        });

        yesterdaysPredictions.fallers.forEach(prediction => {
            const actualChange = currentPrices[prediction.id] - yesterdayPrices[prediction.id];
            if (actualChange < 0) {
                fallersCorrect++;
            } else {
                fallersFalse++;
            }
        });

        const risersTotal = risersCorrect + risersFalse;
        const fallersTotal = fallersCorrect + fallersFalse;
        const overallCorrect = risersCorrect + fallersCorrect;
        const overallTotal = risersTotal + fallersTotal;

        // 5. Load and update accuracy data
        const accuracyData = await loadAccuracyData();

        accuracyData.overall.correct += overallCorrect;
        accuracyData.overall.total += overallTotal;
        accuracyData.overall.accuracy = accuracyData.overall.total > 0
            ? Math.round((accuracyData.overall.correct / accuracyData.overall.total) * 100)
            : 0;

        accuracyData.risers.correct += risersCorrect;
        accuracyData.risers.total += risersTotal;
        accuracyData.risers.accuracy = accuracyData.risers.total > 0
            ? Math.round((accuracyData.risers.correct / accuracyData.risers.total) * 100)
            : 0;

        accuracyData.fallers.correct += fallersCorrect;
        accuracyData.fallers.total += fallersTotal;
        accuracyData.fallers.accuracy = accuracyData.fallers.total > 0
            ? Math.round((accuracyData.fallers.correct / accuracyData.fallers.total) * 100)
            : 0;

        // Add to history
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        accuracyData.history.push({
            date: yesterday.toISOString().split('T')[0],
            risers: { correct: risersCorrect, total: risersTotal },
            fallers: { correct: fallersCorrect, total: fallersTotal },
            overall: { correct: overallCorrect, total: overallTotal }
        });

        // Keep last 30 days only
        if (accuracyData.history.length > 30) {
            accuracyData.history = accuracyData.history.slice(-30);
        }

        await saveAccuracyData(accuracyData);

        // 6. Log results
        console.log(`Overall: ${overallCorrect}/${overallTotal} correct (${Math.round((overallCorrect/overallTotal)*100)}%)`);
        console.log(`Risers: ${risersCorrect}/${risersTotal} correct`);
        console.log(`Fallers: ${fallersCorrect}/${fallersTotal} correct`);
        console.log(`Cumulative accuracy: ${accuracyData.overall.accuracy}%`);
        console.log('=== Verification complete ===\n');

    } catch (error) {
        console.error('=== Error verifying predictions ===');
        console.error(error);
    }
}

/**
 * Main cron job - runs at 2:45 AM daily (after price changes at ~2 AM)
 * Cron format: minute hour day month weekday
 * 45 2 * * * = At 02:45 every day
 * Note: Runs at 2:45 AM to reset BEFORE first transfer snapshot of the new day (at 3:00 AM)
 */
cron.schedule('45 2 * * *', async () => {
    console.log('Price change verification cron triggered');

    try {
        // 1. Verify yesterday's predictions
        await verifyPredictions();

        // 2. Reset daily transfer deltas
        await resetDailyDeltas();

        console.log('Daily reset complete');
    } catch (error) {
        console.error('Verification cron failed:', error);
    }
});

console.log('Price change verification cron scheduled: Daily at 2:45 AM');

// Export for manual triggering
module.exports = {
    verifyPredictions,
    saveTodaysPredictions
};
