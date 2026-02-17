/**
 * Team Stats Service
 * Computes team season stats and per-GW cumulative stats from fixtures + player data
 */
const prisma = require('./db');

/**
 * Compute team season stats for all 20 teams (overall/home/away splits)
 * Calculates: W/D/L, GF/GA/GD, CS, points, xG, xGA, xPts, per-game averages
 */
async function computeTeamStats() {
  console.log('[Team Stats] Computing...');

  const teams = await prisma.team.findMany();
  const fixtures = await prisma.fixture.findMany({
    where: { finished: true },
  });

  // Get all players for xG/xGA calculation (season totals from bootstrap)
  const players = await prisma.player.findMany({
    select: {
      teamId: true,
      elementType: true,
      expectedGoals: true,
      expectedGoalsConceded: true,
    },
  });

  // Calculate team-level xG and xGA from player data
  const teamXG = {};
  const teamXGA = {};
  for (const team of teams) {
    const teamPlayers = players.filter(p => p.teamId === team.fplId);
    teamXG[team.fplId] = teamPlayers.reduce((sum, p) => sum + parseFloat(p.expectedGoals || '0'), 0);
    // xGA from GK expected_goals_conceded (use max among GKs to get the team's xGA)
    const gks = teamPlayers.filter(p => p.elementType === 1);
    teamXGA[team.fplId] = gks.length > 0
      ? Math.max(...gks.map(p => parseFloat(p.expectedGoalsConceded || '0')))
      : 0;
  }

  const ops = [];

  for (const team of teams) {
    const homeFixtures = fixtures.filter(f => f.homeTeamId === team.fplId);
    const awayFixtures = fixtures.filter(f => f.awayTeamId === team.fplId);
    const allFixtures = [...homeFixtures, ...awayFixtures];

    const splits = {
      overall: allFixtures,
      home: homeFixtures,
      away: awayFixtures,
    };

    for (const [split, splitFixtures] of Object.entries(splits)) {
      let wins = 0, draws = 0, losses = 0, gf = 0, ga = 0, cs = 0;

      for (const f of splitFixtures) {
        const isHome = f.homeTeamId === team.fplId;
        const scored = isHome ? (f.homeScore || 0) : (f.awayScore || 0);
        const conceded = isHome ? (f.awayScore || 0) : (f.homeScore || 0);

        gf += scored;
        ga += conceded;
        if (conceded === 0) cs++;

        if (scored > conceded) wins++;
        else if (scored === conceded) draws++;
        else losses++;
      }

      const played = splitFixtures.length;
      const pts = wins * 3 + draws;

      // Scale xG/xGA by split ratio
      const totalPlayed = allFixtures.length || 1;
      const splitRatio = played / totalPlayed;
      const xG = teamXG[team.fplId] * splitRatio;
      const xGA = teamXGA[team.fplId] * splitRatio;

      // Pythagorean xPts: played * (xG^1.3 / (xG^1.3 + xGA^1.3)) * 2.8
      let xPts = 0;
      if (played > 0 && (xG + xGA) > 0) {
        const xGPow = Math.pow(xG, 1.3);
        const xGAPow = Math.pow(xGA, 1.3);
        xPts = played * (xGPow / (xGPow + xGAPow)) * 2.8;
      }

      ops.push(
        prisma.teamSeasonStats.upsert({
          where: { teamId_split: { teamId: team.fplId, split } },
          update: {
            played, wins, draws, losses,
            goalsFor: gf, goalsAgainst: ga,
            goalDifference: gf - ga,
            cleanSheets: cs, points: pts,
            xG: Math.round(xG * 100) / 100,
            xGA: Math.round(xGA * 100) / 100,
            xPts: Math.round(xPts * 100) / 100,
            xGPerGame: played > 0 ? Math.round((xG / played) * 100) / 100 : 0,
            xGAPerGame: played > 0 ? Math.round((xGA / played) * 100) / 100 : 0,
            goalsPerGame: played > 0 ? Math.round((gf / played) * 100) / 100 : 0,
            lastUpdated: new Date(),
          },
          create: {
            teamId: team.fplId, split, played, wins, draws, losses,
            goalsFor: gf, goalsAgainst: ga,
            goalDifference: gf - ga,
            cleanSheets: cs, points: pts,
            xG: Math.round(xG * 100) / 100,
            xGA: Math.round(xGA * 100) / 100,
            xPts: Math.round(xPts * 100) / 100,
            xGPerGame: played > 0 ? Math.round((xG / played) * 100) / 100 : 0,
            xGAPerGame: played > 0 ? Math.round((xGA / played) * 100) / 100 : 0,
            goalsPerGame: played > 0 ? Math.round((gf / played) * 100) / 100 : 0,
          },
        })
      );
    }
  }

  await prisma.$transaction(ops);
  console.log(`[Team Stats] Upserted ${ops.length} team season stats (${teams.length} teams × 3 splits)`);
}

