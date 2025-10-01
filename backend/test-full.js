/**
 * Full Test Script - Fetches all 10,000 managers (200 pages)
 * Takes ~3 hours with rate limiting
 * Production-quality data - same as cron job
 */

const { updateAllOwnership } = require('./cron/updateOwnership');

async function fullTest() {
    console.log('\n=== FULL TEST - 10,000 Managers ===');
    console.log('This will take approximately 3 hours with rate limiting');
    console.log('Progress will be logged every 100 managers');
    console.log('Press Ctrl+C to cancel\n');

    const startTime = Date.now();

    try {
        await updateAllOwnership();

        const endTime = Date.now();
        const duration = Math.round((endTime - startTime) / 1000 / 60); // minutes

        console.log('\n=== FULL TEST COMPLETED SUCCESSFULLY ===');
        console.log(`Total time: ${duration} minutes`);
        console.log('Files saved in backend/data/');
        console.log('- ownership_100_gwX.json');
        console.log('- ownership_1k_gwX.json');
        console.log('- ownership_10k_gwX.json');
        console.log('- last_update.json\n');

        process.exit(0);
    } catch (error) {
        console.error('\n=== FULL TEST FAILED ===');
        console.error(error);

        const endTime = Date.now();
        const duration = Math.round((endTime - startTime) / 1000 / 60);
        console.log(`Failed after ${duration} minutes\n`);

        process.exit(1);
    }
}

fullTest();
