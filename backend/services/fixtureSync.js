/**
 * Fixture Sync Service
 * Fetches /fixtures/ and upserts into Fixture table
 */
const prisma = require('./db');
const fetch = require('node-fetch');
const { HttpsProxyAgent } = require('https-proxy-agent');

const proxyAgent = process.env.PROXY_URL
  ? new HttpsProxyAgent(process.env.PROXY_URL)
  : null;

const FPL_API = 'https://fantasy.premierleague.com/api';

/**
 * Fetch all fixtures from FPL API
 */
async function fetchFixtures() {
  const resp = await fetch(`${FPL_API}/fixtures/`, {
    agent: proxyAgent,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
  });
  if (!resp.ok) throw new Error(`Fixtures fetch failed: ${resp.status}`);
  return resp.json();
}

/**
 * Sync all fixtures into DB
 */
async function syncFixtures() {
  console.log('[Fixture Sync] Starting...');
  const fixtures = await fetchFixtures();

  const ops = fixtures.map(f =>
    prisma.fixture.upsert({
      where: { fplId: f.id },
      update: {
        gameweekId: f.event || null,
        kickoffTime: f.kickoff_time ? new Date(f.kickoff_time) : null,
        homeTeamId: f.team_h,
        awayTeamId: f.team_a,
        homeScore: f.team_h_score,
        awayScore: f.team_a_score,
        homeTeamDifficulty: f.team_h_difficulty,
        awayTeamDifficulty: f.team_a_difficulty,
        started: f.started || false,
        finished: f.finished || false,
        finishedProvisional: f.finished_provisional || false,
        lastUpdated: new Date(),
      },
      create: {
        fplId: f.id,
        gameweekId: f.event || null,
        kickoffTime: f.kickoff_time ? new Date(f.kickoff_time) : null,
        homeTeamId: f.team_h,
        awayTeamId: f.team_a,
        homeScore: f.team_h_score,
        awayScore: f.team_a_score,
        homeTeamDifficulty: f.team_h_difficulty,
        awayTeamDifficulty: f.team_a_difficulty,
        started: f.started || false,
        finished: f.finished || false,
        finishedProvisional: f.finished_provisional || false,
      },
    })
  );

  // Batch in chunks of 50
  for (let i = 0; i < ops.length; i += 50) {
    await prisma.$transaction(ops.slice(i, i + 50));
  }
  console.log(`[Fixture Sync] Upserted ${fixtures.length} fixtures`);
}

module.exports = { syncFixtures, fetchFixtures };
