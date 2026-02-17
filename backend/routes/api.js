const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { loadOwnershipData, getLatestOwnershipData, loadUpdateMetadata } = require('../services/dataStorage');
const { getBootstrapData, getCurrentGameweek } = require('../services/fplDataFetcher');
const { generatePredictions } = require('../services/pricePredictor');
const { loadCachedPlayerData, loadPlayerDataMetadata } = require('../services/playerDataFetcher');
const { loadPlayerRecentStats } = require('../services/playerStatsCalculator');
const { getCached, setCache, getTTLForPath } = require('../services/cacheService');

// Decodo rotating proxy agent (each request gets a new IP)
const proxyAgent = process.env.PROXY_URL
    ? new HttpsProxyAgent(process.env.PROXY_URL)
    : null;

if (proxyAgent) {
    console.log('[FPL Proxy] Using Decodo rotating proxy');
} else {
    console.log('[FPL Proxy] No proxy configured - using direct connection');
}

/**
 * POST /api/fpl/batch
 * Batch fetch multiple FPL API endpoints in parallel
 * Bypasses browser's 6-connection limit by making requests server-side
 */
router.post('/fpl/batch', async (req, res) => {
    const { urls } = req.body;

    if (!urls || !Array.isArray(urls)) {
        return res.status(400).json({ error: 'urls array required' });
    }

    try {
        const results = await Promise.all(
            urls.map(async (fplPath) => {
                const cacheKey = `fpl:${fplPath}`;

                // Check DB cache first
                const cached = await getCached(cacheKey);
                if (cached) {
                    return { data: cached };
                }

                // Cache miss - fetch from FPL API
                try {
                    const fplUrl = `https://fantasy.premierleague.com/api${fplPath}`;
                    const response = await fetch(fplUrl, {
                        agent: proxyAgent,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                            'Accept': 'application/json',
                        }
                    });

                    if (!response.ok) {
                        return { data: null, error: response.status };
                    }

                    const data = await response.json();

                    // Cache the result with smart TTL
                    const ttl = getTTLForPath(fplPath);
                    setCache(cacheKey, data, ttl);

                    return { data };
                } catch (err) {
                    return { data: null, error: err.message };
                }
            })
        );

        res.json(results);
    } catch (error) {
        console.error('[FPL Batch] Error:', error.message);
        res.status(500).json({ error: 'Batch request failed' });
    }
});

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
 * GET /api/fpl/*
 * Primary FPL API proxy using Decodo rotating proxy
 * Each request gets a different IP to avoid rate limiting
 */
router.get('/fpl/*', async (req, res) => {
    const fplPath = req.params[0];
    const cacheKey = `fpl:/${fplPath}`;

    // Check DB cache first
    const cached = await getCached(cacheKey);
    if (cached) {
        return res.json(cached);
    }

    // Cache miss - fetch from FPL API
    const fplUrl = `https://fantasy.premierleague.com/api/${fplPath}`;

    try {
        const response = await fetch(fplUrl, {
            agent: proxyAgent,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': 'application/json',
            }
        });

        if (!response.ok) {
            console.error(`[FPL Proxy] Error ${response.status} | ${fplPath}`);
            return res.status(response.status).json({
                error: `FPL API returned ${response.status}`
            });
        }

        const data = await response.json();

        // Cache with smart TTL
        const ttl = getTTLForPath(`/${fplPath}`);
        setCache(cacheKey, data, ttl);

        res.json(data);

    } catch (error) {
        console.error(`[FPL Proxy] Fetch error: ${error.message} | ${fplPath}`);
        res.status(500).json({ error: 'Failed to fetch from FPL API' });
    }
});

/**
 * GET /api/fpl-proxy/*
 * Legacy proxy route - kept for backwards compatibility
 */
