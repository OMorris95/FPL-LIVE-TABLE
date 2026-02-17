/**
 * Manager Scrape Cron Job
 * Scrapes top 10k managers after GW deadline, then fetches picks + calculates ownership
 */
const cron = require('node-cron');
const prisma = require('../services/db');
const { scrapeTop10kManagerIds, scrapeManagerPicks } = require('../services/managerScraper');

/**
 * Log cron job execution
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
 * Check if this job already ran for the given gameweek
 */
async function hasRunForGameweek(jobName, gameweek) {
  const existing = await prisma.cronJobLog.findFirst({
    where: { jobName, gameweek, status: 'completed' },
  });
  return !!existing;
}

/**
 * Run the full manager scrape pipeline for a gameweek
 */
async function runManagerScrape(gameweek) {
  const jobName = 'manager_scrape';

  if (await hasRunForGameweek(jobName, gameweek)) {
    console.log(`[Manager Cron] Already ran for GW${gameweek}, skipping`);
    return;
  }

  try {
    await logCronJob(jobName, gameweek, 'started');

    // 1. Scrape manager IDs
    const managerIds = await scrapeTop10kManagerIds(10000);

    // 2. Scrape picks for current gameweek
    await scrapeManagerPicks(managerIds, gameweek);

    // Count records
    const pickCount = await prisma.managerPick.count({ where: { gameweekId: gameweek } });

    await logCronJob(jobName, gameweek, 'completed', pickCount);
    console.log(`[Manager Cron] GW${gameweek} complete. ${pickCount} picks stored.`);
  } catch (error) {
    console.error('[Manager Cron] Error:', error.message);
    await logCronJob(jobName, gameweek, 'failed', 0, error.message);
  }
}

// Schedule: every hour, check if we need to scrape
cron.schedule('0 * * * *', async () => {
  const current = await prisma.gameweek.findFirst({ where: { isCurrent: true } });
  if (!current) return;

  // Only run if GW deadline has passed (we're in the GW)
  if (new Date() > current.deadlineTime) {
    await runManagerScrape(current.fplId);
  }
});

console.log('[Manager Cron] Scheduled hourly check');

module.exports = { runManagerScrape };
