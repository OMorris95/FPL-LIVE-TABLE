const express = require('express');
const router = express.Router();
const { loadOwnershipData, getLatestOwnershipData, loadUpdateMetadata } = require('../services/dataStorage');
const { getBootstrapData, getCurrentGameweek } = require('../services/fplDataFetcher');
const { generatePredictions } = require('../services/pricePredictor');
const { loadCachedPlayerData, loadPlayerDataMetadata } = require('../services/playerDataFetcher');
const { loadPlayerRecentStats } = require('../services/playerStatsCalculator');

/**
 * GET /api/ownership/:tier/latest
 * Fetches latest available ownership data for a tier
 * NOTE: This route MUST come before /:tier/:gameweek to match correctly
 */
router.get('/ownership/:tier/latest', async (req, res) => {
    try {
        const { tier } = req.params;

        // Validate tier
        if (!['100', '1k', '10k'].includes(tier)) {
            return res.status(400).json({ error: 'Invalid tier. Must be 100, 1k, or 10k' });
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
        if (!['100', '1k', '10k'].includes(tier)) {
            return res.status(400).json({ error: 'Invalid tier. Must be 100, 1k, or 10k' });
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

/**
 * GET /api/fpl-proxy/*
 * Proxies FPL API requests for users whose carriers block CORS proxies
 * Only used as fallback when corsproxy.io fails
 */
router.get('/fpl-proxy/*', async (req, res) => {
    try {
        const axios = require('axios');
        const fplPath = req.params[0];
        const fplUrl = `https://fantasy.premierleague.com/api/${fplPath}`;
        const userIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

        console.log(`[FALLBACK PROXY] ${new Date().toISOString()} | IP: ${userIP} | Path: ${fplPath}`);

        const response = await axios.get(fplUrl);

        console.log(`[FALLBACK SUCCESS] Status: ${response.status} | Path: ${fplPath}`);
        res.json(response.data);
    } catch (error) {
        // Log rate limiting specifically
        if (error.response && error.response.status === 429) {
            console.error(`[RATE LIMIT DETECTED] ${new Date().toISOString()} | IP: ${userIP} | Path: ${fplPath}`);
            console.error(`[RATE LIMIT] This means FPL is blocking your VPS IP. Consider alternative solutions.`);
        } else {
            console.error(`[FALLBACK ERROR] ${error.message} | Status: ${error.response?.status} | Path: ${fplPath}`);
        }

        res.status(error.response?.status || 500).json({
            error: error.response?.status === 429 ? 'Rate limited by FPL API' : 'FPL API error'
        });
    }
});

/**
 * GET /api/player-data/full
 * Returns the complete cached player data (bootstrap + all histories)
 * This is a large response (~10-20MB) - use sparingly
 */
router.get('/player-data/full', async (req, res) => {
    try {
        const data = await loadCachedPlayerData();

        if (!data) {
            return res.status(404).json({
                error: 'No cached player data available',
                message: 'Player data is still being fetched or the cronjob has not run yet'
            });
        }

        res.json(data);
    } catch (error) {
        console.error('Error fetching cached player data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/player-data/bootstrap
 * Returns only the bootstrap data from cache (lighter response)
 */
router.get('/player-data/bootstrap', async (req, res) => {
    try {
        const data = await loadCachedPlayerData();

        if (!data || !data.bootstrap) {
            return res.status(404).json({
                error: 'No cached bootstrap data available'
            });
        }

        res.json({
            last_updated: data.last_updated,
            gameweek: data.gameweek,
            bootstrap: data.bootstrap
        });
    } catch (error) {
        console.error('Error fetching cached bootstrap data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/player-data/history/:playerId
 * Returns a specific player's history from cache
 */
router.get('/player-data/history/:playerId', async (req, res) => {
    try {
        const playerId = req.params.playerId;
        const data = await loadCachedPlayerData();

        if (!data || !data.player_histories) {
            return res.status(404).json({
                error: 'No cached player data available'
            });
        }

        const playerHistory = data.player_histories[playerId];

        if (!playerHistory) {
            return res.status(404).json({
                error: `No history found for player ${playerId}`
            });
        }

        res.json({
            last_updated: data.last_updated,
            gameweek: data.gameweek,
            player_id: playerId,
            history: playerHistory
        });
    } catch (error) {
        console.error('Error fetching player history:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/player-data/metadata
 * Returns metadata about the cached player data (last update time, status, etc.)
 */
router.get('/player-data/metadata', async (req, res) => {
    try {
        const metadata = await loadPlayerDataMetadata();

        if (!metadata) {
            return res.status(404).json({
                error: 'No player data metadata available',
                message: 'Player data fetch has not run yet'
            });
        }

        res.json(metadata);
    } catch (error) {
        console.error('Error fetching player data metadata:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/player-stats/recent
 * Returns pre-computed 5GW, 10GW, and season stats for all players
 * Updated every 10 minutes by the cronjob during live gameweeks
 */
router.get('/player-stats/recent', async (req, res) => {
    try {
        const stats = await loadPlayerRecentStats();

        if (!stats) {
            return res.status(404).json({
                error: 'No pre-computed stats available',
                message: 'Stats are generated during player data sync. Please wait for the next update.'
            });
        }

        // Add cache headers (5 minutes)
        res.set('Cache-Control', 'public, max-age=300');

        res.json(stats);
    } catch (error) {
        console.error('Error fetching player recent stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