router.get('/fpl-proxy/*', async (req, res) => {
    const fplPath = req.params[0];
    const fplUrl = `https://fantasy.premierleague.com/api/${fplPath}`;
    const userIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    console.log(`[FALLBACK PROXY] ${new Date().toISOString()} | IP: ${userIP} | Path: ${fplPath}`);

    try {
        const response = await fetch(fplUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
                'Accept': 'application/json',
            }
        });

        if (!response.ok) {
            console.error(`[FALLBACK ERROR] FPL API returned ${response.status} | Path: ${fplPath}`);
            return res.status(response.status).json({
                error: `FPL API returned ${response.status}`
            });
        }
        
        const data = await response.json();
        console.log(`[FALLBACK SUCCESS] Status: ${response.status} | Path: ${fplPath}`);
        res.json(data);

    } catch (error) {
        console.error(`[FALLBACK FETCH ERROR] ${error.message} | Path: ${fplPath}`);
        res.status(500).json({ error: 'Failed to fetch from FPL API' });
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

// =====================================================
// NEW DB-BACKED ENDPOINTS
// =====================================================

const prisma = require('../services/db');

/**
 * GET /api/team-stats
 * Returns TeamSeasonStats for all 20 teams (all 3 splits)
 */
router.get('/team-stats', async (req, res) => {
    try {
        const stats = await prisma.teamSeasonStats.findMany({
            include: { team: { select: { name: true, shortName: true, fplId: true } } },
            orderBy: [{ points: 'desc' }],
        });

        if (!stats.length) {
            return res.status(404).json({ error: 'No team stats available yet. Data is syncing.' });
        }

        res.set('Cache-Control', 'public, max-age=300');
        res.json(stats);
    } catch (error) {
        console.error('Error fetching team stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/team-stats/chart
 * Returns TeamGameweekStats for cumulative chart data
 * Optional query: ?teamId=1&split=overall
 */
router.get('/team-stats/chart', async (req, res) => {
    try {
        const where = {};
        if (req.query.teamId) where.teamId = parseInt(req.query.teamId);
        if (req.query.split) where.split = req.query.split;

        const stats = await prisma.teamGameweekStats.findMany({
            where,
            include: { team: { select: { name: true, shortName: true, fplId: true } } },
            orderBy: [{ teamId: 'asc' }, { gameweek: 'asc' }],
        });

        res.set('Cache-Control', 'public, max-age=300');
        res.json(stats);
    } catch (error) {
        console.error('Error fetching team chart stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/db/picks/:managerId/:gameweek
 * Serves manager picks from DB. Falls back to FPL API + caches if not found.
 */
router.get('/db/picks/:managerId/:gameweek', async (req, res) => {
    const managerId = parseInt(req.params.managerId);
    const gameweek = parseInt(req.params.gameweek);
    if (isNaN(managerId) || isNaN(gameweek)) {
        return res.status(400).json({ error: 'Invalid managerId or gameweek' });
    }

    try {
        // Check DB first
        const picks = await prisma.managerPick.findMany({
            where: { managerId, gameweekId: gameweek },
            orderBy: { position: 'asc' },
        });

        const gwData = await prisma.managerGameweek.findUnique({
            where: { managerId_gameweekId: { managerId, gameweekId: gameweek } },
        });

        if (picks.length > 0) {
            // Serve from DB - format to match FPL API shape
            res.set('Cache-Control', 'public, max-age=300');
            return res.json({
                active_chip: gwData?.activeChip || null,
                entry_history: gwData ? {
                    event: gwData.gameweekId,
                    points: gwData.points,
                    total_points: gwData.totalPoints,
                    overall_rank: gwData.overallRank,
                    rank: gwData.rank,
                    rank_sort: gwData.rankSort,
                    event_transfers: gwData.eventTransfers,
                    event_transfers_cost: gwData.eventTransfersCost,
                    value: gwData.value,
                    bank: gwData.bank,
                    points_on_bench: gwData.pointsOnBench,
                } : null,
                picks: picks.map(p => ({
                    element: p.playerId,
                    position: p.position,
                    multiplier: p.multiplier,
                    is_captain: p.isCaptain,
                    is_vice_captain: p.isViceCaptain,
                })),
            });
        }

        // Not in DB - fetch from FPL API, store, and return
        const fplUrl = `https://fantasy.premierleague.com/api/entry/${managerId}/event/${gameweek}/picks/`;
        const response = await fetch(fplUrl, {
            agent: proxyAgent,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: `FPL API returned ${response.status}` });
        }

        const data = await response.json();

        // Store in DB for future requests (fire and forget)
        const storeOps = [];

        // Ensure manager exists
        storeOps.push(prisma.manager.upsert({
            where: { fplId: managerId },
            update: {},
            create: { fplId: managerId, playerName: 'Unknown' },
        }));

        if (data.entry_history) {
            storeOps.push(prisma.managerGameweek.upsert({
                where: { managerId_gameweekId: { managerId, gameweekId: gameweek } },
                update: {
                    points: data.entry_history.points || 0,
                    totalPoints: data.entry_history.total_points || 0,
                    overallRank: data.entry_history.overall_rank || 0,
                    rank: data.entry_history.rank,
                    rankSort: data.entry_history.rank_sort,
                    eventTransfers: data.entry_history.event_transfers || 0,
                    eventTransfersCost: data.entry_history.event_transfers_cost || 0,
                    value: data.entry_history.value || 0,
                    bank: data.entry_history.bank || 0,
                    activeChip: data.active_chip || null,
                    pointsOnBench: data.entry_history.points_on_bench || 0,
                },
                create: {
                    managerId,
                    gameweekId: gameweek,
                    points: data.entry_history.points || 0,
                    totalPoints: data.entry_history.total_points || 0,
                    overallRank: data.entry_history.overall_rank || 0,
                    rank: data.entry_history.rank,
                    rankSort: data.entry_history.rank_sort,
                    eventTransfers: data.entry_history.event_transfers || 0,
                    eventTransfersCost: data.entry_history.event_transfers_cost || 0,
                    value: data.entry_history.value || 0,
                    bank: data.entry_history.bank || 0,
                    activeChip: data.active_chip || null,
                    pointsOnBench: data.entry_history.points_on_bench || 0,
                },
            }));
        }

        for (const pick of (data.picks || [])) {
            storeOps.push(prisma.managerPick.upsert({
                where: {
                    managerId_gameweekId_position: { managerId, gameweekId: gameweek, position: pick.position },
                },
                update: {
                    playerId: pick.element,
                    isCaptain: pick.is_captain,
                    isViceCaptain: pick.is_vice_captain,
                    multiplier: pick.multiplier,
                },
                create: {
                    managerId,
                    gameweekId: gameweek,
                    playerId: pick.element,
                    position: pick.position,
                    isCaptain: pick.is_captain,
                    isViceCaptain: pick.is_vice_captain,
                    multiplier: pick.multiplier,
                },
            }));
        }

        // Store async - don't block response
        prisma.$transaction(storeOps).catch(e => console.error('[DB Picks] Store error:', e.message));

        res.json(data);
    } catch (error) {
        console.error(`Error fetching picks for ${managerId} GW${gameweek}:`, error.message);
        res.status(500).json({ error: 'Failed to fetch picks' });
    }
});

/**
 * GET /api/manager-stats/:managerId
 * On-demand: fetches, computes, and caches advanced manager stats
 */
const { getManagerStats } = require('../services/managerStatsService');

router.get('/manager-stats/:managerId', async (req, res) => {
    const managerId = parseInt(req.params.managerId);
    if (isNaN(managerId)) {
        return res.status(400).json({ error: 'Invalid manager ID' });
    }

    try {
        const stats = await getManagerStats(managerId);
        res.set('Cache-Control', 'public, max-age=60');
        res.json(stats);
    } catch (error) {
        console.error(`Error computing manager stats for ${managerId}:`, error.message);
        res.status(500).json({ error: 'Failed to compute manager stats' });
    }
});

/**
 * GET /api/db/ownership/:tier/latest
 * DB-backed ownership data (replaces file-based)
 */
const { getLatestOwnership, getOwnership } = require('../services/ownershipService');

router.get('/db/ownership/:tier/latest', async (req, res) => {
    try {
        const { tier } = req.params;
        if (!['100', '1k', '10k'].includes(tier)) {
            return res.status(400).json({ error: 'Invalid tier. Must be 100, 1k, or 10k' });
        }

        const current = await prisma.gameweek.findFirst({ where: { isCurrent: true } });
        if (!current) {
            return res.status(404).json({ error: 'No current gameweek found' });
        }

        const data = await getLatestOwnership(tier, current.fplId);
        if (!data) {
            return res.status(404).json({ error: `No ownership data found for tier ${tier}` });
        }

        res.set('Cache-Control', 'public, max-age=300');
        res.json(data);
    } catch (error) {
        console.error('Error fetching DB ownership:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/db/ownership/:tier/:gameweek
 * DB-backed ownership data for specific GW
 */
router.get('/db/ownership/:tier/:gameweek', async (req, res) => {
    try {
        const { tier, gameweek } = req.params;
        if (!['100', '1k', '10k'].includes(tier)) {
            return res.status(400).json({ error: 'Invalid tier. Must be 100, 1k, or 10k' });
        }

        const gw = parseInt(gameweek);
        if (isNaN(gw) || gw < 1 || gw > 38) {
            return res.status(400).json({ error: 'Invalid gameweek' });
        }

        const data = await getOwnership(tier, gw);
        if (!data || data.length === 0) {
            return res.status(404).json({ error: `No ownership data found for tier ${tier}, GW ${gw}` });
        }

        res.set('Cache-Control', 'public, max-age=300');
        res.json(data);
    } catch (error) {
        console.error('Error fetching DB ownership:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/db/player-stats
 * DB-backed player computed stats (per-90, rolling averages)
 */
router.get('/db/player-stats', async (req, res) => {
    try {
        const stats = await prisma.playerComputedStats.findMany({
            include: {
                player: {
                    select: {
                        fplId: true, webName: true, elementType: true,
                        teamId: true, nowCost: true, totalPoints: true,
                        minutes: true, form: true,
                    },
                },
            },
            orderBy: { ppg: 'desc' },
        });

        res.set('Cache-Control', 'public, max-age=300');
        res.json(stats);
    } catch (error) {
        console.error('Error fetching player computed stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
