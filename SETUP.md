# Running NemmyKnowsMLv2

## Website and database

1. Install Node.js 22+, run `npm ci`, and copy `.env.example` to `.env.local`.
2. Create your own Supabase project. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; set `NEXT_PUBLIC_SITE_URL` to the website origin when deployed.
3. Install `sql/001_site_revalidate.sql` before sport schemas. It requires Vault and pg_net. Provision Vault's `site_revalidate_secret` to match the website's `REVALIDATE_SECRET`, and `site_revalidate_url` to your full `https://<your-domain>/api/revalidate` endpoint. Without the URL the trigger performs no callback.
4. Restore sport schemas using each model README's migration order. CFB includes `models/cfb/sql/baseline/2026_10_05.sql` plus subsequent migrations; NFL and NHL have numbered `sql/` migrations. MLB includes `models/mlb/backend/sql/baseline/2026_10_05.sql` plus later migrations. Do not blindly apply every historical SQL file on top of a baseline.
5. Expose `mlb`, `cfb`, `nfl`, and `nhl` through the Supabase Data API with the supplied read-only grants and row policies. Publish model outputs into matching schemas.
6. Run `npm run dev`, or `npm run build` followed by `npm start`.

Use your own database credentials. The frontend service-role key enables writes during MLB live grading. Historical performance requires importing or generating historical rows; the code does not copy them from the original site.

## Python models

Run each model in its own directory and environment. All four use a module named `backend`, so do not combine their environments or invoke them from the repository root.

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
poetry run python -m backend.cli --help
poetry run pytest -q
```

Copy that model's `.env.example` to `.env`. All require `DATABASE_URL` for publication. NFL also requires `ODDS_API_KEY` and explicit bookmaker selection. CFB requires `CFBD_API_KEY` and `ODDS_API_KEY`. NHL reads MoneyPuck/NHL feeds and includes static coefficients; it still needs input caches and database initialization. Follow original READMEs for ingestion, fitting, validation, and publication. Local write switches are `MOMENTUMNFL_DB_WRITES`, `MOMENTUMCFB_DB_WRITES`, and `MOMENTUMNHL_DB_WRITES`.

## Automation and hosting

Deploy the root as a Next.js project and configure its environment variables. Deploy model jobs separately with their own working directories, caches, and secrets. Original production workflows under `models/<sport>/.github/workflows` are inactive reference files. Before promoting one to root `.github/workflows`, adapt run directories, cache/artifact paths, local action paths, and hard-coded repository/dispatch URLs. Review `ops/` SQL cron definitions too: they target the original owner's workflows.

Root `model-*-ci.yml` workflows adapt upstream verification only. They use disposable PostgreSQL without production secrets. Frontend CI verifies the callback contract and production build.

API subscriptions, database setup, model artifact training/import, production schedules, and hosting are separate from source copying. None are provisioned by creating the repository.
