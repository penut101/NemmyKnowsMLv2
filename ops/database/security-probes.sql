DO $$ DECLARE t record; r text; readable boolean; allowed boolean; BEGIN
FOR t IN SELECT n.nspname s,c.relname n,c.oid,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('mlb','cfb','nfl','nhl','nba') AND c.relkind='r' LOOP
 IF NOT t.relrowsecurity THEN RAISE EXCEPTION 'RLS missing %.%',t.s,t.n; END IF;
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF has_table_privilege(r,t.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN RAISE EXCEPTION 'Write grants %.% %',t.s,t.n,r; END IF;
  allowed := t.s||'.'||t.n = ANY(ARRAY['mlb.games','mlb.model_outputs','mlb.model_outputs_season','mlb.model_outputs_season_v1_archive','mlb.model_evaluation','mlb.model_calibration','mlb.model_edge_buckets','mlb.posterior_sigmas','mlb.live_win_probability','mlb.playoff_forecasts','mlb.player_values','mlb.player_details','mlb.player_traits','mlb.prospect_values','cfb.teams','cfb.team_ratings','cfb.team_unit_ratings','cfb.game_projections','cfb.market_comparisons','cfb.recommendations','cfb.recommendation_decisions','cfb.graded_games','cfb.backtest_predictions','cfb.performance_metrics','cfb.player_values','cfb.player_model_meta','cfb.heisman_board','cfb.heisman_history','cfb.position_traits','cfb.playoff_forecasts','cfb.draft_publications','cfb.live_win_probability','cfb.serving_anchors','nfl.award_boards','nfl.award_model_meta','nfl.backtest_predictions','nfl.forecast_snapshots','nfl.game_projections','nfl.game_results','nfl.graded_games','nfl.live_win_probability','nfl.market_comparisons','nfl.market_snapshots','nfl.performance_metrics','nfl.playoff_forecasts','nfl.position_traits','nfl.recommendations','nfl.season_win_totals','nfl.team_ratings','nfl.team_unit_ratings','nfl.teams','nhl.backtest_predictions','nhl.forecast_snapshots','nhl.game_projections','nhl.game_results','nhl.live_win_probability','nhl.market_snapshots','nhl.recommendations','nhl.team_ratings','nhl.teams']);
  BEGIN
   EXECUTE format('SET LOCAL ROLE %I',r);
   EXECUTE format('SELECT EXISTS(SELECT FROM %I.%I LIMIT 1)',t.s,t.n) INTO readable;
   RESET ROLE;
   IF NOT allowed AND readable THEN RAISE EXCEPTION 'Private data visible %.%',t.s,t.n; END IF;
  EXCEPTION WHEN insufficient_privilege THEN
   RESET ROLE;
   IF allowed THEN RAISE EXCEPTION 'Public read denied %.% %',t.s,t.n,r; END IF;
  END;
  BEGIN
   EXECUTE format('SET LOCAL ROLE %I',r);
   EXECUTE format('INSERT INTO %I.%I DEFAULT VALUES',t.s,t.n);
   RESET ROLE;
   RAISE EXCEPTION 'Browser write succeeded %.%',t.s,t.n;
  EXCEPTION WHEN insufficient_privilege THEN RESET ROLE;
  END;
 END LOOP;
END LOOP;
END $$;
SELECT 'All 424 browser role probes passed' AS result;
