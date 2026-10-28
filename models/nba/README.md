# NBA research pipeline

Independent Python package for pregame and halftime NBA forecasting. It does not change the existing website or other sports. V1 validation is in progress; timestamped historical markets remain a data blocker. Do not use the preliminary outputs as validated betting recommendations.

## Fresh setup

Use Python 3.12 or 3.13. From this directory:

```powershell
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
.venv/Scripts/python -m src.cli migrate
.venv/Scripts/python -m pytest -q --basetemp data/test-tmp
```

On Linux/macOS use `.venv/bin/python`. SQLite is the local default. For PostgreSQL, set `NBA_DB_PASSWORD`, run `docker compose up -d`, and set `NBA_DATABASE_URL=postgresql+psycopg://nba:PASSWORD@localhost:5434/nba` before migration. Never commit passwords. GitHub Actions runs the migration/immutability test against PostgreSQL 17. Docker must be running for the Compose option.

## Reproduce

Run each command from `models/nba`, using the virtual environment Python:

```text
python -m src.cli migrate
python -m src.cli backfill-games --start-season 2020 --end-season 2023
python -m src.cli backfill-boxes --start-season 2020 --end-season 2023
python -m src.cli audit-halftime
python -m src.cli backfill-injuries --start-season 2021 --end-season 2023 --limit-per-season 5
python -m src.cli backfill-markets
python -m src.cli build-rotations
python -m src.cli build-pregame-features
python -m src.cli evaluate-all
python -m src.cli validate-outputs
python -m src.cli coverage
```

The season is its starting year: `2023` means 2023–24. Use `--limit-per-season 120` for an initial smoke cohort. Game backfill resumes existing IDs; `--refresh` explicitly rebuilds canonical games. Injury hubs may serve current reports even at historical URLs. The backfill filters links by requested season and falls back to dated PDFs before observed game times. An explicit report can be ingested using `backfill-injuries --report-time 2023-10-24T17:00:00-04:00`. The PDF header, not this requested filename, supplies the report's actual publication time.

The rating and feature CLI aliases currently rebuild the shared causal dataset. The train/evaluate aliases run the complete walk-forward evaluation. `validate-outputs` checks actual saved predictions, cutoff ordering, minute conservation, artifact hashes and reproduction of the holdout predictions from the serialized model. Run database writers serially. Rebuilding derived rotations/features is safe; raw and snapshot observations are append-only. Changing raw parsing requires a versioned snapshot identity.

## Architecture and outputs

- `storage.py`: SHA-256 object storage, immutable observation receipts, retries and pinned-resource caching.
- `sources.py`, `box_fallback.py`, `injuries.py`, `markets.py`: adapters, canonical crosswalks and provenance. Failed joins and score discrepancies are quarantined.
- `db.py`, `migrations/`: relational catalog, entity/time indexes and immutable raw/snapshot triggers.
- `rotations.py`, `minutes.py`: five-player stint reconstruction, independent minutes validation, net ridge RAPM and bounded 240/120-minute projections.
- `features.py`: chronological Elo, adjusted team strength, prior-only player ratings and pregame/halftime datasets.
- `modeling.py`: season walk-forward P0–P4/H0–H6 comparisons and earlier-fold model selection. The last season never selects the winning feature group.

Local ignored outputs live under `data/`: `raw/` observations, `nba.sqlite`, `derived/dataset.json`, `reports/evaluation.json`, `reports/predictions.parquet`, coverage reports, and `artifacts/pregame.joblib` with a feature/training-season/hash manifest. The saved model reproduces the last holdout and is not refit on it. Only load trusted locally generated joblib artifacts. No raw third-party dataset is committed.

## Integrity and coverage limitations

The validated archive path currently targets 2020–24. Earlier seasons can be requested, but missing CDN timestamp archives are reported rather than assigned invented timestamps. Official NBA box requests returned HTTP 403 in this environment. The fallback uses public ESPN/hoopR boxes, joining team IDs, local date, scheduled time and exact final score; player IDs require unambiguous game-specific name matches. Rounded ESPN minutes permit a 90-second per-player tolerance; regulation team minutes must still equal 240.

All rating observations must finish strictly before the target cutoff. Full-game history is additionally withheld until the latest recorded event edit; missing edit timestamps exclude it from rating history. Monthly rating snapshots predate tipoff. Actual target-game starters and full-game minutes are never pregame inputs. Missing injury coverage is explicitly flagged; unknown roster availability uses a prior-minute baseline. Uncertain injury statuses use categorical empirical probabilities from prior validated outcomes, with Beta(1,1) smoothing and a neutral prior when observations are absent. Projected starters are prior-minute leaders, not confirmed starters.

Halftime inputs use Q1/Q2 only, with Q3/Q4 labels excluding overtime. NBA archives are retrospective and frequently contain later edits. The timestamp audit excludes first-half records edited after the Q2-end cutoff or lacking timestamps. This gate does not certify that two different archived feeds were identical to a live feed at that time; an original as-received archive is still preferable.

Historical SBR lines lack trustworthy quote-availability timestamps. They are normalized and retained but excluded from strict features and market benchmarks. Present-day ESPN/Action collections preserve collection time and cannot be backdated into old games. P4 and market-conditioned halftime comparisons report unavailable when coverage is inadequate; no synthetic historical quotes are substituted.

Possessions use a box-score approximation; paint/fast-break/second-chance fields are description-derived proxies. RAPM is net-only and regularized. Rosters use the previous ten team games and the latest eligible team appearance to resolve trades; they are not an authoritative transaction feed. Half win probabilities use training-residual Normal approximations and are not claimed calibrated. H3–H6 comparisons omit missing market priors and explicitly report that limitation. With sufficient market coverage, halftime groups share the same market-covered cohort. Full shot-quality models, true possessions, sportsbook H2 history and deployment remain in the root future-development document.

See [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md) for pinned sources and licensing boundaries, and [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for remaining verification.
