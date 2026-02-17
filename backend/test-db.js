require('dotenv').config();
const prisma = require('./services/db');

async function main() {
  try {
    // Test connection
    await prisma.$connect();
    console.log('Connected to PostgreSQL successfully!');

    // Check all tables exist by running a count on each model
    const counts = {
      teams: await prisma.team.count(),
      players: await prisma.player.count(),
      gameweeks: await prisma.gameweek.count(),
      fixtures: await prisma.fixture.count(),
      playerGameweekStats: await prisma.playerGameweekStats.count(),
      livePlayerData: await prisma.livePlayerData.count(),
      playerComputedStats: await prisma.playerComputedStats.count(),
      teamSeasonStats: await prisma.teamSeasonStats.count(),
      teamGameweekStats: await prisma.teamGameweekStats.count(),
      managers: await prisma.manager.count(),
      managerGameweeks: await prisma.managerGameweek.count(),
      managerPicks: await prisma.managerPick.count(),
      managerTransfers: await prisma.managerTransfer.count(),
      managerChips: await prisma.managerChip.count(),
      managerComputedStats: await prisma.managerComputedStats.count(),
      managerSeasonStats: await prisma.managerSeasonStats.count(),
      ownershipData: await prisma.ownershipData.count(),
      cacheEntries: await prisma.cacheEntry.count(),
      cronJobLogs: await prisma.cronJobLog.count(),
    };

    console.log('\nTable row counts (all should be 0 for fresh DB):');
    console.table(counts);

    console.log('\nAll tables verified. Database is ready!');
  } catch (error) {
    console.error('Database test failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
