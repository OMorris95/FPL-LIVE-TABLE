/**
 * Ownership Service
 * Calculates tiered ownership from stored manager picks
 */
const prisma = require('./db');

/**
 * Calculate ownership for a specific gameweek and tier
 * @param {number} gameweek - Gameweek number
 * @param {string} tier - '100', '1k', or '10k'
 */
async function calculateOwnership(gameweek, tier) {
  console.log(`[Ownership] Calculating ${tier} ownership for GW${gameweek}...`);

  // Determine rank filter
  const rankFilter =
    tier === '100' ? { isTop100: true } :
    tier === '1k' ? { isTop1k: true } :
    { isTop10k: true };

  // Get manager IDs for this tier
  const managers = await prisma.manager.findMany({
    where: rankFilter,
    select: { fplId: true },
  });
  const managerIds = managers.map((m) => m.fplId);
  const totalManagers = managerIds.length;

  if (totalManagers === 0) {
    console.log(`[Ownership] No managers found for tier ${tier}`);
    return;
  }

  // Count picks per player (starting XI only: multiplier > 0)
  const pickCounts = await prisma.managerPick.groupBy({
    by: ['playerId'],
    where: {
      gameweekId: gameweek,
      managerId: { in: managerIds },
    },
    _count: { playerId: true },
  });

  // Count captain picks separately
  const captainCounts = await prisma.managerPick.groupBy({
    by: ['playerId'],
    where: {
      gameweekId: gameweek,
      managerId: { in: managerIds },
      isCaptain: true,
    },
    _count: { playerId: true },
  });

  const captainMap = new Map(captainCounts.map((c) => [c.playerId, c._count.playerId]));

  // Upsert ownership data
  const ops = pickCounts.map((p) => {
    const ownershipPct = Math.round((p._count.playerId / totalManagers) * 10000) / 100;
    const captainPct = captainMap.has(p.playerId)
      ? Math.round((captainMap.get(p.playerId) / totalManagers) * 10000) / 100
      : 0;

    return prisma.ownershipData.upsert({
      where: {
        playerId_gameweekId_tier: {
          playerId: p.playerId,
          gameweekId: gameweek,
          tier,
        },
      },
      update: {
        ownership: ownershipPct,
        captaincy: captainPct,
        totalManagers,
        lastUpdated: new Date(),
      },
      create: {
        playerId: p.playerId,
        gameweekId: gameweek,
        tier,
        ownership: ownershipPct,
        captaincy: captainPct,
        totalManagers,
      },
    });
  });

  for (let i = 0; i < ops.length; i += 100) {
    await prisma.$transaction(ops.slice(i, i + 100));
  }

  console.log(`[Ownership] ${tier} GW${gameweek}: ${pickCounts.length} players, ${totalManagers} managers`);
}

/**
 * Calculate ownership for all tiers
 */
async function calculateAllOwnership(gameweek) {
  for (const tier of ['100', '1k', '10k']) {
    await calculateOwnership(gameweek, tier);
  }
}

/**
 * Get ownership data for a tier and gameweek
 */
async function getOwnership(tier, gameweek) {
  const data = await prisma.ownershipData.findMany({
    where: { tier, gameweekId: gameweek },
    include: {
      player: {
        select: { webName: true, fplId: true, elementType: true, teamId: true, nowCost: true },
      },
    },
    orderBy: { ownership: 'desc' },
  });
  return data;
}

/**
 * Get latest available ownership data for a tier
 * Searches backwards from currentGw
 */
async function getLatestOwnership(tier, currentGw) {
  for (let gw = currentGw; gw >= 1; gw--) {
    const data = await prisma.ownershipData.findFirst({
      where: { tier, gameweekId: gw },
    });
    if (data) {
      return getOwnership(tier, gw);
    }
  }
  return null;
}

module.exports = { calculateOwnership, calculateAllOwnership, getOwnership, getLatestOwnership };
