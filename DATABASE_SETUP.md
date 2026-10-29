# Database setup and access contract

Production target: **NemmyKnowsMLv2**, `gebpwcieiaguxxbpmybh`, `us-east-2`, PostgreSQL 17.
Only that Supabase project is authorized. The older project is not a source or a migration target.
See [DATABASE_STATUS.md](DATABASE_STATUS.md) for executed validation and remaining data blockers.

## Install and verify

Use Python 3.12 or 3.13. Keep database tooling separate from model environments:

```sh
python -m venv .local/database-tools
# Activate this environment (Scripts/Activate.ps1 on Windows; bin/activate on Linux).
python -m pip install -r ops/database/requirements.txt
python ops/database/setup.py --plan
```

Supply `DATABASE_URL` securely in the environment. Do not put credentials in command arguments,
source files, output reports, or `NEXT_PUBLIC_*`. Use the direct database or session pooler,
not a transaction pooler, for migrations. The production guard checks both the project argument
and URL hostname/pooler username. `--local` accepts loopback hosts only and is for disposable tests.

```sh
python ops/database/setup.py --project-ref gebpwcieiaguxxbpmybh
python ops/database/validate.py --project-ref gebpwcieiaguxxbpmybh
# For a disposable PostgreSQL 17 database instead:
python ops/database/setup.py --local
python ops/database/validate.py --local
```

The runner installs shared Vault/pg_net prerequisites and `sql/001_site_revalidate.sql`, then MLB,
CFB, NFL, NHL and NBA. Local tests use an inert callback and test roles; the real callback has a
separate acceptance test in `sql/tests/revalidation.sql`. The runner uses explicit baseline chains,
LF-normalized SHA-256 checksums and a private `platform_setup.migrations` ledger. Non-NBA migration
errors roll back the transaction. NBA uses its existing Alembic system and fails the command on
error. Retry is safe: tracked SQL is not replayed, and changed applied SQL fails closed.

Existing schemas without the orchestration ledger (production NFL/NHL) are preserved only if their
catalog signatures match the audited contract. A discrepancy stops setup instead of replaying a
baseline or deleting data. `--sports mlb cfb` limits the selection. No setup command imports data.
For a future release, append a forward migration, test a fresh database and an upgrade, review
catalog changes, and update `expected.json`; do not regenerate expected hashes to hide unexplained drift.

After catalog/authorization validation, configure Supabase Data API exposed schemas to include
`mlb, cfb, nfl, nhl` alongside the existing `public, graphql_public`. **Exclude NBA and platform_setup**.
`ops/database/expose.sql` provides an explicit PostgREST role override and reload notifications;
it refuses to guess if there is no existing role override. Inspect the Dashboard's Data API settings
in that case. Production's MLB/CFB exposure change was explicitly approved and applied.

```sh
# Environment: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
python ops/database/api_probe.py
python -m pytest -q ops/database/tests
```

`validate.py` compares tables, columns, PK/FK/unique/check constraints, indexes, functions, triggers
and policies with `expected.json`, then probes reads and rejected inserts as both browser roles.
It also rejects every browser INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER grant. All probes
roll back. `inventory.sql`, `security-probes.sql` and `preserve.sql` support equivalent connector
audits without a direct connection. The preservation query returns only row counts and hashes.
The API probe verifies public table reads, three MLB/CFB RPCs, four denied writes and private-access
denials. Authenticated permissions are tested with PostgreSQL `SET ROLE`; this does not claim a
signed-in HTTP session test. CI runs a clean PostgreSQL 17 installation and repeat setup.

## Shared security and publishing

Every sport table has RLS. Browser roles receive SELECT only on explicit serving tables; they
cannot mutate data. Private objects may have no policy or no browser grant. Those are independent
controls. New MLB/CFB tables do not inherit blanket browser grants. Explicit default browser
function grants are revoked; future function migrations must still revoke PostgreSQL's default
PUBLIC execution explicitly before granting their intended callers. Current trigger functions
have pinned search paths and no public/browser execution; public read RPCs remain available.
Read views use security-invoker semantics. Model writers use server-side PostgreSQL connections;
the MLB live evaluation route alone uses `SUPABASE_SERVICE_ROLE_KEY` on the server.

