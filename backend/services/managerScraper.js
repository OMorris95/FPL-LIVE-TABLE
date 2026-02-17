/**
 * Manager Scraper Service
 * Scrapes top 10k managers from league 314 and fetches their picks
 */
const prisma = require('./db');
const fetch = require('node-fetch');
const { HttpsProxyAgent } = require('https-proxy-agent');

const proxyAgent = process.env.PROXY_URL
  ? new HttpsProxyAgent(process.env.PROXY_URL)
  : null;

const FPL_API = 'https://fantasy.premierleague.com/api';
const LEAGUE_ID = 314; // Overall league
const PAGE_SIZE = 50;
const PAGES_BATCH_SIZE = 20; // Fetch 20 pages in parallel
const PICKS_BATCH_SIZE = 50; // Fetch 50 managers' picks in parallel

/**
 * Fetch a single page of league standings
 */
async function fetchLeaguePage(page) {
  const resp = await fetch(
    `${FPL_API}/leagues-classic/${LEAGUE_ID}/standings/?page_standings=${page}`,
    {
      agent: proxyAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    }
  );
  if (!resp.ok) return null;
  return resp.json();
}

/**
 * Scrape top 10k manager IDs from league 314
 * @param {number} targetCount - Number of managers to scrape (default 10000)
 */
async function scrapeTop10kManagerIds(targetCount = 10000) {
  console.log(`[Manager Scraper] Scraping top ${targetCount} managers from league ${LEAGUE_ID}...`);

  const totalPages = Math.ceil(targetCount / PAGE_SIZE);
  const managers = [];

  // Fetch pages in batches
  for (let i = 1; i <= totalPages; i += PAGES_BATCH_SIZE) {
    const batch = [];
    for (let p = i; p <= Math.min(i + PAGES_BATCH_SIZE - 1, totalPages); p++) {
      batch.push(p);
    }

    const results = await Promise.all(
      batch.map(async (page) => {
        const data = await fetchLeaguePage(page);
        return data?.standings?.results || [];
      })
    );

    for (const entries of results) {
      for (const entry of entries) {
        managers.push({
          fplId: entry.entry,
          playerName: entry.player_name,
          teamName: entry.entry_name,
          overallPoints: entry.total,
          overallRank: entry.rank,
        });
      }
    }

    const batchEnd = Math.min(i + PAGES_BATCH_SIZE - 1, totalPages);
    console.log(`[Manager Scraper] Fetched pages ${i}-${batchEnd}/${totalPages} (${managers.length} managers)`);
  }

  // Upsert managers with tier flags
  const ops = managers.map((m) =>
    prisma.manager.upsert({
      where: { fplId: m.fplId },
      update: {
        playerName: m.playerName,
        teamName: m.teamName,
        overallPoints: m.overallPoints,
        overallRank: m.overallRank,
        isTop10k: m.overallRank <= 10000,
        isTop1k: m.overallRank <= 1000,
        isTop100: m.overallRank <= 100,
        lastUpdated: new Date(),
      },
      create: {
        fplId: m.fplId,
        playerName: m.playerName,
        teamName: m.teamName,
        overallPoints: m.overallPoints,
        overallRank: m.overallRank,
        isTop10k: m.overallRank <= 10000,
        isTop1k: m.overallRank <= 1000,
        isTop100: m.overallRank <= 100,
      },
    })
  );

  for (let i = 0; i < ops.length; i += 100) {
    await prisma.$transaction(ops.slice(i, i + 100));
  }

  console.log(`[Manager Scraper] Upserted ${managers.length} managers`);
  return managers.map((m) => m.fplId);
}

/**
 * Fetch picks for a single manager for a gameweek
 */
async function fetchManagerPicksFromAPI(managerId, gameweek) {
  const resp = await fetch(`${FPL_API}/entry/${managerId}/event/${gameweek}/picks/`, {
    agent: proxyAgent,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
  });
  if (!resp.ok) return null;
  return resp.json();
}

/**
 * Scrape picks for multiple managers for a specific gameweek
 * Stores ManagerPick and ManagerGameweek records
 * @param {number[]} managerIds - Array of manager entry IDs
 * @param {number} gameweek - Gameweek number
 */
