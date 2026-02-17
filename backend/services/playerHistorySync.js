/**
 * Player History Sync Service
 * Fetches element-summary for all players and stores per-GW stats (xG, xA, xGC etc.)
 */
const prisma = require('./db');
const fetch = require('node-fetch');
const { HttpsProxyAgent } = require('https-proxy-agent');

const proxyAgent = process.env.PROXY_URL
  ? new HttpsProxyAgent(process.env.PROXY_URL)
  : null;

const FPL_API = 'https://fantasy.premierleague.com/api';
const BATCH_SIZE = 50;

/**
 * Fetch a single player's element-summary
 */
async function fetchPlayerSummary(playerId) {
  const resp = await fetch(`${FPL_API}/element-summary/${playerId}/`, {
    agent: proxyAgent,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
  });
  if (!resp.ok) return null;
  return resp.json();
}

/**
 * Sync all player histories into PlayerGameweekStats table
 * Fetches in parallel batches of BATCH_SIZE via proxy
 */
async function syncAllPlayerHistories() {
  console.log('[Player History] Starting sync...');

  // Get all players with minutes > 0 (skip players who haven't played)
  const players = await prisma.player.findMany({
    where: { minutes: { gt: 0 } },
    select: { fplId: true },
    orderBy: { fplId: 'asc' },
  });

  console.log(`[Player History] Fetching summaries for ${players.length} players (batch size: ${BATCH_SIZE})...`);

  let totalStatsInserted = 0;
  let failedPlayers = 0;

  // Process in batches
  for (let i = 0; i < players.length; i += BATCH_SIZE) {
    const batch = players.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(players.length / BATCH_SIZE);

    const results = await Promise.all(
      batch.map(async (p) => {
        try {
          const data = await fetchPlayerSummary(p.fplId);
          return { playerId: p.fplId, data };
        } catch (e) {
          return { playerId: p.fplId, data: null };
        }
      })
    );

    // Process results and upsert into DB
    const ops = [];
    for (const { playerId, data } of results) {
      if (!data || !data.history) {
        failedPlayers++;
        continue;
      }

      for (const h of data.history) {
        ops.push(
          prisma.playerGameweekStats.upsert({
            where: {
              playerId_gameweek: { playerId, gameweek: h.round },
            },
            update: {
              opponentTeamId: h.opponent_team,
              wasHome: h.was_home,
              kickoffTime: h.kickoff_time ? new Date(h.kickoff_time) : null,
              minutes: h.minutes || 0,
              totalPoints: h.total_points || 0,
              goalsScored: h.goals_scored || 0,
              assists: h.assists || 0,
              cleanSheets: h.clean_sheets || 0,
              goalsConceded: h.goals_conceded || 0,
              ownGoals: h.own_goals || 0,
              penaltiesSaved: h.penalties_saved || 0,
              penaltiesMissed: h.penalties_missed || 0,
              yellowCards: h.yellow_cards || 0,
              redCards: h.red_cards || 0,
              saves: h.saves || 0,
              bonus: h.bonus || 0,
              bps: h.bps || 0,
              influence: h.influence || '0',
              creativity: h.creativity || '0',
              threat: h.threat || '0',
              ictIndex: h.ict_index || '0',
              expectedGoals: h.expected_goals || '0',
              expectedAssists: h.expected_assists || '0',
              expectedGoalInvolvements: h.expected_goal_involvements || '0',
              expectedGoalsConceded: h.expected_goals_conceded || '0',
              value: h.value || 0,
              selected: h.selected || 0,
            },
            create: {
              playerId,
              gameweek: h.round,
              opponentTeamId: h.opponent_team,
              wasHome: h.was_home,
              kickoffTime: h.kickoff_time ? new Date(h.kickoff_time) : null,
              minutes: h.minutes || 0,
              totalPoints: h.total_points || 0,
              goalsScored: h.goals_scored || 0,
              assists: h.assists || 0,
              cleanSheets: h.clean_sheets || 0,
              goalsConceded: h.goals_conceded || 0,
              ownGoals: h.own_goals || 0,
              penaltiesSaved: h.penalties_saved || 0,
              penaltiesMissed: h.penalties_missed || 0,
              yellowCards: h.yellow_cards || 0,
              redCards: h.red_cards || 0,
              saves: h.saves || 0,
              bonus: h.bonus || 0,
              bps: h.bps || 0,
              influence: h.influence || '0',
              creativity: h.creativity || '0',
              threat: h.threat || '0',
              ictIndex: h.ict_index || '0',
              expectedGoals: h.expected_goals || '0',
              expectedAssists: h.expected_assists || '0',
              expectedGoalInvolvements: h.expected_goal_involvements || '0',
              expectedGoalsConceded: h.expected_goals_conceded || '0',
              value: h.value || 0,
              selected: h.selected || 0,
            },
          })
        );
      }
    }

    // Execute in transaction chunks
    for (let j = 0; j < ops.length; j += 100) {
      await prisma.$transaction(ops.slice(j, j + 100));
    }
    totalStatsInserted += ops.length;

    console.log(`[Player History] Batch ${batchNum}/${totalBatches}: ${ops.length} stats upserted`);
  }

  console.log(`[Player History] Complete. ${totalStatsInserted} total stats. ${failedPlayers} players failed.`);
  return totalStatsInserted;
}

module.exports = { syncAllPlayerHistories };
