const express = require('express');
const router = express.Router();
const { loadOwnershipData, getLatestOwnershipData, loadUpdateMetadata } = require('../services/dataStorage');
const { getBootstrapData, getCurrentGameweek } = require('../services/fplDataFetcher');
const { generatePredictions } = require('../services/pricePredictor');

/**
 * GET /api/ownership/:tier/latest
 * Fetches latest available ownership data for a tier
 * NOTE: This route MUST come before /:tier/:gameweek to match correctly
 */
router.get('/ownership/:tier/latest', async (req, res) => {
    try {
        const { tier } = req.params;

        // Validate tier
        if (!['100', '100_test', '1k', '10k'].includes(tier)) {
            return res.status(400).json({ error: 'Invalid tier. Must be 100, 100_test, 1k, or 10k' });
        }

        // Get current gameweek
        const bootstrapData = await getBootstrapData();
        const currentGw = getCurrentGameweek(bootstrapData);

        const data = await getLatestOwnershipData(tier, currentGw);

        if (!data) {
            return res.status(404).json({ error: `No ownership data found for tier ${tier}` });
        }

        res.json(data);
    } catch (error) {
        console.error('Error fetching latest ownership data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/ownership/:tier/:gameweek
 * Fetches ownership data for a specific tier and gameweek
 * Tiers: 100, 1k, 10k
 */
router.get('/ownership/:tier/:gameweek', async (req, res) => {
    try {
        const { tier, gameweek } = req.params;

        // Validate tier
        if (!['100', '100_test', '1k', '10k'].includes(tier)) {
            return res.status(400).json({ error: 'Invalid tier. Must be 100, 100_test, 1k, or 10k' });
        }

        // Validate gameweek
        const gw = parseInt(gameweek);
        if (isNaN(gw) || gw < 1 || gw > 38) {
            return res.status(400).json({ error: 'Invalid gameweek. Must be between 1 and 38' });
        }

        const data = await loadOwnershipData(tier, gw);

        if (!data) {
            return res.status(404).json({ error: `No ownership data found for tier ${tier}, gameweek ${gw}` });
        }

        res.json(data);
    } catch (error) {
        console.error('Error fetching ownership data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/status
 * Returns status of last data update
 */
router.get('/status', async (req, res) => {
    try {
        const metadata = await loadUpdateMetadata();
        const bootstrapData = await getBootstrapData();
        const currentGw = getCurrentGameweek(bootstrapData);

        res.json({
            current_gameweek: currentGw,
            last_update: metadata || { status: 'No updates yet' }
        });
    } catch (error) {
        console.error('Error fetching status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/price-predictions
 * Returns current price change predictions based on daily transfer deltas
 */
router.get('/price-predictions', async (req, res) => {
    try {
        const predictions = await generatePredictions();
        res.json(predictions);
    } catch (error) {
        console.error('Error generating price predictions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/price-accuracy
 * Returns historical accuracy data for price predictions
 */
router.get('/price-accuracy', async (req, res) => {
    try {
        const fs = require('fs').promises;
        const path = require('path');
        const filepath = path.join(__dirname, '../data/price_accuracy.json');

        try {
            const data = await fs.readFile(filepath, 'utf8');
            res.json(JSON.parse(data));
        } catch {
            // No accuracy data yet
            res.json({
                overall: { correct: 0, total: 0, accuracy: 0 },
                risers: { correct: 0, total: 0, accuracy: 0 },
                fallers: { correct: 0, total: 0, accuracy: 0 },
                history: []
            });
        }
    } catch (error) {
        console.error('Error fetching accuracy data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