async function scrapeManagerPicks(managerIds, gameweek) {
  console.log(`[Manager Scraper] Fetching GW${gameweek} picks for ${managerIds.length} managers...`);

  // Check which managers already have picks stored for this GW (immutable)
  const existing = await prisma.managerPick.findMany({
    where: { gameweekId: gameweek, managerId: { in: managerIds } },
    select: { managerId: true },
    distinct: ['managerId'],
  });
  const existingIds = new Set(existing.map((e) => e.managerId));
  const toFetch = managerIds.filter((id) => !existingIds.has(id));

  if (toFetch.length === 0) {
    console.log(`[Manager Scraper] All ${managerIds.length} managers already have GW${gameweek} picks cached`);
    return;
  }

  console.log(`[Manager Scraper] ${existingIds.size} already cached, fetching ${toFetch.length} remaining...`);

  let successCount = 0;
  let failCount = 0;

  // Fetch in batches
  for (let i = 0; i < toFetch.length; i += PICKS_BATCH_SIZE) {
    const batch = toFetch.slice(i, i + PICKS_BATCH_SIZE);

    const results = await Promise.all(
      batch.map(async (managerId) => {
        const data = await fetchManagerPicksFromAPI(managerId, gameweek);
        return { managerId, data };
      })
    );

    const pickOps = [];
    const gwOps = [];

    for (const { managerId, data } of results) {
      if (!data || !data.picks) {
        failCount++;
        continue;
      }
      successCount++;

      // Store manager gameweek data (entry_history)
      const eh = data.entry_history;
      if (eh) {
        gwOps.push(
          prisma.managerGameweek.upsert({
            where: { managerId_gameweekId: { managerId, gameweekId: gameweek } },
            update: {
              points: eh.points || 0,
              totalPoints: eh.total_points || 0,
              overallRank: eh.overall_rank || 0,
              rank: eh.rank,
              rankSort: eh.rank_sort,
              eventTransfers: eh.event_transfers || 0,
              eventTransfersCost: eh.event_transfers_cost || 0,
              value: eh.value || 0,
              bank: eh.bank || 0,
              activeChip: data.active_chip || null,
              pointsOnBench: eh.points_on_bench || 0,
            },
            create: {
              managerId,
              gameweekId: gameweek,
              points: eh.points || 0,
              totalPoints: eh.total_points || 0,
              overallRank: eh.overall_rank || 0,
              rank: eh.rank,
              rankSort: eh.rank_sort,
              eventTransfers: eh.event_transfers || 0,
              eventTransfersCost: eh.event_transfers_cost || 0,
              value: eh.value || 0,
              bank: eh.bank || 0,
              activeChip: data.active_chip || null,
              pointsOnBench: eh.points_on_bench || 0,
            },
          })
        );
      }

      // Store picks (15 per manager)
      for (const pick of data.picks) {
        pickOps.push(
          prisma.managerPick.upsert({
            where: {
              managerId_gameweekId_position: {
                managerId,
                gameweekId: gameweek,
                position: pick.position,
              },
            },
            update: {
              playerId: pick.element,
              isCaptain: pick.is_captain,
              isViceCaptain: pick.is_vice_captain,
              multiplier: pick.multiplier,
            },
            create: {
              managerId,
              gameweekId: gameweek,
              playerId: pick.element,
              position: pick.position,
              isCaptain: pick.is_captain,
              isViceCaptain: pick.is_vice_captain,
              multiplier: pick.multiplier,
            },
          })
        );
      }
    }

    // Execute batch
    if (gwOps.length > 0) {
      for (let j = 0; j < gwOps.length; j += 50) {
        await prisma.$transaction(gwOps.slice(j, j + 50));
      }
    }
    if (pickOps.length > 0) {
      for (let j = 0; j < pickOps.length; j += 100) {
        await prisma.$transaction(pickOps.slice(j, j + 100));
      }
    }

    const batchNum = Math.floor(i / PICKS_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(toFetch.length / PICKS_BATCH_SIZE);
    console.log(`[Manager Scraper] Picks batch ${batchNum}/${totalBatches}: ${batch.length} processed`);
  }

  console.log(`[Manager Scraper] GW${gameweek} picks complete. ${successCount} success, ${failCount} failed.`);
}

module.exports = { scrapeTop10kManagerIds, scrapeManagerPicks };
