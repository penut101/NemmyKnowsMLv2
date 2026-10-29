# Database status

Audited 2026-10-29 against `gebpwcieiaguxxbpmybh` (NemmyKnowsMLv2, us-east-2,
PostgreSQL 17.11). Implementation began at repository HEAD `f974326`.
The older Supabase project was not queried, copied from, or modified.

| Sport | Schema installed | Data bootstrapped | RLS verified | API verified | Publisher verified | Blocker |
|---|---|---|---|---|---|---|
| MLB | Yes, 30 tables | 2,472 official 2026 fixtures/results; no generated predictions | Yes | Anonymous serving reads/RPCs; writes denied | Local publication/reconciliation acceptance passed; production schedule import/readback passed | ODDS_API_KEY empty; compatible posterior/simulator artifacts needed for scoring |
| CFB | Yes, 20 tables | No provider rows fabricated | Yes | Anonymous serving reads/RPC; writes denied | Local forecast/decision/schema guard tests passed | CFBD_API_KEY and ODDS_API_KEY empty |
| NFL | Preserved, 22 tables | Prior bootstrap preserved: 32 teams, 32 ratings, 32 unit ratings, 32 season estimates, 1 projection and 1 frozen snapshot | Yes | Serving reads; writes denied | Local database publication, grading and archive tests passed | Production market jobs need key/bookmaker selection and scheduling |
| NHL | Preserved, 10 tables | Prior bootstrap preserved: 32 teams, 32 ratings, 46 projections and 46 snapshots | Yes | Serving reads; writes denied | Local publication, write guard and PostgreSQL quote-evidence tests passed | Recurring publication/grading and website configuration remain separate |
| NBA | Yes, 23 application tables + private Alembic ledger | Intentionally empty in production; research archive stays local | Yes | Schema access denied as intended | SQLite/PostgreSQL writer, FK, migration and immutability tests passed | Historical timestamped markets still block research V1 acceptance; no NBA frontend exists |

## Migration evidence

MLB and CFB use their October 5 baselines plus every current post-baseline release in
`ops/database/manifest.json`. NFL's 21 SQL files and NHL's seven SQL files were already represented:
their tables, columns, constraints, indexes, triggers and function bodies matched the clean reference.
Only unnecessary browser/PUBLIC execution of existing trigger functions and permissive future
explicit grants were tightened; no NFL/NHL tables were rebuilt. All 32 existing table row counts
and content fingerprints matched before and after.

New Supabase migrations applied:

| Version | Migration |
|---|---|
| 20261028193520 | mlb_current_schema_and_explicit_permissions |
| 20261028193549 | cfb_current_schema_and_explicit_permissions |
| 20261028193615 | nba_alembic_0004_private_production_catalog |
| 20261028193620 | existing_sports_trigger_execution_least_privilege |
| 20261028193827 | approved_mlb_cfb_data_api_exposure |
| 20261028194139 | nba_0005_foreign_key_indexes |
| 20261028194601 | portable_lf_migration_checksums |

Production NBA was installed using a schema-only export of the tested Alembic catalog; no local
research data was copied. Its ledger records `0005`. Subsequent setup delegates to Alembic.
All five final production catalog signatures match `ops/database/expected.json`, covering tables,
columns, constraints, indexes, functions, triggers and policies. The orchestration ledger is private.

## Data provenance

The official MLB Stats API schedule was fetched at `2026-10-28T19:41:05.020858+00:00`:

`https://statsapi.mlb.com/api/v1/schedule?sportId=1&season=2026&gameTypes=R%2CF%2CD%2CL%2CW&hydrate=team%2CprobablePitcher%28note%29%2Cvenue`

Response SHA-256: `f5d5ca330844b2a238f71b399390f144cd44eedd1f1175fadee91b5b5060a558`.
The response contains 2,502 listings and 2,472 unique games after explicit provider reschedule/resume
references are resolved. Production readback confirmed 2,472 games, including 2,468 finals.
Official dates, scores, statuses and start times are retained. No historical market timestamps,
model outputs or pregame decisions were invented. Raw response and receipts remain in ignored
`output/database-bootstrap/`; only this receipt summary is tracked. Existing rows are protected
by the importer's conflict-do-nothing behavior.