/**
 * Compute cumulative per-GW stats for chart data
 */
async function computeTeamGameweekStats() {
  console.log('[Team GW Stats] Computing cumulative stats...');

  const teams = await prisma.team.findMany();
  const fixtures = await prisma.fixture.findMany({
    where: { finished: true, gameweekId: { not: null } },
    orderBy: { gameweekId: 'asc' },
  });

  // Get finished gameweeks
  const gameweeks = await prisma.gameweek.findMany({
    where: { finished: true },
    orderBy: { fplId: 'asc' },
  });

  if (gameweeks.length === 0) {
    console.log('[Team GW Stats] No finished gameweeks yet');
    return;
  }

  const ops = [];

  for (const team of teams) {
    // Track running totals for each split
    const cumulative = {
      overall: { wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, cs: 0, pts: 0, xG: 0, xGA: 0 },
      home: { wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, cs: 0, pts: 0, xG: 0, xGA: 0 },
      away: { wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, cs: 0, pts: 0, xG: 0, xGA: 0 },
    };

    for (const gw of gameweeks) {
      const gwFixtures = fixtures.filter(
        f => f.gameweekId === gw.fplId &&
          (f.homeTeamId === team.fplId || f.awayTeamId === team.fplId)
      );

      for (const f of gwFixtures) {
        const isHome = f.homeTeamId === team.fplId;
        const scored = isHome ? (f.homeScore || 0) : (f.awayScore || 0);
        const conceded = isHome ? (f.awayScore || 0) : (f.homeScore || 0);
        const split = isHome ? 'home' : 'away';

        const result = scored > conceded ? 'win' : scored === conceded ? 'draw' : 'loss';

        // Update split-specific
        cumulative[split].gf += scored;
        cumulative[split].ga += conceded;
        if (conceded === 0) cumulative[split].cs++;
        if (result === 'win') { cumulative[split].wins++; cumulative[split].pts += 3; }
        else if (result === 'draw') { cumulative[split].draws++; cumulative[split].pts += 1; }
        else cumulative[split].losses++;

        // Update overall
        cumulative.overall.gf += scored;
        cumulative.overall.ga += conceded;
        if (conceded === 0) cumulative.overall.cs++;
        if (result === 'win') { cumulative.overall.wins++; cumulative.overall.pts += 3; }
        else if (result === 'draw') { cumulative.overall.draws++; cumulative.overall.pts += 1; }
        else cumulative.overall.losses++;
      }

      // Write cumulative stats for each split at this GW
      for (const split of ['overall', 'home', 'away']) {
        const c = cumulative[split];
        const played = c.wins + c.draws + c.losses;

        // xPts for cumulative
        let xPts = 0;
        if (played > 0 && (c.xG + c.xGA) > 0) {
          const xGPow = Math.pow(c.xG, 1.3);
          const xGAPow = Math.pow(c.xGA, 1.3);
          xPts = played * (xGPow / (xGPow + xGAPow)) * 2.8;
        }

        ops.push(
          prisma.teamGameweekStats.upsert({
            where: {
              teamId_gameweek_split: { teamId: team.fplId, gameweek: gw.fplId, split },
            },
            update: {
              wins: c.wins, draws: c.draws, losses: c.losses,
              goalsFor: c.gf, goalsAgainst: c.ga,
              cleanSheets: c.cs, points: c.pts,
              xG: Math.round(c.xG * 100) / 100,
              xGA: Math.round(c.xGA * 100) / 100,
              xPts: Math.round(xPts * 100) / 100,
            },
            create: {
              teamId: team.fplId, gameweek: gw.fplId, split,
              wins: c.wins, draws: c.draws, losses: c.losses,
              goalsFor: c.gf, goalsAgainst: c.ga,
              cleanSheets: c.cs, points: c.pts,
              xG: Math.round(c.xG * 100) / 100,
              xGA: Math.round(c.xGA * 100) / 100,
              xPts: Math.round(xPts * 100) / 100,
            },
          })
        );
      }
    }
  }

  // Batch in chunks of 100
  for (let i = 0; i < ops.length; i += 100) {
    await prisma.$transaction(ops.slice(i, i + 100));
  }
  console.log(`[Team GW Stats] Upserted ${ops.length} cumulative GW stats`);
}

module.exports = { computeTeamStats, computeTeamGameweekStats };
