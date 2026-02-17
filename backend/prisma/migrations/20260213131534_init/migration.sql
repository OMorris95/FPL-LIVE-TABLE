-- CreateTable
CREATE TABLE "teams" (
    "id" SERIAL NOT NULL,
    "fpl_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "short_name" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "strength" INTEGER NOT NULL DEFAULT 0,
    "strength_overall_home" INTEGER NOT NULL DEFAULT 0,
    "strength_overall_away" INTEGER NOT NULL DEFAULT 0,
    "strength_attack_home" INTEGER NOT NULL DEFAULT 0,
    "strength_attack_away" INTEGER NOT NULL DEFAULT 0,
    "strength_defence_home" INTEGER NOT NULL DEFAULT 0,
    "strength_defence_away" INTEGER NOT NULL DEFAULT 0,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" SERIAL NOT NULL,
    "fpl_id" INTEGER NOT NULL,
    "first_name" TEXT NOT NULL,
    "second_name" TEXT NOT NULL,
    "web_name" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "element_type" INTEGER NOT NULL,
    "now_cost" INTEGER NOT NULL,
    "selected_by_percent" TEXT NOT NULL DEFAULT '0',
    "transfers_in" INTEGER NOT NULL DEFAULT 0,
    "transfers_out" INTEGER NOT NULL DEFAULT 0,
    "transfers_in_event" INTEGER NOT NULL DEFAULT 0,
    "transfers_out_event" INTEGER NOT NULL DEFAULT 0,
    "total_points" INTEGER NOT NULL DEFAULT 0,
    "event_points" INTEGER NOT NULL DEFAULT 0,
    "form" TEXT NOT NULL DEFAULT '0',
    "points_per_game" TEXT NOT NULL DEFAULT '0',
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "goals_scored" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "clean_sheets" INTEGER NOT NULL DEFAULT 0,
    "goals_conceded" INTEGER NOT NULL DEFAULT 0,
    "own_goals" INTEGER NOT NULL DEFAULT 0,
    "penalties_saved" INTEGER NOT NULL DEFAULT 0,
    "penalties_missed" INTEGER NOT NULL DEFAULT 0,
    "yellow_cards" INTEGER NOT NULL DEFAULT 0,
    "red_cards" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "bonus" INTEGER NOT NULL DEFAULT 0,
    "bps" INTEGER NOT NULL DEFAULT 0,
    "influence" TEXT NOT NULL DEFAULT '0',
    "creativity" TEXT NOT NULL DEFAULT '0',
    "threat" TEXT NOT NULL DEFAULT '0',
    "ict_index" TEXT NOT NULL DEFAULT '0',
    "expected_goals" TEXT NOT NULL DEFAULT '0',
    "expected_assists" TEXT NOT NULL DEFAULT '0',
    "expected_goal_involvements" TEXT NOT NULL DEFAULT '0',
    "expected_goals_conceded" TEXT NOT NULL DEFAULT '0',
    "status" TEXT NOT NULL DEFAULT 'a',
    "news" TEXT,
    "news_added" TIMESTAMP(3),
    "chance_of_playing_this_round" INTEGER,
    "chance_of_playing_next_round" INTEGER,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gameweeks" (
    "id" SERIAL NOT NULL,
    "fpl_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "deadline_time" TIMESTAMP(3) NOT NULL,
    "finished" BOOLEAN NOT NULL DEFAULT false,
    "data_checked" BOOLEAN NOT NULL DEFAULT false,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "is_next" BOOLEAN NOT NULL DEFAULT false,
    "is_previous" BOOLEAN NOT NULL DEFAULT false,
    "highest_scoring_entry" INTEGER,
    "average_entry_score" INTEGER,
    "highest_score" INTEGER,
    "most_selected" INTEGER,
    "most_transferred_in" INTEGER,
    "most_captained" INTEGER,
    "most_vice_captained" INTEGER,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gameweeks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixtures" (
    "id" SERIAL NOT NULL,
    "fpl_id" INTEGER NOT NULL,
    "gameweek_id" INTEGER,
    "kickoff_time" TIMESTAMP(3),
    "home_team_id" INTEGER NOT NULL,
    "away_team_id" INTEGER NOT NULL,
    "home_score" INTEGER,
    "away_score" INTEGER,
    "home_team_difficulty" INTEGER,
    "away_team_difficulty" INTEGER,
    "started" BOOLEAN NOT NULL DEFAULT false,
    "finished" BOOLEAN NOT NULL DEFAULT false,
    "finished_provisional" BOOLEAN NOT NULL DEFAULT false,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fixtures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_gameweek_stats" (
    "id" SERIAL NOT NULL,
    "player_id" INTEGER NOT NULL,
    "gameweek" INTEGER NOT NULL,
    "opponent_team_id" INTEGER NOT NULL,
    "was_home" BOOLEAN NOT NULL,
    "kickoff_time" TIMESTAMP(3),
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "total_points" INTEGER NOT NULL DEFAULT 0,
    "goals_scored" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "clean_sheets" INTEGER NOT NULL DEFAULT 0,
    "goals_conceded" INTEGER NOT NULL DEFAULT 0,
    "own_goals" INTEGER NOT NULL DEFAULT 0,
    "penalties_saved" INTEGER NOT NULL DEFAULT 0,
    "penalties_missed" INTEGER NOT NULL DEFAULT 0,
    "yellow_cards" INTEGER NOT NULL DEFAULT 0,
    "red_cards" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "bonus" INTEGER NOT NULL DEFAULT 0,
    "bps" INTEGER NOT NULL DEFAULT 0,
    "influence" TEXT NOT NULL DEFAULT '0',
    "creativity" TEXT NOT NULL DEFAULT '0',
    "threat" TEXT NOT NULL DEFAULT '0',
    "ict_index" TEXT NOT NULL DEFAULT '0',
    "expected_goals" TEXT NOT NULL DEFAULT '0',
    "expected_assists" TEXT NOT NULL DEFAULT '0',
    "expected_goal_involvements" TEXT NOT NULL DEFAULT '0',
    "expected_goals_conceded" TEXT NOT NULL DEFAULT '0',
    "value" INTEGER NOT NULL DEFAULT 0,
    "selected" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "player_gameweek_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_player_data" (
    "id" SERIAL NOT NULL,
    "player_id" INTEGER NOT NULL,
    "gameweek_id" INTEGER NOT NULL,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "total_points" INTEGER NOT NULL DEFAULT 0,
    "goals_scored" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "clean_sheets" INTEGER NOT NULL DEFAULT 0,
    "goals_conceded" INTEGER NOT NULL DEFAULT 0,
    "own_goals" INTEGER NOT NULL DEFAULT 0,
    "penalties_saved" INTEGER NOT NULL DEFAULT 0,
    "penalties_missed" INTEGER NOT NULL DEFAULT 0,
    "yellow_cards" INTEGER NOT NULL DEFAULT 0,
    "red_cards" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "bonus" INTEGER NOT NULL DEFAULT 0,
    "bps" INTEGER NOT NULL DEFAULT 0,
    "explain" JSONB,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_player_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_computed_stats" (
    "id" SERIAL NOT NULL,
    "player_id" INTEGER NOT NULL,
    "points_per_90" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "goals_per_90" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "assists_per_90" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "xg_per_90" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "xa_per_90" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "xgi_per_90" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avg_5gw_points" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avg_5gw_minutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avg_5gw_xgi" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avg_10gw_points" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avg_10gw_minutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avg_10gw_xgi" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ppg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "games_played" INTEGER NOT NULL DEFAULT 0,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_computed_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_season_stats" (
    "id" SERIAL NOT NULL,
    "team_id" INTEGER NOT NULL,
    "split" TEXT NOT NULL,
    "played" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "goals_for" INTEGER NOT NULL DEFAULT 0,
    "goals_against" INTEGER NOT NULL DEFAULT 0,
    "goal_difference" INTEGER NOT NULL DEFAULT 0,
    "clean_sheets" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "xg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "xga" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "x_pts" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "xg_per_game" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "xga_per_game" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "goals_per_game" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_season_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_gameweek_stats" (
    "id" SERIAL NOT NULL,
    "team_id" INTEGER NOT NULL,
    "gameweek" INTEGER NOT NULL,
    "split" TEXT NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "goals_for" INTEGER NOT NULL DEFAULT 0,
    "goals_against" INTEGER NOT NULL DEFAULT 0,
    "clean_sheets" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "xg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "xga" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "x_pts" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "team_gameweek_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "managers" (
    "id" SERIAL NOT NULL,
    "fpl_id" INTEGER NOT NULL,
    "player_name" TEXT NOT NULL,
    "team_name" TEXT,
    "overall_points" INTEGER NOT NULL DEFAULT 0,
    "overall_rank" INTEGER NOT NULL DEFAULT 0,
    "is_top_10k" BOOLEAN NOT NULL DEFAULT false,
    "is_top_1k" BOOLEAN NOT NULL DEFAULT false,
    "is_top_100" BOOLEAN NOT NULL DEFAULT false,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_synced_gameweek" INTEGER,

    CONSTRAINT "managers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manager_gameweeks" (
    "id" SERIAL NOT NULL,
    "manager_id" INTEGER NOT NULL,
    "gameweek_id" INTEGER NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "total_points" INTEGER NOT NULL DEFAULT 0,
    "overall_rank" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "rank_sort" INTEGER,
    "event_transfers" INTEGER NOT NULL DEFAULT 0,
    "event_transfers_cost" INTEGER NOT NULL DEFAULT 0,
    "value" INTEGER NOT NULL DEFAULT 0,
    "bank" INTEGER NOT NULL DEFAULT 0,
    "active_chip" TEXT,
    "points_on_bench" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "manager_gameweeks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manager_picks" (
    "id" SERIAL NOT NULL,
    "manager_id" INTEGER NOT NULL,
    "gameweek_id" INTEGER NOT NULL,
    "player_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "is_captain" BOOLEAN NOT NULL DEFAULT false,
    "is_vice_captain" BOOLEAN NOT NULL DEFAULT false,
    "multiplier" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manager_picks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manager_transfers" (
    "id" SERIAL NOT NULL,
    "manager_id" INTEGER NOT NULL,
    "gameweek" INTEGER NOT NULL,
    "player_in_id" INTEGER NOT NULL,
    "player_out_id" INTEGER NOT NULL,
    "element_in_cost" INTEGER NOT NULL DEFAULT 0,
    "element_out_cost" INTEGER NOT NULL DEFAULT 0,
    "time" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manager_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manager_chips" (
    "id" SERIAL NOT NULL,
    "manager_id" INTEGER NOT NULL,
    "chip_name" TEXT NOT NULL,
    "gameweek" INTEGER NOT NULL,
    "time" TIMESTAMP(3),

    CONSTRAINT "manager_chips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manager_computed_stats" (
    "id" SERIAL NOT NULL,
    "manager_id" INTEGER NOT NULL,
    "gameweek_id" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manager_computed_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manager_season_stats" (
    "id" SERIAL NOT NULL,
    "manager_id" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manager_season_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ownership_data" (
    "id" SERIAL NOT NULL,
    "player_id" INTEGER NOT NULL,
    "gameweek_id" INTEGER NOT NULL,
    "tier" TEXT NOT NULL,
    "ownership_count" INTEGER NOT NULL DEFAULT 0,
    "ownership_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ownership_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cache_entries" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3),
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cache_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cron_job_logs" (
    "id" SERIAL NOT NULL,
    "job_name" TEXT NOT NULL,
    "gameweek" INTEGER,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "records_processed" INTEGER,
    "error_message" TEXT,

    CONSTRAINT "cron_job_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teams_fpl_id_key" ON "teams"("fpl_id");

-- CreateIndex
CREATE UNIQUE INDEX "teams_code_key" ON "teams"("code");

-- CreateIndex
CREATE UNIQUE INDEX "players_fpl_id_key" ON "players"("fpl_id");

-- CreateIndex
CREATE UNIQUE INDEX "players_code_key" ON "players"("code");

-- CreateIndex
CREATE INDEX "players_team_id_idx" ON "players"("team_id");

-- CreateIndex
CREATE INDEX "players_element_type_idx" ON "players"("element_type");

-- CreateIndex
CREATE UNIQUE INDEX "gameweeks_fpl_id_key" ON "gameweeks"("fpl_id");

-- CreateIndex
CREATE UNIQUE INDEX "fixtures_fpl_id_key" ON "fixtures"("fpl_id");

-- CreateIndex
CREATE INDEX "fixtures_gameweek_id_idx" ON "fixtures"("gameweek_id");

-- CreateIndex
CREATE INDEX "fixtures_home_team_id_idx" ON "fixtures"("home_team_id");

-- CreateIndex
CREATE INDEX "fixtures_away_team_id_idx" ON "fixtures"("away_team_id");

-- CreateIndex
CREATE INDEX "player_gameweek_stats_player_id_idx" ON "player_gameweek_stats"("player_id");

-- CreateIndex
CREATE INDEX "player_gameweek_stats_gameweek_idx" ON "player_gameweek_stats"("gameweek");

-- CreateIndex
CREATE UNIQUE INDEX "player_gameweek_stats_player_id_gameweek_key" ON "player_gameweek_stats"("player_id", "gameweek");

-- CreateIndex
CREATE INDEX "live_player_data_gameweek_id_idx" ON "live_player_data"("gameweek_id");

-- CreateIndex
CREATE UNIQUE INDEX "live_player_data_player_id_gameweek_id_key" ON "live_player_data"("player_id", "gameweek_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_computed_stats_player_id_key" ON "player_computed_stats"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_season_stats_team_id_split_key" ON "team_season_stats"("team_id", "split");

-- CreateIndex
CREATE INDEX "team_gameweek_stats_gameweek_idx" ON "team_gameweek_stats"("gameweek");

-- CreateIndex
CREATE UNIQUE INDEX "team_gameweek_stats_team_id_gameweek_split_key" ON "team_gameweek_stats"("team_id", "gameweek", "split");

-- CreateIndex
CREATE UNIQUE INDEX "managers_fpl_id_key" ON "managers"("fpl_id");

-- CreateIndex
CREATE INDEX "managers_overall_rank_idx" ON "managers"("overall_rank");

-- CreateIndex
CREATE INDEX "managers_is_top_10k_idx" ON "managers"("is_top_10k");

-- CreateIndex
CREATE INDEX "manager_gameweeks_manager_id_idx" ON "manager_gameweeks"("manager_id");

-- CreateIndex
CREATE INDEX "manager_gameweeks_gameweek_id_idx" ON "manager_gameweeks"("gameweek_id");

-- CreateIndex
CREATE UNIQUE INDEX "manager_gameweeks_manager_id_gameweek_id_key" ON "manager_gameweeks"("manager_id", "gameweek_id");

-- CreateIndex
CREATE INDEX "manager_picks_manager_id_gameweek_id_idx" ON "manager_picks"("manager_id", "gameweek_id");

-- CreateIndex
CREATE INDEX "manager_picks_player_id_gameweek_id_idx" ON "manager_picks"("player_id", "gameweek_id");

-- CreateIndex
CREATE UNIQUE INDEX "manager_picks_manager_id_gameweek_id_position_key" ON "manager_picks"("manager_id", "gameweek_id", "position");

-- CreateIndex
CREATE INDEX "manager_transfers_manager_id_idx" ON "manager_transfers"("manager_id");

-- CreateIndex
CREATE INDEX "manager_transfers_gameweek_idx" ON "manager_transfers"("gameweek");

-- CreateIndex
CREATE INDEX "manager_chips_manager_id_idx" ON "manager_chips"("manager_id");

-- CreateIndex
CREATE UNIQUE INDEX "manager_chips_manager_id_chip_name_gameweek_key" ON "manager_chips"("manager_id", "chip_name", "gameweek");

-- CreateIndex
CREATE INDEX "manager_computed_stats_manager_id_idx" ON "manager_computed_stats"("manager_id");

-- CreateIndex
CREATE UNIQUE INDEX "manager_computed_stats_manager_id_gameweek_id_key" ON "manager_computed_stats"("manager_id", "gameweek_id");

-- CreateIndex
CREATE UNIQUE INDEX "manager_season_stats_manager_id_key" ON "manager_season_stats"("manager_id");

-- CreateIndex
CREATE INDEX "ownership_data_gameweek_id_tier_idx" ON "ownership_data"("gameweek_id", "tier");

-- CreateIndex
CREATE UNIQUE INDEX "ownership_data_player_id_gameweek_id_tier_key" ON "ownership_data"("player_id", "gameweek_id", "tier");

-- CreateIndex
CREATE UNIQUE INDEX "cache_entries_key_key" ON "cache_entries"("key");

-- CreateIndex
CREATE INDEX "cache_entries_key_idx" ON "cache_entries"("key");

-- CreateIndex
CREATE INDEX "cache_entries_expires_at_idx" ON "cache_entries"("expires_at");

-- CreateIndex
CREATE INDEX "cron_job_logs_job_name_gameweek_idx" ON "cron_job_logs"("job_name", "gameweek");

-- CreateIndex
CREATE INDEX "cron_job_logs_started_at_idx" ON "cron_job_logs"("started_at");

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("fpl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_gameweek_id_fkey" FOREIGN KEY ("gameweek_id") REFERENCES "gameweeks"("fpl_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_home_team_id_fkey" FOREIGN KEY ("home_team_id") REFERENCES "teams"("fpl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_away_team_id_fkey" FOREIGN KEY ("away_team_id") REFERENCES "teams"("fpl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_player_data" ADD CONSTRAINT "live_player_data_gameweek_id_fkey" FOREIGN KEY ("gameweek_id") REFERENCES "gameweeks"("fpl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_computed_stats" ADD CONSTRAINT "player_computed_stats_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("fpl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_season_stats" ADD CONSTRAINT "team_season_stats_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("fpl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_gameweek_stats" ADD CONSTRAINT "team_gameweek_stats_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("fpl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_gameweeks" ADD CONSTRAINT "manager_gameweeks_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "managers"("fpl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_gameweeks" ADD CONSTRAINT "manager_gameweeks_gameweek_id_fkey" FOREIGN KEY ("gameweek_id") REFERENCES "gameweeks"("fpl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_picks" ADD CONSTRAINT "manager_picks_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "managers"("fpl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_picks" ADD CONSTRAINT "manager_picks_gameweek_id_fkey" FOREIGN KEY ("gameweek_id") REFERENCES "gameweeks"("fpl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_picks" ADD CONSTRAINT "manager_picks_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("fpl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_transfers" ADD CONSTRAINT "manager_transfers_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "managers"("fpl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_chips" ADD CONSTRAINT "manager_chips_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "managers"("fpl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_computed_stats" ADD CONSTRAINT "manager_computed_stats_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "managers"("fpl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_season_stats" ADD CONSTRAINT "manager_season_stats_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "managers"("fpl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownership_data" ADD CONSTRAINT "ownership_data_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("fpl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownership_data" ADD CONSTRAINT "ownership_data_gameweek_id_fkey" FOREIGN KEY ("gameweek_id") REFERENCES "gameweeks"("fpl_id") ON DELETE RESTRICT ON UPDATE CASCADE;
