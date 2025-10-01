const cron = require('node-cron');
const { getBootstrapData, getCurrentGameweek, getTop10kManagerIds, getAllManagerPicks } = require('../services/fplDataFetcher');
const { calculateAllTierOwnership } = require('../services/ownershipCalculator');
const { saveOwnershipData, saveUpdateMetadata } = require('../services/dataStorage');

/**
 * Main function to update ownership data for all tiers
 * Single fetch approach: fetch top 10k once, calculate all tiers from same data
 */
async function updateAllOwnership() {
    console.log('\n=== Starting ownership data update ===');
    console.log(`Timestamp: ${new Date().toISOString()}`);

    try {
        // 1. Get current gameweek
        const bootstrapData = await getBootstrapData();
        const currentGw = getCurrentGameweek(bootstrapData);

        if (!currentGw) {
            console.error('Could not determine current gameweek');
            return;
        }

        console.log(`Current gameweek: ${currentGw}`);

        // 2. Fetch top 10k manager IDs (pages 1-200 of global league)
        const managerIds = await getTop10kManagerIds();

        // 3. Fetch all manager picks for current gameweek
        const allManagerPicks = await getAllManagerPicks(managerIds, currentGw);

        // 4. Calculate ownership for all three tiers from the same dataset
        const ownershipData = calculateAllTierOwnership(allManagerPicks);

        // 5. Save all three tiers
        await saveOwnershipData('100', currentGw, ownershipData.top100);
        await saveOwnershipData('1k', currentGw, ownershipData.top1k);
        await saveOwnershipData('10k', currentGw, ownershipData.top10k);

        // 6. Save success metadata
        await saveUpdateMetadata(currentGw, 'success');

        console.log('=== Ownership data update completed successfully ===\n');
    } catch (error) {
        console.error('=== Error updating ownership data ===');
        console.error(error);

        // Save error metadata
        try {
            const bootstrapData = await getBootstrapData();
            const currentGw = getCurrentGameweek(bootstrapData);
            await saveUpdateMetadata(currentGw || 0, 'error', error);
        } catch (metaError) {
            console.error('Failed to save error metadata:', metaError);
        }

        console.log('=== Update failed ===\n');
    }
}

/**
 * Manual trigger function (can be called via API later)
 */
async function triggerManualUpdate() {
    console.log('Manual update triggered');
    await updateAllOwnership();
}

// Schedule cron job: Run every Saturday at 2:00 AM
// Cron format: minute hour day month weekday
// 0 2 * * 6 = At 02:00 on Saturday
cron.schedule('0 2 * * 6', async () => {
    console.log('Scheduled update triggered by cron');
    await updateAllOwnership();
});

console.log('Cron job scheduled: Every Saturday at 2:00 AM');
console.log('Run manual update by calling triggerManualUpdate()');

// Export for manual triggering
module.exports = {
    updateAllOwnership,
    triggerManualUpdate
};
