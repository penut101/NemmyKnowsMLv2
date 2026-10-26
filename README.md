# NemmyKnowsMLv2

Private, source-based fork of René Núñez's Momentum website and MLB, NFL, CFB, and NHL models, maintained by Aiden Nemeroff (`penut101`). Imported with the owner's permission. The original UI, routes, methodology, articles, assets, model implementations, tests, SQL, and workflow definitions are included.

## Start the website

Use Node.js 22 or newer:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Without Supabase credentials the UI remains browsable and shows unavailable-data states. No fabricated ratings or predictions are supplied.

Copy `.env.example` to `.env.local` and fill in your own Supabase URL and anon key to read sports data. Use `NEXT_PUBLIC_SITE_URL` for your deployed origin. The service-role key is optional for local read-only browsing; it enables the existing server-side MLB live grading route. Never put it in a `NEXT_PUBLIC_` variable.

## Repository layout

| Location | Source |
| --- | --- |
| `src/`, `public/`, `sql/`, `contracts/` | `renenunezg/momentumweb` |
| `models/mlb/` | `renenunezg/mlbmodel` |
| `models/nfl/` | `renenunezg/momentumnfl` |
| `models/cfb/` | `renenunezg/momentumcfb` |
| `models/nhl/` | `renenunezg/momentumnhl` |

The website is the repository root. Model folders are independent Python projects: run each from its own directory and virtual environment. They retain their original package/module names and model policies.

See [SETUP.md](SETUP.md) for database, model, and deployment setup, [UPSTREAM.md](UPSTREAM.md) for provenance, and [UPSTREAM_WEB_README.md](UPSTREAM_WEB_README.md) for the original frontend architecture. Each model retains its own README.

## Verification

```sh
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Root GitHub Actions run frontend checks and adapted upstream model CI suites against disposable databases. Model production workflow originals remain under each model's `.github/workflows` for reference; GitHub does not execute nested workflows. They need deployment-specific adaptation before scheduling.

## What source control does not contain

The repositories exclude the live Supabase rows, private API keys, most raw/processed provider data, and MLB posterior NetCDF files. The NHL static fitted parameters tracked upstream are included. To reproduce live outputs, provision schemas and regenerate excluded artifacts or obtain them from the original owner. The source alone is not a backup of the live service.

The existing `penut101/NemmyKnowsML` repository is the predecessor and is not renamed or overwritten. This is a separate v2 repository built from the five requested sources.