The shared `SECURITY DEFINER` callback has an empty search path, qualified Vault/pg_net references,
and no PUBLIC/anon/authenticated execution. Provision `site_revalidate_url` and
`site_revalidate_secret` in Vault only when the website endpoint exists; the secret must match
`REVALIDATE_SECRET`. Never overwrite existing secrets as part of setup. Missing URL means no
callback. No production callback secrets or scheduler were invented by this installation.
`pg_cron` is not installed and no cron jobs are configured. Historical sport scheduling SQL targets
the upstream owner and is not part of the setup chain.

CFB stores pure forecasts, market-informed forecasts, decision-time adjustments, current decisions,
frozen recommendations and grading separately. Its forecast-input archives are local files, not
missing database tables. NFL input/revision archives and NHL recommendation scheduling remain
private. Missing provider credentials prevent ingestion, not schema installation.

## Baselines and migration selection

The machine-readable source of truth is [manifest.json](ops/database/manifest.json).
MLB's October 5 baseline already includes game type, prediction context, live win probability,
playoff forecasts and stage-specific keys. Do not replay those older SQL files. Apply the 12
post-baseline entries listed below, including player/prospect functionality omitted by the old README.
The obsolete posterior_skills table is removed by its upstream forward migration; posterior_sigmas remains.

CFB's October 5 baseline includes numbered migrations through 019. Apply 020–022 and all nine
timestamped releases listed below. Draft sections replace the legacy payload column. NFL installs
21 SQL files in filename order plus `sql/003_nfl_function_hardening.sql`; NHL installs 001–007 plus
`sql/002_nhl_function_hardening.sql`. The runner changes only the empty-install NFL index creation
from concurrent to ordinary creation, so the complete install is transactional. For busy existing
databases, use the upstream concurrent-index operation separately.

NBA uses Alembic 0001 → 0002 → 0003 → 0004 → 0005. Its SQLAlchemy engine translates unqualified
Core tables to `nba` on PostgreSQL and pins textual SQL to `nba, pg_catalog`; SQLite is unchanged.
The migration environment creates `nba` and puts its version ledger there. Foreign keys and
indexes follow the same namespace. Raw payload and observation snapshot triggers reject UPDATE,
DELETE and PostgreSQL TRUNCATE. Existing legacy NBA tables in `public` require an explicit reviewed
move; the environment refuses to silently abandon them. Production was installed from the
schema-only export of the successfully migrated local database, recorded at 0004, then upgraded
to 0005. Catalog signatures were compared afterward. No research rows accompanied that export.

## Optional data bootstrap

MLB's public schedule importer saves the original response and SHA-256 receipt under ignored
`output/database-bootstrap`. It keeps official dates and timestamps, resolves rescheduling only
through provider cross-references, preserves original start times for resumed games, and rejects
conflicting observations. Imports use `ON CONFLICT DO NOTHING`, preserving existing records.
It imports fixtures/results only; scoring, odds and probable-starter ingestion remain model jobs.

```sh
python ops/database/bootstrap_mlb.py --season 2026
# After reviewing the receipt; set DATABASE_URL and MLBMODEL_DB_WRITES=1 securely:
python ops/database/bootstrap_mlb.py --season 2026 --write --project-ref gebpwcieiaguxxbpmybh
```

For a connector-only import, `--source <saved-response> --emit-sql-dir .local/mlb-import` creates
reviewable, idempotent batches. Retain the original fetch receipt when replaying a response.
Full MLB scoring needs compatible posterior/simulator artifacts and provider data. CFB needs
`CFBD_API_KEY` before `poetry run python -m backend ingest --seasons 2026`; fitting and publication
then follow the sport README. Do not invent historical quotes or pregame observation timestamps.
NBA research archives stay local by default. A production NBA ingestion run is a separate deliberate
choice of `NBA_DATABASE_URL`; there is no frontend or bulk-upload step.

## Sport contracts

The following public/internal lists are exhaustive for base tables. NBA's count includes its
private Alembic ledger. Read views and RPCs are additional objects, not base tables.

### MLB

