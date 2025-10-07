const fs = require('fs').promises;
const path = require('path');
const { getBootstrapData } = require('./fplDataFetcher');
const axios = require('axios');

const FPL_API_BASE = 'https://fantasy.premierleague.com/api/';
const DATA_DIR = path.join(__dirname, '../data');
const FIXTURES_PATH = path.join(DATA_DIR, 'fixtures.json');
const DGW_INFO_PATH = path.join(DATA_DIR, 'dgw_info.json');
const GAMEWEEK_META_PATH = path.join(DATA_DIR, 'gameweek_meta.json');
const TEAM_STANDINGS_PATH = path.join(DATA_DIR, 'team_standings.json');
const SYNC_META_PATH = path.join(DATA_DIR, 'static_sync_meta.json');

/**
 * Ensures data directory exists
 */
async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
}

/**
 * Fetches fixtures from FPL API
 */
async function fetchFixtures() {
    try {
        const response = await axios.get(`${FPL_API_BASE}fixtures/`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching fixtures:', error.message);
        throw error;
    }
}

/**
 * Analyzes fixtures to identify double gameweeks and blank gameweeks
 * Returns object with DGW info per gameweek
 */
function analyzeDoubleGameweeks(fixtures) {
    console.log('Analyzing fixtures for DGWs/BGWs...');

    const gameweekFixtures = {};

    // Count fixtures per team per gameweek
    fixtures.forEach(fixture => {
        if (!fixture.event) return; // Skip unscheduled fixtures

        const gw = fixture.event;
        if (!gameweekFixtures[gw]) {
            gameweekFixtures[gw] = {
                fixtures: [],
                teamFixtureCounts: {}
            };
        }

        // Count fixtures for each team
        gameweekFixtures[gw].teamFixtureCounts[fixture.team_h] =
            (gameweekFixtures[gw].teamFixtureCounts[fixture.team_h] || 0) + 1;
        gameweekFixtures[gw].teamFixtureCounts[fixture.team_a] =
            (gameweekFixtures[gw].teamFixtureCounts[fixture.team_a] || 0) + 1;

        gameweekFixtures[gw].fixtures.push({
            id: fixture.code,
            team_h: fixture.team_h,
            team_a: fixture.team_a,
            kickoff_time: fixture.kickoff_time,
            finished: fixture.finished
        });
    });

    // Analyze each gameweek
    const dgwInfo = {};
    Object.keys(gameweekFixtures).forEach(gw => {
        const gwData = gameweekFixtures[gw];

        // Find teams with multiple fixtures (DGW)
        const teamsWithDoubles = [];
        const teamsWithNoFixtures = [];

        Object.entries(gwData.teamFixtureCounts).forEach(([teamId, count]) => {
            if (count >= 2) {
                teamsWithDoubles.push(parseInt(teamId));
            }
        });

        // Check for blank gameweek (very few fixtures scheduled)
        const isBGW = gwData.fixtures.length < 5;

        dgwInfo[gw] = {
            gameweek: parseInt(gw),
            isDGW: teamsWithDoubles.length > 0,
            isBGW: isBGW,
            teamsWithDoubles: teamsWithDoubles,
            totalFixtures: gwData.fixtures.length,
            fixtureDetails: gwData.fixtures
        };

        if (teamsWithDoubles.length > 0) {
            console.log(`  GW${gw}: DGW detected - ${teamsWithDoubles.length} teams with doubles`);
        }
        if (isBGW) {
            console.log(`  GW${gw}: BGW detected - only ${gwData.fixtures.length} fixtures`);
        }
    });

    return dgwInfo;
}

/**
 * Saves fixtures data to file
 */
async function saveFixtures(fixtures) {
    await ensureDataDir();
    await fs.writeFile(FIXTURES_PATH, JSON.stringify(fixtures, null, 2));
    console.log(`Saved ${fixtures.length} fixtures to ${FIXTURES_PATH}`);
}

/**
 * Saves DGW analysis to file
 */
async function saveDGWInfo(dgwInfo) {
    await ensureDataDir();
    await fs.writeFile(DGW_INFO_PATH, JSON.stringify(dgwInfo, null, 2));

    const dgwCount = Object.values(dgwInfo).filter(gw => gw.isDGW).length;
    const bgwCount = Object.values(dgwInfo).filter(gw => gw.isBGW).length;
    console.log(`Saved DGW info: ${dgwCount} DGWs, ${bgwCount} BGWs identified`);
}

/**
 * Saves gameweek metadata (deadlines, chip plays, etc.)
 */
async function saveGameweekInfo(events) {
    await ensureDataDir();

    const gameweekMeta = events.map(event => ({
        id: event.id,
        name: event.name,
        deadline_time: event.deadline_time,
        deadline_time_epoch: event.deadline_time_epoch,
        is_current: event.is_current,
        is_next: event.is_next,
        finished: event.finished,
        average_entry_score: event.average_entry_score,
        highest_scoring_entry: event.highest_scoring_entry,
        most_captained: event.most_captained,
        most_transferred_in: event.most_transferred_in,
        most_vice_captained: event.most_vice_captained,
        top_element: event.top_element,
        top_element_info: event.top_element_info,
        chip_plays: event.chip_plays
    }));

    await fs.writeFile(GAMEWEEK_META_PATH, JSON.stringify(gameweekMeta, null, 2));
    console.log(`Saved metadata for ${gameweekMeta.length} gameweeks`);
}

/**
 * Saves team standings (league table positions, form, etc.)
 */
async function saveTeamStandings(teams) {
    await ensureDataDir();
    await fs.writeFile(TEAM_STANDINGS_PATH, JSON.stringify(teams, null, 2));
    console.log(`Saved standings for ${teams.length} teams`);
}

/**
 * Gets last sync metadata
 */
async function getLastStaticDataSync() {
    try {
        const data = await fs.readFile(SYNC_META_PATH, 'utf8');
        return JSON.parse(data);
    } catch {
        return { gameweek: null, timestamp: null };
    }
}

/**
 * Saves sync metadata
 */
async function saveStaticDataSyncMetadata(gameweek) {
    await ensureDataDir();
    const metadata = {
        gameweek,
        timestamp: new Date().toISOString(),
        status: 'success'
    };
    await fs.writeFile(SYNC_META_PATH, JSON.stringify(metadata, null, 2));
    console.log(`Sync metadata saved for GW${gameweek}`);
}

/**
 * Loads DGW info from file
 */
async function loadDGWInfo() {
    try {
        const data = await fs.readFile(DGW_INFO_PATH, 'utf8');
        return JSON.parse(data);
    } catch {
        return {};
    }
}

/**
 * Loads fixtures from file
 */
async function loadFixtures() {
    try {
        const data = await fs.readFile(FIXTURES_PATH, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

/**
 * Main sync function - fetches and saves all weekly static data
 */
async function syncWeeklyData(currentGameweek) {
    console.log('\n=== Starting Weekly Static Data Sync ===');
    console.log(`Gameweek: ${currentGameweek}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);

    try {
        // 1. Fetch bootstrap data (teams, events, etc.)
        const bootstrapData = await getBootstrapData();

        // 2. Fetch fixtures
        const fixtures = await fetchFixtures();
        await saveFixtures(fixtures);

        // 3. Analyze and save DGW info
        const dgwInfo = analyzeDoubleGameweeks(fixtures);
        await saveDGWInfo(dgwInfo);

        // 4. Save gameweek metadata
        await saveGameweekInfo(bootstrapData.events);

        // 5. Save team standings
        await saveTeamStandings(bootstrapData.teams);

        // 6. Save sync completion metadata
        await saveStaticDataSyncMetadata(currentGameweek);

        console.log('=== Weekly Static Data Sync Complete ===\n');
        return true;
    } catch (error) {
        console.error('=== Weekly Static Data Sync Failed ===');
        console.error(error);
        throw error;
    }
}

module.exports = {
    syncWeeklyData,
    getLastStaticDataSync,
    loadDGWInfo,
    loadFixtures,
    analyzeDoubleGameweeks
};
