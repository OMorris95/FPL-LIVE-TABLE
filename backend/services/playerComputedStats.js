/**
 * Player Computed Stats Service
 * Calculates per-90, rolling averages, and PPG from PlayerGameweekStats
 */
const prisma = require('./db');

/**
 * Compute stats for all players with gameweek data
 */
async function computePlayerStats() {
  console.log('[Player Stats] Computing...');

  // Get all distinct player IDs from gameweek stats
  const playerIds = await prisma.playerGameweekStats.findMany({
    select: { playerId: true },
    distinct: ['playerId'],
  });

  let count = 0;
  const ops = [];

  for (const { playerId } of playerIds) {
    // Get all GW stats for this player, ordered by gameweek
    const stats = await prisma.playerGameweekStats.findMany({
      where: { playerId },
      orderBy: { gameweek: 'asc' },
    });

    if (stats.length === 0) continue;

    // Total minutes
    const totalMinutes = stats.reduce((s, g) => s + g.minutes, 0);
    const totalPoints = stats.reduce((s, g) => s + g.totalPoints, 0);
    const totalGoals = stats.reduce((s, g) => s + g.goalsScored, 0);
    const totalAssists = stats.reduce((s, g) => s + g.assists, 0);
    const totalXG = stats.reduce((s, g) => s + parseFloat(g.expectedGoals || '0'), 0);
    const totalXA = stats.reduce((s, g) => s + parseFloat(g.expectedAssists || '0'), 0);
    const totalXGI = stats.reduce((s, g) => s + parseFloat(g.expectedGoalInvolvements || '0'), 0);

    // Per-90 (only if they have enough minutes)
    const per90 = (stat) => totalMinutes > 0 ? (stat / totalMinutes) * 90 : 0;

    // Games played (minutes > 0)
    const gamesPlayed = stats.filter(g => g.minutes > 0).length;

    // Rolling averages (last N gameweeks)
    const last5 = stats.slice(-5);
    const last10 = stats.slice(-10);

    const avg = (arr, field) => {
      if (arr.length === 0) return 0;
      if (typeof arr[0][field] === 'string') {
        return arr.reduce((s, g) => s + parseFloat(g[field] || '0'), 0) / arr.length;
      }
      return arr.reduce((s, g) => s + (g[field] || 0), 0) / arr.length;
    };

    const round2 = (n) => Math.round(n * 100) / 100;

    ops.push(
      prisma.playerComputedStats.upsert({
        where: { playerId },
        update: {
          pointsPer90: round2(per90(totalPoints)),
          goalsPer90: round2(per90(totalGoals)),
          assistsPer90: round2(per90(totalAssists)),
          xGPer90: round2(per90(totalXG)),
          xAPer90: round2(per90(totalXA)),
          xGIPer90: round2(per90(totalXGI)),
          avg5gwPoints: round2(avg(last5, 'totalPoints')),
          avg5gwMinutes: round2(avg(last5, 'minutes')),
          avg5gwXGI: round2(avg(last5, 'expectedGoalInvolvements')),
          avg10gwPoints: round2(avg(last10, 'totalPoints')),
          avg10gwMinutes: round2(avg(last10, 'minutes')),
          avg10gwXGI: round2(avg(last10, 'expectedGoalInvolvements')),
          ppg: gamesPlayed > 0 ? round2(totalPoints / gamesPlayed) : 0,
          gamesPlayed,
          lastUpdated: new Date(),
        },
        create: {
          playerId,
          pointsPer90: round2(per90(totalPoints)),
          goalsPer90: round2(per90(totalGoals)),
          assistsPer90: round2(per90(totalAssists)),
          xGPer90: round2(per90(totalXG)),
          xAPer90: round2(per90(totalXA)),
          xGIPer90: round2(per90(totalXGI)),
          avg5gwPoints: round2(avg(last5, 'totalPoints')),
          avg5gwMinutes: round2(avg(last5, 'minutes')),
          avg5gwXGI: round2(avg(last5, 'expectedGoalInvolvements')),
          avg10gwPoints: round2(avg(last10, 'totalPoints')),
          avg10gwMinutes: round2(avg(last10, 'minutes')),
          avg10gwXGI: round2(avg(last10, 'expectedGoalInvolvements')),
          ppg: gamesPlayed > 0 ? round2(totalPoints / gamesPlayed) : 0,
          gamesPlayed,
        },
      })
    );
    count++;
  }

  // Batch execute
  for (let i = 0; i < ops.length; i += 100) {
    await prisma.$transaction(ops.slice(i, i + 100));
  }

  console.log(`[Player Stats] Computed stats for ${count} players`);
}

module.exports = { computePlayerStats };
