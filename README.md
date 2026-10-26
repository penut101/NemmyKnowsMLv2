# NemmyKnowsMLv2

## Start the website

Use Node.js 22 or newer:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Without Supabase credentials the UI remains browsable and shows unavailable-data states. No fabricated ratings or predictions are supplied.

Copy `.env.example` to `.env.local` and fill in your own Supabase URL and anon key to read sports data. Use `NEXT_PUBLIC_SITE_URL` for your deployed origin. The service-role key is optional for local read-only browsing; it enables the existing server-side MLB live grading route. Never put it in a `NEXT_PUBLIC_` variable.

The website is the repository root. Model folders are independent Python projects: run each from its own directory and virtual environment. They retain their original package/module names and model policies.

See [SETUP.md](SETUP.md) for database, model, and deployment setup, [UPSTREAM.md](UPSTREAM.md) for provenance, and [UPSTREAM_WEB_README.md](UPSTREAM_WEB_README.md) for the original frontend architecture. Each model retains its own README.

## Verification

```sh
npm run lint
npx tsc --noEmit
npm test
npm run build
```
