# Running NemmyKnowsMLv2

## Website and database

1. Install Node.js 22+, run `npm ci`, and copy `.env.example` to `.env.local`.
2. Use the existing Supabase project `gebpwcieiaguxxbpmybh` (NemmyKnowsMLv2, us-east-2, PostgreSQL 17). Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; set `NEXT_PUBLIC_SITE_URL` to the website origin when deployed. Do not operate on the older Supabase project.
3. Install `sql/001_site_revalidate.sql` before sport schemas. It requires Vault and pg_net. Provision Vault's `site_revalidate_secret` to match the website's `REVALIDATE_SECRET`, and `site_revalidate_url` to your full `https://<your-domain>/api/revalidate` endpoint. Without the URL the trigger performs no callback.
4. All five sport schemas are installed. Use [DATABASE_SETUP.md](DATABASE_SETUP.md) and `ops/database/manifest.json` for the complete migration chains, explicit permissions, and fresh PostgreSQL setup. Older sport README lists omit newer releases. Do not replay baselines over existing schemas.
5. `mlb`, `cfb`, `nfl`, and `nhl` are exposed through the Data API with verified read-only browser access. NBA is private. Publish reviewed model outputs into matching schemas; schema installation does not generate forecasts.
6. Run `npm run dev`, or `npm run build` followed by `npm start`.

Use your own database credentials. The frontend service-role key enables writes during MLB live grading. Historical performance requires importing or generating historical rows; the code does not copy them from the original site.

## Python models

Run each model in its own directory and environment. MLB, CFB, NFL and NHL use a module named `backend`; NBA uses `src`. Do not combine model environments or invoke their modules from the repository root. On Windows set `PYTHONUTF8=1` when running cross-platform tests.

### MLB

Use Python 3.13 as in upstream CI (Linux/WSL is preferable for the Bayesian stack):

```sh
cd models/mlb
python -m venv .venv
# Activate .venv with your shell's activation command.
python -m pip install -c constraints.txt -r requirements.txt -r v2/requirements.txt
python -m pip install --no-deps -e .
```

Set `DATABASE_URL` and required provider credentials, including `ODDS_API_KEY`. Rebuild the Statcast cache and train the Bayesian skill layer with the original documented commands, or obtain compatible posterior artifacts from the owner. Preserve pinned JAX/NumPyro versions and artifact validation. `MLBMODEL_DB_WRITES=1` enables local publication. Daily scoring requires posterior and data artifacts.

### NFL, CFB, NHL

Each requires Python 3.11 or 3.12 (upstream CI uses 3.12) and Poetry. For each sport:

```sh
cd models/nfl # or models/cfb, models/nhl
poetry env use python3.12
poetry sync --no-interaction
poetry run python -m backend --help
poetry run pytest -q
```

Copy that model's `.env.example` to `.env`. All require `DATABASE_URL` for publication. NFL also requires `ODDS_API_KEY` and explicit bookmaker selection. CFB requires `CFBD_API_KEY` and `ODDS_API_KEY`. NHL reads MoneyPuck/NHL feeds and includes static coefficients; it still needs input caches and database initialization. Follow original READMEs for ingestion, fitting, validation, and publication. Local write switches are `MOMENTUMNFL_DB_WRITES`, `MOMENTUMCFB_DB_WRITES`, and `MOMENTUMNHL_DB_WRITES`.

## Automation and hosting

Deploy the root as a Next.js project and configure its environment variables. Deploy model jobs separately with their own working directories, caches, and secrets. Original production workflows under `models/<sport>/.github/workflows` are inactive reference files. Before promoting one to root `.github/workflows`, adapt run directories, cache/artifact paths, local action paths, and hard-coded repository/dispatch URLs. Review `ops/` SQL cron definitions too: they target the original owner's workflows.

Root `model-*-ci.yml` workflows adapt upstream verification only. They use disposable PostgreSQL without production secrets. Frontend CI verifies the callback contract and production build.

API subscriptions, model artifact training/import, production schedules, and hosting are separate from schema setup. Database installation is complete; see [DATABASE_STATUS.md](DATABASE_STATUS.md) for verified data and remaining external dependencies.

## Independent setup progress (2026-10-26)

The separate Supabase project `NemmyKnowsMLv2` is provisioned in `penut101's Org`, region `us-east-2`, reference `gebpwcieiaguxxbpmybh`. The existing project is untouched. The shared revalidation function and all seven NHL migrations are installed. Revalidation remains inactive until a website URL and secret are configured in Vault.

