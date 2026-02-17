/**
 * Bootstrap Sync Service
 * Fetches bootstrap-static data and upserts Teams, Players, Gameweeks into DB
 */
const prisma = require('./db');
const fetch = require('node-fetch');
const { HttpsProxyAgent } = require('https-proxy-agent');

const proxyAgent = process.env.PROXY_URL
  ? new HttpsProxyAgent(process.env.PROXY_URL)
  : null;

const FPL_API = 'https://fantasy.premierleague.com/api';

/**
 * Fetch bootstrap-static from FPL API
 */
async function fetchBootstrap() {
  const resp = await fetch(`${FPL_API}/bootstrap-static/`, {
    agent: proxyAgent,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
  });
  if (!resp.ok) throw new Error(`Bootstrap fetch failed: ${resp.status}`);
  return resp.json();
}

/**
 * Sync all bootstrap data (teams, players, gameweeks) into DB
 */
async function syncBootstrap() {
  console.log('[Bootstrap Sync] Starting...');
  const data = await fetchBootstrap();

  // Sync teams
  const teamOps = data.teams.map(t =>
    prisma.team.upsert({
      where: { fplId: t.id },
      update: {
        name: t.name,
        shortName: t.short_name,
        code: t.code,
        strength: t.strength,
        strengthOverallHome: t.strength_overall_home,
        strengthOverallAway: t.strength_overall_away,
        strengthAttackHome: t.strength_attack_home,
        strengthAttackAway: t.strength_attack_away,
        strengthDefenceHome: t.strength_defence_home,
        strengthDefenceAway: t.strength_defence_away,
        lastUpdated: new Date(),
      },
      create: {
        fplId: t.id,
        name: t.name,
        shortName: t.short_name,
        code: t.code,
        strength: t.strength,
        strengthOverallHome: t.strength_overall_home,
        strengthOverallAway: t.strength_overall_away,
        strengthAttackHome: t.strength_attack_home,
        strengthAttackAway: t.strength_attack_away,
        strengthDefenceHome: t.strength_defence_home,
        strengthDefenceAway: t.strength_defence_away,
      },
    })
  );
  await prisma.$transaction(teamOps);
  console.log(`[Bootstrap Sync] Upserted ${data.teams.length} teams`);

  // Sync players
  const playerOps = data.elements.map(p =>
    prisma.player.upsert({
      where: { fplId: p.id },
      update: {
        firstName: p.first_name,
        secondName: p.second_name,
        webName: p.web_name,
        code: p.code,
        teamId: p.team,
        elementType: p.element_type,
        nowCost: p.now_cost,
        selectedByPercent: p.selected_by_percent || '0',
        transfersIn: p.transfers_in || 0,
        transfersOut: p.transfers_out || 0,
        transfersInEvent: p.transfers_in_event || 0,
        transfersOutEvent: p.transfers_out_event || 0,
        totalPoints: p.total_points || 0,
        eventPoints: p.event_points || 0,
        form: p.form || '0',
        pointsPerGame: p.points_per_game || '0',
        minutes: p.minutes || 0,
        goalsScored: p.goals_scored || 0,
        assists: p.assists || 0,
        cleanSheets: p.clean_sheets || 0,
        goalsConceded: p.goals_conceded || 0,
        ownGoals: p.own_goals || 0,
        penaltiesSaved: p.penalties_saved || 0,
        penaltiesMissed: p.penalties_missed || 0,
        yellowCards: p.yellow_cards || 0,
        redCards: p.red_cards || 0,
        saves: p.saves || 0,
        bonus: p.bonus || 0,
        bps: p.bps || 0,
        influence: p.influence || '0',
        creativity: p.creativity || '0',
        threat: p.threat || '0',
        ictIndex: p.ict_index || '0',
        expectedGoals: p.expected_goals || '0',
        expectedAssists: p.expected_assists || '0',
        expectedGoalInvolvements: p.expected_goal_involvements || '0',
        expectedGoalsConceded: p.expected_goals_conceded || '0',
        status: p.status || 'a',
        news: p.news || null,
        newsAdded: p.news_added ? new Date(p.news_added) : null,
        chanceOfPlayingThisRound: p.chance_of_playing_this_round,
        chanceOfPlayingNextRound: p.chance_of_playing_next_round,
        lastUpdated: new Date(),
      },
      create: {
        fplId: p.id,
        firstName: p.first_name,
        secondName: p.second_name,
        webName: p.web_name,
        code: p.code,
        teamId: p.team,
        elementType: p.element_type,
        nowCost: p.now_cost,
        selectedByPercent: p.selected_by_percent || '0',
        transfersIn: p.transfers_in || 0,
        transfersOut: p.transfers_out || 0,
        transfersInEvent: p.transfers_in_event || 0,
        transfersOutEvent: p.transfers_out_event || 0,
        totalPoints: p.total_points || 0,
        eventPoints: p.event_points || 0,
        form: p.form || '0',
        pointsPerGame: p.points_per_game || '0',
        minutes: p.minutes || 0,
        goalsScored: p.goals_scored || 0,
        assists: p.assists || 0,
        cleanSheets: p.clean_sheets || 0,
        goalsConceded: p.goals_conceded || 0,
        ownGoals: p.own_goals || 0,
        penaltiesSaved: p.penalties_saved || 0,
        penaltiesMissed: p.penalties_missed || 0,
        yellowCards: p.yellow_cards || 0,
        redCards: p.red_cards || 0,
        saves: p.saves || 0,
        bonus: p.bonus || 0,
        bps: p.bps || 0,
        influence: p.influence || '0',
        creativity: p.creativity || '0',
        threat: p.threat || '0',
        ictIndex: p.ict_index || '0',
        expectedGoals: p.expected_goals || '0',
        expectedAssists: p.expected_assists || '0',
        expectedGoalInvolvements: p.expected_goal_involvements || '0',
        expectedGoalsConceded: p.expected_goals_conceded || '0',
        status: p.status || 'a',
        news: p.news || null,
        newsAdded: p.news_added ? new Date(p.news_added) : null,
        chanceOfPlayingThisRound: p.chance_of_playing_this_round,
        chanceOfPlayingNextRound: p.chance_of_playing_next_round,
      },
    })
  );

  // Batch in chunks of 100 to avoid overwhelming the DB
  for (let i = 0; i < playerOps.length; i += 100) {
    await prisma.$transaction(playerOps.slice(i, i + 100));
  }
  console.log(`[Bootstrap Sync] Upserted ${data.elements.length} players`);

  // Sync gameweeks
  const gwOps = data.events.map(e =>
    prisma.gameweek.upsert({
      where: { fplId: e.id },
      update: {
        name: e.name,
        deadlineTime: new Date(e.deadline_time),
        finished: e.finished,
        dataChecked: e.data_checked,
        isCurrent: e.is_current,
        isNext: e.is_next,
        isPrevious: e.is_previous,
        highestScoringEntry: e.highest_scoring_entry,
        averageEntryScore: e.average_entry_score,
        highestScore: e.highest_score,
        mostSelected: e.most_selected,
        mostTransferredIn: e.most_transferred_in,
        mostCaptained: e.most_captained,
        mostViceCaptained: e.most_vice_captained,
        lastUpdated: new Date(),
      },
      create: {
        fplId: e.id,
        name: e.name,
        deadlineTime: new Date(e.deadline_time),
        finished: e.finished,
        dataChecked: e.data_checked,
        isCurrent: e.is_current,
        isNext: e.is_next,
        isPrevious: e.is_previous,
        highestScoringEntry: e.highest_scoring_entry,
        averageEntryScore: e.average_entry_score,
        highestScore: e.highest_score,
        mostSelected: e.most_selected,
        mostTransferredIn: e.most_transferred_in,
        mostCaptained: e.most_captained,
        mostViceCaptained: e.most_vice_captained,
      },
    })
  );
  await prisma.$transaction(gwOps);
  console.log(`[Bootstrap Sync] Upserted ${data.events.length} gameweeks`);

  return data;
}

/**
 * Get current gameweek from DB
 */
async function getCurrentGameweekFromDB() {
  const gw = await prisma.gameweek.findFirst({
    where: { isCurrent: true },
  });
  return gw;
}

module.exports = { syncBootstrap, fetchBootstrap, getCurrentGameweekFromDB };
