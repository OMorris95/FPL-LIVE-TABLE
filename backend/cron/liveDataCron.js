/**
 * Live Data Cron Job
 * Syncs live player stats every 30 seconds during active gameweeks
 */
const cron = require('node-cron');
const prisma = require('../services/db');
const { syncLiveData } = require('../services/liveDataSync');

let isRunning = false;

/**
 * Check if we're in a live gameweek (fixtures started but GW not finished)
 */
async function getLiveGameweek() {
  const current = await prisma.gameweek.findFirst({
    where: { isCurrent: true },
  });
  if (!current) return null;

  // GW is "live" if deadline has passed and it's not finished+data_checked
  const now = new Date();
  if (now > current.deadlineTime && !(current.finished && current.dataChecked)) {
    return current.fplId;
  }
  return null;
}

// Schedule: every 30 seconds
cron.schedule('*/30 * * * * *', async () => {
  if (isRunning) return; // Prevent overlapping runs

  const gwId = await getLiveGameweek();
  if (!gwId) return;

  isRunning = true;
  try {
    await syncLiveData(gwId);
  } catch (error) {
    console.error('[Live Cron] Error:', error.message);
  } finally {
    isRunning = false;
  }
});

console.log('[Live Cron] Scheduled every 30 seconds (active during live GW only)');

module.exports = {};
