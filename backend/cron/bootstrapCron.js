/**
 * Bootstrap Cron Job
 * Syncs bootstrap data, fixtures, and team stats on schedule
 * - Every 6h normally
 * - Every 10 min during live gameweek
 */
const cron = require('node-cron');
const prisma = require('../services/db');
const { syncBootstrap } = require('../services/bootstrapSync');
const { syncFixtures } = require('../services/fixtureSync');
const { computeTeamStats, computeTeamGameweekStats } = require('../services/teamStatsService');

/**
 * Log a cron job execution to the CronJobLog table
 */
async function logCronJob(jobName, gameweek, status, recordsProcessed = 0, errorMessage = null) {
  try {
    await prisma.cronJobLog.create({
      data: {
        jobName,
        gameweek,
        status,
        recordsProcessed,
        errorMessage,
        completedAt: status !== 'started' ? new Date() : null,
      },
    });
  } catch (e) {
    console.error(`[CronLog] Failed to log ${jobName}:`, e.message);
  }
}

/**
 * Check if we're in a live gameweek (started but not finished + data_checked)
 */
async function isLiveGameweek() {
  const current = await prisma.gameweek.findFirst({
    where: { isCurrent: true },
  });
  if (!current) return false;
  return !current.finished || !current.dataChecked;
}

/**
 * Run the full bootstrap sync pipeline
 */
async function runBootstrapSync() {
  const jobName = 'bootstrap_sync';
  let gw = null;

  try {
    await logCronJob(jobName, gw, 'started');

    // 1. Sync bootstrap (teams, players, gameweeks)
    await syncBootstrap();

    // Get current GW for logging
    const current = await prisma.gameweek.findFirst({ where: { isCurrent: true } });
    gw = current?.fplId || null;

    // 2. Sync fixtures
    await syncFixtures();

    // 3. Compute team stats
    await computeTeamStats();
    await computeTeamGameweekStats();

    // Count records
    const counts = {
      teams: await prisma.team.count(),
      players: await prisma.player.count(),
      gameweeks: await prisma.gameweek.count(),
      fixtures: await prisma.fixture.count(),
      teamSeasonStats: await prisma.teamSeasonStats.count(),
    };
    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    await logCronJob(jobName, gw, 'completed', total);
    console.log(`[Bootstrap Cron] Complete. Counts:`, counts);
  } catch (error) {
    console.error('[Bootstrap Cron] Error:', error.message);
    await logCronJob(jobName, gw, 'failed', 0, error.message);
  }
}

// Schedule: every 6 hours
cron.schedule('0 */6 * * *', async () => {
  console.log('[Bootstrap Cron] Running scheduled 6h sync...');
  await runBootstrapSync();
});

// Schedule: every 10 min (only runs if live GW)
cron.schedule('*/10 * * * *', async () => {
  const live = await isLiveGameweek();
  if (live) {
    console.log('[Bootstrap Cron] Live GW detected, running 10-min sync...');
    await runBootstrapSync();
  }
});

// Run immediately on startup
console.log('[Bootstrap Cron] Running initial sync...');
runBootstrapSync();

module.exports = { runBootstrapSync };