The manual **NHL data bootstrap** GitHub Actions workflow downloads public inputs and runs the original model without database writes. It saves the input caches, unpublished forecasts, and source receipts as a seven-day artifact. It uses no private provider keys. A successful run is required before claiming current forecasts are available; publication and recurring scheduling are separate steps.

The first run succeeded: https://github.com/penut101/NemmyKnowsMLv2/actions/runs/40419868880. Its 32 teams, 32 ratings, and 46 game forecasts were imported into the new NHL schema after checking the replay receipt hash. Betting recommendations were not imported from this delayed bootstrap. The NHL schema is exposed through the Data API. Apply `sql/002_nhl_function_hardening.sql` after NHL migrations to pin trigger function search paths; the shared callback also explicitly revokes execution from visitor roles. All ten NHL tables have RLS enabled and visitors have no insert privilege. Supabase reports an informational deny-by-default policy notice for the internal recommendation schedule and a warning about the non-relocatable pg_net extension's public installation.

Provider key entry: `.env.providers.local` is a local, Git-ignored staging file. Set `ODDS_API_KEY` to your existing key. Request your own `CFBD_API_KEY` at https://collegefootballdata.com/key. Both placeholders were empty during the database audit. Configure them in each applicable model environment and GitHub Actions secrets before credentialed jobs run. Do not commit this file or paste keys into chat. MLB and CFB schemas are installed; credentialed ingestion, production scheduling, website configuration and hosting remain separate work.

### NFL bootstrap completed

The manual **NFL data bootstrap** workflow succeeded on 2026-10-26:
https://github.com/penut101/NemmyKnowsMLv2/actions/runs/40420816757.
It rebuilt 2015–2025 historical team/QB features through nflreadpy/nflverse, ingested 2026 inputs, generated fixed-model pricing and retrospective artifacts, fit Week 7, and calculated season wins. It does not call The Odds API or publish recommendations. Forecasts may still use schedule-provided market lines and static preseason inputs; this is not a market-free model.

All 21 NFL SQL files have been installed in the new project in filename order, plus `sql/003_nfl_function_hardening.sql`. For initial empty-database installation via transaction-based migration tools, create the `award_boards_snapshot_rank_idx` index without `CONCURRENTLY`; retain concurrent creation for an existing busy database. The NFL Data API is exposed. All 22 NFL tables have RLS and no visitor insert permission; internal archive/revision tables intentionally have no public read policy.

Validated output: 32 teams, 32 team ratings, 32 unit ratings, 32 season-win estimates, and 14 weekly projections. Every present file in the forecast replay archive passed its SHA-256 check. Only the one game still upcoming at import time was inserted into `game_projections`; its pregame snapshot was created by the database. Completed-game projections were excluded, not backfilled into prospective performance. Read-back checks and public Data API requests confirmed the serving rows. The retrospective calibration artifact contains 2,761 games; its historical benchmarks are not prospective betting results.

The first run's output is also saved locally under `output/nfl-bootstrap/`. Remote artifacts expire after seven days. Subsequent workflow runs save outputs for review; database publication is not yet automated. Remaining NFL work: configure your Odds API key and available bookmakers when ready, set up a dedicated publisher and refresh/grading schedule, connect and deploy the website, and separately run optional awards/player-trait/playoff models.

## Database completion (audited 2026-10-29)

Installed base-table counts: MLB 30, CFB 20, NFL 22, NHL 10, NBA 23 application tables plus one Alembic ledger. All 106 tables have RLS. Catalog signatures match a clean PostgreSQL 17 installation. NFL/NHL row counts and fingerprints are unchanged. The public MLB schedule bootstrap imported 2,472 unique 2026 fixtures/results; CFB has no fabricated provider rows. NBA research data remains local.

NBA uses SQLite by default. Set `NBA_DATABASE_URL` only for deliberate PostgreSQL use, then run `python -m src.cli migrate` from `models/nba`. PostgreSQL objects and Alembic state live in the private `nba` schema; current revision is `0005`. Browser roles have no NBA schema access. Raw and snapshot data remain immutable.

Verification: `python ops/database/validate.py --project-ref gebpwcieiaguxxbpmybh`, `python ops/database/api_probe.py`, and the per-sport commands in [DATABASE_SETUP.md](DATABASE_SETUP.md). The new database-platform CI installs all sports from zero, verifies permissions, and repeats setup. NFL/NHL CI now use PostgreSQL 17.

The shared callback is installed and hardened but inactive until `site_revalidate_url` and `site_revalidate_secret` are provisioned in Vault. No cron jobs or production schedules were added. Provider credentials, MLB trained artifacts, NBA historical market timestamps, and deployment configuration remain external prerequisites; see [DATABASE_STATUS.md](DATABASE_STATUS.md).
