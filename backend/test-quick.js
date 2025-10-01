/**
 * Quick Test Script - Fetches only 100 managers (2 pages)
 * Takes ~2 minutes instead of 3 hours
 * Perfect for testing during development
 */

const axios = require('axios');
const { calculateAllTierOwnership } = require('./services/ownershipCalculator');
const { saveOwnershipData, saveUpdateMetadata } = require('./services/dataStorage');

const FPL_API_BASE = 'https://fantasy.premierleague.com/api/';
const GLOBAL_LEAGUE_ID = 314;
const DELAY_MS = 1000;
const QUICK_TEST_PAGES = 2; // Only fetch 2 pages = 100 managers

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchFromFPL(endpoint) {
    try {
        const response = await axios.get(`${FPL_API_BASE}${endpoint}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error.message);
        throw error;
    }
}

async function quickTest() {
    console.log('\n=== QUICK TEST - 100 Managers Only ===');
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`This will take approximately 2 minutes\n`);

    try {
        // 1. Get bootstrap data and current gameweek
        console.log('Fetching bootstrap data...');
        const bootstrapData = await fetchFromFPL('bootstrap-static/');
        const currentEvent = bootstrapData.events.find(event => event.is_current);
        const currentGw = currentEvent ? currentEvent.id : bootstrapData.events.find(event => event.is_next)?.id;

        if (!currentGw) {
            console.error('Could not determine current gameweek');
            return;
        }

        console.log(`Current gameweek: ${currentGw}\n`);

        // 2. Fetch first 2 pages of league (100 managers)
        console.log(`Fetching ${QUICK_TEST_PAGES} pages of manager IDs...`);
        const managerIds = [];

        for (let page = 1; page <= QUICK_TEST_PAGES; page++) {
            console.log(`  Fetching page ${page}/${QUICK_TEST_PAGES}...`);
            const data = await fetchFromFPL(`leagues-classic/${GLOBAL_LEAGUE_ID}/standings/?page_standings=${page}`);
            data.standings.results.forEach(entry => managerIds.push(entry.entry));

            if (page < QUICK_TEST_PAGES) {
                await delay(DELAY_MS);
            }
        }

        console.log(`Fetched ${managerIds.length} manager IDs\n`);

        // 3. Fetch all manager picks
        console.log(`Fetching picks for ${managerIds.length} managers...`);
        const allPicks = [];

        for (let i = 0; i < managerIds.length; i++) {
            const managerId = managerIds[i];

            if ((i + 1) % 25 === 0) {
                console.log(`  Progress: ${i + 1}/${managerIds.length} managers...`);
            }

            try {
                const picks = await fetchFromFPL(`entry/${managerId}/event/${currentGw}/picks/`);
                if (picks && picks.picks) {
                    allPicks.push({ managerId, picks: picks.picks });
                }
            } catch (error) {
                console.error(`  Failed to fetch manager ${managerId}, skipping...`);
            }

            if (i < managerIds.length - 1) {
                await delay(DELAY_MS);
            }
        }

        console.log(`Successfully fetched picks for ${allPicks.length} managers\n`);

        // 4. Calculate ownership for all three tiers
        console.log('Calculating ownership for all tiers...');
        const ownershipData = calculateAllTierOwnership(allPicks);

        console.log(`  Top 100: ${ownershipData.top100.length} unique players`);
        console.log(`  Top 1k: Not enough data (need 1000 managers)`);
        console.log(`  Top 10k: Not enough data (need 10000 managers)`);
        console.log('  Note: Only top 100 is accurate in quick test\n');

        // 5. Save data with "_test" suffix
        console.log('Saving test data...');
        await saveOwnershipData('100_test', currentGw, ownershipData.top100);
        await saveOwnershipData('1k_test', currentGw, ownershipData.top1k);
        await saveOwnershipData('10k_test', currentGw, ownershipData.top10k);

        await saveUpdateMetadata(currentGw, 'success_test');

        console.log('\n=== QUICK TEST COMPLETED SUCCESSFULLY ===');
        console.log('Files saved in backend/data/ with "_test" suffix');
        console.log('Top 5 most owned players (Top 100):');
        ownershipData.top100.slice(0, 5).forEach((p, i) => {
            console.log(`  ${i + 1}. Player ID ${p.player_id}: ${p.ownership_percent}% (${p.ownership_count}/${allPicks.length})`);
        });
        console.log('\nRun test-full.js for production-quality data (takes 3 hours)\n');

        process.exit(0);
    } catch (error) {
        console.error('\n=== QUICK TEST FAILED ===');
        console.error(error);
        process.exit(1);
    }
}

quickTest();
