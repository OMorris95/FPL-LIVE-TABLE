const cron = require('node-cron');
const { trackTransfers, cleanupOldSnapshots } = require('../services/transferTracker');

/**
 * Track transfer deltas every 30 minutes
 * Cron expression: Every 30 minutes (0,30 * * * *)
 */
cron.schedule('*/30 * * * *', async () => {
    console.log('Transfer tracking cron triggered');
    try {
        await trackTransfers();
    } catch (error) {
        console.error('Transfer tracking cron failed:', error);
    }
});

/**
 * Cleanup old snapshots daily at 4 AM
 * Keep last 48 hours of data
 */
cron.schedule('0 4 * * *', async () => {
    console.log('Snapshot cleanup cron triggered');
    try {
        await cleanupOldSnapshots();
    } catch (error) {
        console.error('Snapshot cleanup failed:', error);
    }
});

console.log('Transfer tracking cron scheduled: Every 30 minutes');
console.log('Snapshot cleanup cron scheduled: Daily at 4 AM');

// Export for manual triggering
module.exports = {
    trackTransfers
};