| Field | Contract |
|---|---|
| Schema | `mlb` |
| Baseline | `models/mlb/backend/sql/baseline/2026_10_05.sql` |
| Post-baseline migrations | interval_coverage_population.sql, live_evaluation_reconciliation.sql, history_record_bounds.sql, 20261007171918_mlb_live_evaluation_completion.sql, 20261016210000_mlb_player_contracts.sql, 20261016213000_mlb_player_values.sql, 20261017000000_drop_posterior_skills.sql, 20261020180000_mlb_player_details.sql, 20261020220000_mlb_player_values_drop_details.sql, 20261022120000_mlb_prospect_values.sql, 20261024120000_mlb_prospect_stuff.sql, betting_headline.sql |
| Table count | 30 |
| Public tables | games, model_outputs, model_outputs_season, model_outputs_season_v1_archive, model_evaluation, model_calibration, model_edge_buckets, posterior_sigmas, live_win_probability, playoff_forecasts, player_values, player_details, player_traits, prospect_values |
| Internal tables | bullpen_daily, bullpen_stats, experiment_runs, live_evaluation_completions, model_feature_importance, model_outputs_v1_archive, odds, park_factors, pitcher_stats, pitcher_workload, player_contracts, player_value_models, probable_starters, prospect_models, team_batting, weather |
| Writer | backend/db.py, pipeline.py and v2 publication modules; server MLB live evaluation route |
| Reader | Root src/lib/supabase.ts and mlb pages/API routes; browser roles are read-only |
| RLS model | RLS plus explicit SELECT grants; private tables are denied by grants and/or no policy |
| Required env vars | DATABASE_URL, MLBMODEL_DB_WRITES=1; ODDS_API_KEY and compatible model artifacts for scoring |
| Bootstrap command | From root: python ops/database/bootstrap_mlb.py --season 2026; optional guarded --write |
| Verification command | Root: python ops/database/validate.py --project-ref gebpwcieiaguxxbpmybh; local: --local. API: python ops/database/api_probe.py |

### CFB

| Field | Contract |
|---|---|
| Schema | `cfb` |
| Baseline | `models/cfb/sql/baseline/2026_10_05.sql` |
| Post-baseline migrations | 020_decision_forecast.sql, 021_site_revalidate.sql, 022_draft_publications.sql, 20261007224645_draft_publication_seven_rounds.sql, 20261012190441_moneyline_pricing_context.sql, 20261012224346_player_opponent_prior_meta.sql, 20261016200339_position_traits.sql, 20261016235900_position_traits_site_revalidate.sql, 20261018015738_cfb_playoff_forecasts.sql, 20261019183818_current_recommendations.sql, 20261020204856_draft_publication_sections.sql, 20261020214846_drop_draft_publication_payload.sql |
| Table count | 20 |
| Public tables | teams, team_ratings, team_unit_ratings, game_projections, market_comparisons, recommendations, recommendation_decisions, graded_games, backtest_predictions, performance_metrics, player_values, player_model_meta, heisman_board, heisman_history, position_traits, playoff_forecasts, draft_publications, live_win_probability, serving_anchors |
| Internal tables | qb_availability |
| Writer | backend/publish.py, serving/live_publish.py, draft/publish.py, playoffs/publish.py |
| Reader | Root src/lib/supabase.ts and cfb pages/API routes; browser roles are read-only |
| RLS model | RLS plus explicit SELECT grants; private tables are denied by grants and/or no policy |
| Required env vars | DATABASE_URL, MOMENTUMCFB_DB_WRITES=1, CFBD_API_KEY, ODDS_API_KEY |
| Bootstrap command | From models/cfb: poetry run python -m backend ingest --seasons 2026; credential required |
| Verification command | Root: python ops/database/validate.py --project-ref gebpwcieiaguxxbpmybh; local: --local. API: python ops/database/api_probe.py |

### NFL

