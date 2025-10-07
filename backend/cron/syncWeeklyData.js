const cron = require('node-cron');
const { syncWeeklyData, getLastStaticDataSync } = require('../services/weeklyDataSync');
const { getBootstrapData, getCurrentGameweek } = require('../services/fplDataFetcher');

/**
 * Smart weekly data sync
 * Checks hourly if we should sync (2-3 hours after gameweek deadline)
 * Only syncs once per gameweek
 */
cron.schedule('0 * * * *', async () => {
    try {
        console.log('Weekly sync check triggered');

        // Get current gameweek info
        const bootstrapData = await getBootstrapData();
        const currentEvent = bootstrapData.events.find(e => e.is_current);

        if (!currentEvent) {
            console.log('No current gameweek active - skipping sync');
            return;
        }

        const deadline = new Date(currentEvent.deadline_time);
        const now = new Date();
        const hoursSinceDeadline = (now - deadline) / (1000 * 60 * 60);

        // Only sync if 2-3 hours after deadline
        if (hoursSinceDeadline < 2 || hoursSinceDeadline >= 3) {
            // Not the right time window
            return;
        }

        // Check if we've already synced for this gameweek
        const lastSync = await getLastStaticDataSync();

        if (lastSync.gameweek === currentEvent.id) {
            console.log(`Already synced static data for GW${currentEvent.id}`);
            return;
        }

        // Trigger sync
        console.log(`\nTriggering weekly data sync for GW${currentEvent.id}`);
        console.log(`${hoursSinceDeadline.toFixed(1)} hours after deadline`);

        await syncWeeklyData(currentEvent.id);

    } catch (error) {
        console.error('Weekly sync cron failed:', error);
    }
});

console.log('Weekly data sync cron scheduled: Hourly check, syncs 2-3h after gameweek deadline');

// Export for manual triggering
module.exports = {
    triggerManualSync: async () => {
        const bootstrapData = await getBootstrapData();
        const currentGw = getCurrentGameweek(bootstrapData);
        console.log('Manual weekly sync triggered');
        await syncWeeklyData(currentGw);
    }
};
