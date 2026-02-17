/**
 * Manager Stats Service (On-Demand)
 * Fetches and computes advanced stats for a visiting manager, then caches in DB.
 * Stats: captain ROI, bench waste, luck meter, transfer ROI, points by position
 */
const prisma = require('./db');
const fetch = require('node-fetch');
const { HttpsProxyAgent } = require('https-proxy-agent');

const proxyAgent = process.env.PROXY_URL
  ? new HttpsProxyAgent(process.env.PROXY_URL)
  : null;

const FPL_API = 'https://fantasy.premierleague.com/api';
const STATS_TTL_MS = 10 * 60 * 1000; // 10 min cache

/**
 * Fetch data from FPL API
 */
async function fplFetch(path) {
  const resp = await fetch(`${FPL_API}${path}`, {
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
 * Ensure manager exists in DB (upsert from API)
 */
async function ensureManager(managerId) {
  const existing = await prisma.manager.findUnique({ where: { fplId: managerId } });
  if (existing) return existing;

  const entry = await fplFetch(`/entry/${managerId}/`);
  if (!entry) return null;

  return prisma.manager.upsert({
    where: { fplId: managerId },
    update: {
      playerName: `${entry.player_first_name} ${entry.player_last_name}`,
      teamName: entry.name,
      overallPoints: entry.summary_overall_points || 0,
      overallRank: entry.summary_overall_rank || 0,
      lastUpdated: new Date(),
    },
    create: {
      fplId: managerId,
      playerName: `${entry.player_first_name} ${entry.player_last_name}`,
      teamName: entry.name,
      overallPoints: entry.summary_overall_points || 0,
      overallRank: entry.summary_overall_rank || 0,
    },
  });
}

/**
 * Fetch and store a manager's full history, picks, transfers, and chips
 */
async function syncManagerData(managerId) {
  console.log(`[Manager Stats] Syncing data for manager ${managerId}...`);

  const [historyData, transfersData] = await Promise.all([
    fplFetch(`/entry/${managerId}/history/`),
    fplFetch(`/entry/${managerId}/transfers/`),
  ]);

  if (!historyData) throw new Error(`Failed to fetch history for manager ${managerId}`);

  // Store gameweek history
  const gwOps = historyData.current.map((gw) =>
    prisma.managerGameweek.upsert({
      where: { managerId_gameweekId: { managerId, gameweekId: gw.event } },
      update: {
        points: gw.points || 0,
        totalPoints: gw.total_points || 0,
        overallRank: gw.overall_rank || 0,
        rank: gw.rank,
        rankSort: gw.rank_sort,
        eventTransfers: gw.event_transfers || 0,
        eventTransfersCost: gw.event_transfers_cost || 0,
        value: gw.value || 0,
        bank: gw.bank || 0,
        pointsOnBench: gw.points_on_bench || 0,
      },
      create: {
        managerId,
        gameweekId: gw.event,
        points: gw.points || 0,
        totalPoints: gw.total_points || 0,
        overallRank: gw.overall_rank || 0,
        rank: gw.rank,
        rankSort: gw.rank_sort,
        eventTransfers: gw.event_transfers || 0,
        eventTransfersCost: gw.event_transfers_cost || 0,
        value: gw.value || 0,
        bank: gw.bank || 0,
        pointsOnBench: gw.points_on_bench || 0,
      },
    })
  );

  // Store chips
  const chipOps = (historyData.chips || []).map((c) =>
    prisma.managerChip.upsert({
      where: {
        managerId_chipName_gameweek: { managerId, chipName: c.name, gameweek: c.event },
      },
      update: { time: c.time ? new Date(c.time) : null },
      create: {
        managerId,
        chipName: c.name,
        gameweek: c.event,
        time: c.time ? new Date(c.time) : null,
      },
    })
  );

  // Store transfers
  const transferOps = (transfersData || []).map((t) =>
    prisma.managerTransfer.upsert({
      where: {
        id: 0, // Force create (no natural unique key)
      },
      update: {},
      create: {
        managerId,
        gameweek: t.event,
        playerInId: t.element_in,
        playerOutId: t.element_out,
        elementInCost: t.element_in_cost || 0,
        elementOutCost: t.element_out_cost || 0,
        time: new Date(t.time),
      },
    })
  );

  // Execute GW and chip ops in transaction
  await prisma.$transaction([...gwOps, ...chipOps]);

  // Transfers: delete old and insert fresh (no good unique key)
  await prisma.managerTransfer.deleteMany({ where: { managerId } });
  if (transfersData && transfersData.length > 0) {
    await prisma.managerTransfer.createMany({
      data: transfersData.map((t) => ({
        managerId,
        gameweek: t.event,
        playerInId: t.element_in,
        playerOutId: t.element_out,
        elementInCost: t.element_in_cost || 0,
        elementOutCost: t.element_out_cost || 0,
        time: new Date(t.time),
      })),
    });
  }

  // Fetch picks for all played gameweeks (in parallel batches)
  const playedGWs = historyData.current.map((gw) => gw.event);
  const existingPicks = await prisma.managerPick.findMany({
    where: { managerId, gameweekId: { in: playedGWs } },
    select: { gameweekId: true },
    distinct: ['gameweekId'],
  });
  const existingGWs = new Set(existingPicks.map((p) => p.gameweekId));
  const missingGWs = playedGWs.filter((gw) => !existingGWs.has(gw));

  if (missingGWs.length > 0) {
    console.log(`[Manager Stats] Fetching picks for ${missingGWs.length} missing GWs...`);
    const BATCH = 10;
    for (let i = 0; i < missingGWs.length; i += BATCH) {
      const batch = missingGWs.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map(async (gw) => {
          const data = await fplFetch(`/entry/${managerId}/event/${gw}/picks/`);
          return { gw, data };
        })
      );

      const pickOps = [];
      for (const { gw, data } of results) {
        if (!data || !data.picks) continue;

        // Update activeChip on the GW record
        if (data.active_chip) {
          pickOps.push(
            prisma.managerGameweek.update({
              where: { managerId_gameweekId: { managerId, gameweekId: gw } },
              data: { activeChip: data.active_chip },
            })
          );
        }

        for (const pick of data.picks) {
          pickOps.push(
            prisma.managerPick.upsert({
              where: {
                managerId_gameweekId_position: { managerId, gameweekId: gw, position: pick.position },
              },
              update: {
                playerId: pick.element,
                isCaptain: pick.is_captain,
                isViceCaptain: pick.is_vice_captain,
                multiplier: pick.multiplier,
              },
              create: {
                managerId,
                gameweekId: gw,
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

      if (pickOps.length > 0) {
        for (let j = 0; j < pickOps.length; j += 100) {
          await prisma.$transaction(pickOps.slice(j, j + 100));
        }
      }
    }
  }

  // Update last synced gameweek
  const latestGW = Math.max(...playedGWs);
  await prisma.manager.update({
    where: { fplId: managerId },
    data: { lastSyncedGameweek: latestGW },
  });

  console.log(`[Manager Stats] Data synced for manager ${managerId} (${playedGWs.length} GWs)`);
}

/**
 * Compute advanced stats for a manager
 * Returns a JSON blob with all computed stats
 */
async function computeManagerStats(managerId) {
  console.log(`[Manager Stats] Computing stats for manager ${managerId}...`);

  // Fetch all data from DB
  const [gwData, picks, transfers, players] = await Promise.all([
    prisma.managerGameweek.findMany({
      where: { managerId },
      orderBy: { gameweekId: 'asc' },
    }),
    prisma.managerPick.findMany({
      where: { managerId },
      orderBy: [{ gameweekId: 'asc' }, { position: 'asc' }],
    }),
    prisma.managerTransfer.findMany({
      where: { managerId },
      orderBy: { time: 'asc' },
    }),
    prisma.player.findMany({
      select: {
        fplId: true, webName: true, elementType: true, teamId: true,
        expectedGoals: true, expectedAssists: true, expectedGoalsConceded: true,
      },
    }),
  ]);

  // Build player lookup
  const playerMap = new Map(players.map((p) => [p.fplId, p]));

  // Get player GW stats for points lookup
  const allPlayerIds = [...new Set(picks.map((p) => p.playerId))];
  const playerGWStats = await prisma.playerGameweekStats.findMany({
    where: { playerId: { in: allPlayerIds } },
    select: { playerId: true, gameweek: true, totalPoints: true, minutes: true, goalsScored: true, assists: true, cleanSheets: true, expectedGoals: true, expectedAssists: true, expectedGoalsConceded: true },
  });

  // Build lookup: playerGWStats[playerId][gameweek]
  const pgsLookup = {};
  for (const s of playerGWStats) {
    if (!pgsLookup[s.playerId]) pgsLookup[s.playerId] = {};
    pgsLookup[s.playerId][s.gameweek] = s;
  }

  // === BENCH WASTE ===
  let totalBenchWaste = 0;
  const benchWasteByGW = [];
  for (const gw of gwData) {
    benchWasteByGW.push({
      gameweek: gw.gameweekId,
      benchPoints: gw.pointsOnBench,
    });
    totalBenchWaste += gw.pointsOnBench;
  }

  // === CAPTAIN ROI ===
  let totalCaptainPoints = 0;
  let totalCaptainBonusPoints = 0;
  const captainHistory = [];
  for (const gw of gwData) {
    const gwPicks = picks.filter((p) => p.gameweekId === gw.gameweekId);
    const captain = gwPicks.find((p) => p.isCaptain);
    if (!captain) continue;

    const playerStats = pgsLookup[captain.playerId]?.[gw.gameweekId];
    const points = playerStats?.totalPoints || 0;
    const multiplier = captain.multiplier || 2;
    const bonusPoints = points * (multiplier - 1); // Extra points from captaincy

    totalCaptainPoints += points * multiplier;
    totalCaptainBonusPoints += bonusPoints;

    const player = playerMap.get(captain.playerId);
    captainHistory.push({
      gameweek: gw.gameweekId,
      playerId: captain.playerId,
      playerName: player?.webName || 'Unknown',
      points,
      multiplier,
      bonusPoints,
    });
  }

  // === POINTS BY POSITION ===
  const pointsByPosition = { GKP: 0, DEF: 0, MID: 0, FWD: 0 };
  const positionNames = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };
  for (const pick of picks) {
    if (pick.position > 11) continue; // Skip bench
    const playerStats = pgsLookup[pick.playerId]?.[pick.gameweekId];
    const points = playerStats?.totalPoints || 0;
    const player = playerMap.get(pick.playerId);
    const posName = positionNames[player?.elementType] || 'Unknown';
    pointsByPosition[posName] += points * (pick.multiplier || 1);
  }

  // === TRANSFER ROI ===
  let totalTransferROI = 0;
  const transferHistory = [];
  for (const t of transfers) {
    // Points gained by player in since transfer
    const inStats = playerGWStats.filter(
      (s) => s.playerId === t.playerInId && s.gameweek >= t.gameweek
    );
    const outStats = playerGWStats.filter(
      (s) => s.playerId === t.playerOutId && s.gameweek >= t.gameweek
    );

    const inPoints = inStats.reduce((sum, s) => sum + s.totalPoints, 0);
    const outPoints = outStats.reduce((sum, s) => sum + s.totalPoints, 0);
    const roi = inPoints - outPoints;
    totalTransferROI += roi;

    const playerIn = playerMap.get(t.playerInId);
    const playerOut = playerMap.get(t.playerOutId);
    transferHistory.push({
      gameweek: t.gameweek,
      playerIn: playerIn?.webName || 'Unknown',
      playerOut: playerOut?.webName || 'Unknown',
      playerInPoints: inPoints,
      playerOutPoints: outPoints,
      roi,
    });
  }

  // === LUCK METER ===
  // Goal luck: goals scored vs xG
  // Assist luck: assists vs xA
  // Clean sheet luck: CS vs Poisson probability from xGC
  let goalLuck = 0;
  let assistLuck = 0;
  let csLuck = 0;

  for (const pick of picks) {
    if (pick.position > 11) continue; // Starting XI only
    const stats = pgsLookup[pick.playerId]?.[pick.gameweekId];
    if (!stats || stats.minutes === 0) continue;

    const xG = parseFloat(stats.expectedGoals || '0');
    const xA = parseFloat(stats.expectedAssists || '0');
    const xGC = parseFloat(stats.expectedGoalsConceded || '0');

    goalLuck += (stats.goalsScored - xG);
    assistLuck += (stats.assists - xA);

    // Clean sheet luck: P(CS) = e^(-xGC) (Poisson)
    const csProb = Math.exp(-xGC);
    csLuck += (stats.cleanSheets - csProb);
  }

  const luckMeter = {
    goalLuck: Math.round(goalLuck * 100) / 100,
    assistLuck: Math.round(assistLuck * 100) / 100,
    csLuck: Math.round(csLuck * 100) / 100,
    totalLuck: Math.round((goalLuck + assistLuck + csLuck) * 100) / 100,
  };

  // === TOTAL TRANSFERS COST ===
  const totalTransfersCost = gwData.reduce((sum, gw) => sum + gw.eventTransfersCost, 0);

  // === RANK HISTORY ===
  const rankHistory = gwData.map((gw) => ({
    gameweek: gw.gameweekId,
    overallRank: gw.overallRank,
    gwRank: gw.rank,
    points: gw.points,
    totalPoints: gw.totalPoints,
  }));

  const stats = {
    benchWaste: {
      total: totalBenchWaste,
      average: gwData.length > 0 ? Math.round((totalBenchWaste / gwData.length) * 100) / 100 : 0,
      byGameweek: benchWasteByGW,
    },
    captainROI: {
      totalPoints: totalCaptainPoints,
      totalBonusPoints: totalCaptainBonusPoints,
      averageBonusPerGW: gwData.length > 0 ? Math.round((totalCaptainBonusPoints / gwData.length) * 100) / 100 : 0,
      history: captainHistory,
    },
    pointsByPosition,
    transferROI: {
      totalROI: totalTransferROI,
      totalCost: totalTransfersCost,
      netROI: totalTransferROI - totalTransfersCost,
      history: transferHistory,
    },
    luckMeter,
    rankHistory,
  };

  return stats;
}

/**
 * Get or compute manager stats (with caching)
 * @param {number} managerId - Manager entry ID
 * @returns {object} Computed stats
 */
async function getManagerStats(managerId) {
  // Check cache first
  const cached = await prisma.managerSeasonStats.findUnique({
    where: { managerId },
  });

  if (cached) {
    const age = Date.now() - new Date(cached.lastUpdated).getTime();
    if (age < STATS_TTL_MS) {
      console.log(`[Manager Stats] Serving cached stats for ${managerId}`);
      return cached.data;
    }
  }

  // Ensure manager exists
  await ensureManager(managerId);

  // Sync latest data from FPL API
  await syncManagerData(managerId);

  // Compute stats
  const stats = await computeManagerStats(managerId);

  // Cache in DB
  await prisma.managerSeasonStats.upsert({
    where: { managerId },
    update: { data: stats, lastUpdated: new Date() },
    create: { managerId, data: stats },
  });

  return stats;
}

module.exports = { getManagerStats, syncManagerData, computeManagerStats };