| Field | Contract |
|---|---|
| Schema | `nfl` |
| Baseline | `models/nfl/sql/001_nfl_schema.sql` |
| Post-baseline migrations | 002_market_snapshots.sql, 003_season_win_totals.sql, 004_live_forecasts.sql, 005_awards.sql, 006_recommendations.sql, 007_forecast_replay.sql, 008_recommendation_market_total.sql, 009_recommendation_edge_points.sql, 010_recommendation_h2h_weight_floor.sql, 011_award_season_stats.sql, 012_recommendation_qb_refresh.sql, 013_live_win_probability.sql, 014_projection_market_informed_scores.sql, 015_team_rating_forecast_alignment.sql, 016_recommendation_published_total.sql, 018_site_revalidate.sql, 019_performance_grading.sql, 020_position_traits.sql, 20261007171916_nfl_award_board_order.sql, 20261018033037_nfl_playoff_forecasts.sql |
| Table count | 22 |
| Public tables | award_boards, award_model_meta, backtest_predictions, forecast_snapshots, game_projections, game_results, graded_games, live_win_probability, market_comparisons, market_snapshots, performance_metrics, playoff_forecasts, position_traits, recommendations, season_win_totals, team_ratings, team_unit_ratings, teams |
| Internal tables | forecast_input_objects, forecast_input_runs, recommendation_revisions, recommendation_schedule |
| Writer | backend/publish.py, live_publish.py, playoffs/publish.py |
| Reader | Root src/lib/supabase.ts and nfl pages/API routes; browser roles are read-only |
| RLS model | RLS plus explicit SELECT grants; private tables are denied by grants and/or no policy |
| Required env vars | DATABASE_URL, MOMENTUMNFL_DB_WRITES=1 (or GitHub Actions); ODDS_API_KEY and bookmaker selection for market jobs |
| Bootstrap command | Existing manual NFL data bootstrap workflow; see SETUP.md for verified prior import |
| Verification command | Root: python ops/database/validate.py --project-ref gebpwcieiaguxxbpmybh; local: --local. API: python ops/database/api_probe.py |

### NHL

| Field | Contract |
|---|---|
| Schema | `nhl` |
| Baseline | `models/nhl/sql/001_nhl_schema.sql` |
| Post-baseline migrations | 002_quote_verification.sql, 003_snapshot_quote_evidence.sql, 004_live_win_probability.sql, 005_snapshot_lookup.sql, 006_market_anchored_forecast.sql, 007_closing_lines.sql |
| Table count | 10 |
| Public tables | backtest_predictions, forecast_snapshots, game_projections, game_results, live_win_probability, market_snapshots, recommendations, team_ratings, teams |
| Internal tables | recommendation_schedule |
| Writer | backend/publish.py and live_publish.py |
| Reader | Root src/lib/supabase.ts and nhl pages/API routes; browser roles are read-only |
| RLS model | RLS plus explicit SELECT grants; private tables are denied by grants and/or no policy |
| Required env vars | DATABASE_URL, MOMENTUMNHL_DB_WRITES=1 (or GitHub Actions); public NHL/MoneyPuck feeds |
| Bootstrap command | From models/nhl: poetry run python -m backend daily --no-publish; review before enabling writes |
| Verification command | Root: python ops/database/validate.py --project-ref gebpwcieiaguxxbpmybh; local: --local. API: python ops/database/api_probe.py |

### NBA

| Field | Contract |
|---|---|
| Schema | `nba` |
| Baseline | `Alembic 0001_nba.py` |
| Post-baseline migrations | 0002_snapshots.py, 0003_lineup_stints.py, 0004_private_schema.py, 0005_foreign_key_indexes.py |
| Table count | 24 (23 application + alembic_version) |
| Public tables | None |
| Internal tables | alembic_version, games, halftime_features, halftime_predictions, injury_snapshots, lineup_snapshots, lineup_stints, market_snapshots, player_game_stats, player_ratings, players, pregame_availability, pregame_features, pregame_predictions, projected_minutes, quality_issues, raw_injury_reports, raw_market_payloads, raw_nba_payloads, rotation_stints, source_game_mappings, team_game_stats, team_ratings, teams |
| Writer | src/db.py and src.cli; owner connection; no public publisher |
| Reader | Local/internal research only |
| RLS model | All tables RLS; owner writer, no browser grants/policies |
| Required env vars | NBA_DATABASE_URL for PostgreSQL; unset for SQLite; NBA_DATA_DIR optionally; no separate NBA write switch |
| Bootstrap command | From models/nba: python -m src.cli migrate; optional local backfill-games --start-season 2023 --end-season 2023; no automatic production upload |
| Verification command | From models/nba: python -m pytest -q tests/test_database.py; NBA_TEST_DATABASE_URL selects disposable localhost PostgreSQL alongside SQLite |

## Test environments

Run each sport from its own directory/environment. CFB/NFL/NHL use Python 3.12 and their Poetry lockfiles; MLB uses Python 3.13; NBA supports 3.12/3.13. On Windows set `PYTHONUTF8=1` so UTF-8 fixture characters match Linux CI. Set `MLB_TEST_DATABASE_URL`, `CFB_TEST_DATABASE_URL`, `NFL_TEST_DATABASE_URL`, `NHL_TEST_DATABASE_URL`, or `NBA_TEST_DATABASE_URL` only to disposable localhost databases. Production fixtures and research data must never be test targets.