## Tests executed

| Check | Result |
|---|---|
| Empty PostgreSQL 17 → all five current schemas | Passed |
| Repeat setup with migration checksums | Passed |
| Catalog signature and permission validation | Passed; 424 role probes |
| Shared callback payload, missing-URL behavior and PUBLIC execution denial | Passed (`sql/tests/revalidation.sql`, isolated database) |
| Production anonymous + authenticated PostgreSQL role probes | Passed; 424 read/write probes across all 106 tables |
| Production HTTP Data API | Passed; 60 table reads, 3 RPCs, 4 denied writes, 3 private-access denials |
| NFL/NHL preservation | Passed; all 32 table counts and row-content fingerprints unchanged |
| Orchestration target guards, migration coverage, fixture normalization, existing-schema preservation and checksum safety | 6 passed |
| MLB write guard/publication/reconciliation | 3 passed |
| CFB publication, decision persistence and write guards | 7 passed |
| NFL publication, grading, write guards and replay archive | 8 passed |
| NHL publication/write guards + quote evidence including PostgreSQL | 3 + 2 passed |
| NBA full suite, SQLite and PostgreSQL 17 | 24 passed |
| npm ci | Passed |
| npm run lint | Passed |
| npx tsc --noEmit | Passed |
| npm test | 35 passed |
| npm run build | Passed; 55 pages generated |

Windows revealed a genuine NFL archive portability bug: backslash manifest keys did not match the
POSIX keys used by replay validation. Production code now writes portable keys; existing integrity
tests passed without weakening assertions. NHL's Unicode quote fixture requires `PYTHONUTF8=1`
on Windows, matching Linux CI. Initial sandbox-only dependency/temp-file errors were resolved with
the appropriate local environment. Final acceptance checks passed. New CI definitions are included;
the table records executed local checks, not an unobserved future GitHub Actions run.

Frontend build ran with unavailable-data fallbacks rather than production credentials. Actual
database availability is separately verified by the HTTP probes. Authenticated access was tested
as a database role; no signed-in user JWT was created and no authenticated HTTP session is claimed.

## Security and advisors

All 106 sport tables have RLS. Browser write privileges are absent. The explicit base-table read
allowlist contains 14 MLB, 19 CFB, 18 NFL and 9 NHL tables. All NBA objects are private. Exhaustive
public/internal table lists are in [DATABASE_SETUP.md](DATABASE_SETUP.md).
Internal MLB fitted models/completion records, CFB QB availability, NFL input/revision/scheduling
records and NHL scheduling are unavailable to browsers. The Data API exposes only the four
frontend sport schemas plus the pre-existing public/graphql schemas; NBA/platform_setup are excluded.

The shared callback retains its hardened empty search path and qualified secret lookups. No secrets
were overwritten, exposed or committed. There are no site callback secrets configured in Vault,
so it intentionally performs no HTTP callback. No pg_cron extension or cron jobs are configured.

Advisor review after migration:

- Security: 33 informational [RLS-without-policy findings](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
  are intentional private tables, including NBA and the orchestration ledger.
- One existing [extension-in-public warning](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public)
  is the non-relocatable pg_net installation. It was preserved.
- Three NBA foreign keys lacked covering indexes; migration 0005 added them. No unindexed-FK finding remains.
- Three informational [missing-primary-key findings](https://supabase.com/docs/guides/database/database-linter?lint=0004_no_primary_key)
  are upstream MLB season/archive tables. Their existing unique constraints/history representation
  were preserved; no fabricated identifiers or destructive archive rewrite was introduced.
- 121 informational [unused-index findings](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)
  reflect the new/low-traffic database. No index was removed based on these observations.

## Remaining operational prerequisites

Provider keys are empty, not unavailable schema dependencies. MLB model artifacts/training and CFB
provider ingestion must precede real forecast publication. NBA historical as-observed markets remain
an external research limitation. Deploy/connect the website and configure its Vault callback URL and
matching secret before expecting cache revalidation. Model scheduling and a live publish/grade cycle
are not established by these database tests. NFL/NHL's prior imports remain intact. These limitations
do not block the installed and tested database infrastructure.
