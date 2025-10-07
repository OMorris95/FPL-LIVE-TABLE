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

/**
 * Smart ownership update cron
 * Checks hourly if we should pull ownership data
 * Triggers 1-2 hours after gameweek deadline for maximum freshness
 * Works for both Friday and Saturday gameweeks
 */
cron.schedule('0 * * * *', async () => {
    try {
        console.log('Ownership update check triggered');

        // Get current gameweek info
        const bootstrapData = await getBootstrapData();
        const currentEvent = bootstrapData.events.find(e => e.is_current);

        if (!currentEvent) {
            console.log('No current gameweek active - skipping ownership update');
            return;
        }

        const deadline = new Date(currentEvent.deadline_time);
        const now = new Date();
        const hoursSinceDeadline = (now - deadline) / (1000 * 60 * 60);

        // Pull ownership 1-2 hours after deadline
        if (hoursSinceDeadline < 1 || hoursSinceDeadline >= 2) {
            // Not the right time window
            return;
        }

        // Check if we've already pulled for this gameweek
        const fs = require('fs').promises;
        const path = require('path');
        const metadataPath = path.join(__dirname, '../data/update_metadata.json');

        let lastPullGw = null;
        try {
            const metaData = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
            lastPullGw = metaData.gameweek;
        } catch {
            // No metadata yet, proceed with pull
        }

        if (lastPullGw === currentEvent.id) {
            console.log(`Already pulled ownership for GW${currentEvent.id}`);
            return;
        }

        // Trigger ownership pull
        console.log(`\nTriggering ownership update for GW${currentEvent.id}`);
        console.log(`${hoursSinceDeadline.toFixed(1)} hours after deadline`);

        await updateAllOwnership();

    } catch (error) {
        console.error('Ownership update cron failed:', error);
    }
});

console.log('Ownership update cron scheduled: Hourly check, pulls 1-2h after gameweek deadline');
console.log('Works for both Friday and Saturday gameweeks');
console.log('Run manual update by calling triggerManualUpdate()');

// Export for manual triggering
module.exports = {
    updateAllOwnership,
    triggerManualUpdate
};
