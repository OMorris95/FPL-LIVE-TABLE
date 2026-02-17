/**
 * Live Data Sync Service
 * Syncs live player stats during active gameweeks
 */
const prisma = require('./db');
const fetch = require('node-fetch');
const { HttpsProxyAgent } = require('https-proxy-agent');

const proxyAgent = process.env.PROXY_URL
  ? new HttpsProxyAgent(process.env.PROXY_URL)
  : null;

const FPL_API = 'https://fantasy.premierleague.com/api';

/**
 * Sync live data for a gameweek
 * @param {number} gameweekId - Gameweek number
 */
async function syncLiveData(gameweekId) {
  console.log(`[Live Sync] Fetching live data for GW${gameweekId}...`);

  const resp = await fetch(`${FPL_API}/event/${gameweekId}/live/`, {
    agent: proxyAgent,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
  });

  if (!resp.ok) throw new Error(`Live data fetch failed: ${resp.status}`);
  const data = await resp.json();

  const elements = data.elements || [];
  const fields = (el) => ({
    minutes: el.stats?.minutes || 0,
    totalPoints: el.stats?.total_points || 0,
    goalsScored: el.stats?.goals_scored || 0,
    assists: el.stats?.assists || 0,
    cleanSheets: el.stats?.clean_sheets || 0,
    goalsConceded: el.stats?.goals_conceded || 0,
    ownGoals: el.stats?.own_goals || 0,
    penaltiesSaved: el.stats?.penalties_saved || 0,
    penaltiesMissed: el.stats?.penalties_missed || 0,
    yellowCards: el.stats?.yellow_cards || 0,
    redCards: el.stats?.red_cards || 0,
    saves: el.stats?.saves || 0,
    bonus: el.stats?.bonus || 0,
    bps: el.stats?.bps || 0,
    explain: el.explain || [],
  });

  const ops = elements.map((el) =>
    prisma.livePlayerData.upsert({
      where: {
        playerId_gameweekId: { playerId: el.id, gameweekId },
      },
      update: { ...fields(el), lastUpdated: new Date() },
      create: { playerId: el.id, gameweekId, ...fields(el) },
    })
  );

  // Batch execute
  for (let i = 0; i < ops.length; i += 100) {
    await prisma.$transaction(ops.slice(i, i + 100));
  }

  // Also cache the raw response for the proxy
  const { setCache } = require('./cacheService');
  await setCache(`fpl:/event/${gameweekId}/live/`, data, 30 * 1000);

  console.log(`[Live Sync] Updated ${elements.length} players for GW${gameweekId}`);
}

module.exports = { syncLiveData };
