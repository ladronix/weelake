# Weelake

> Global lake temperatures. Live. Beautiful. Free.

An open, global map of lake, reservoir, and freshwater temperatures for
recreation planning and long-term climate observation. Windy for water.

Live at **[weelake.com](https://weelake.com)** · 256 lakes across 34
countries · Data refreshed daily.

## Data model

Weelake blends three temperature sources with different latency and
quality profiles:

| Source | Latency | Purpose |
| --- | --- | --- |
| **Open-Meteo Forecast** | real-time | `lakes_current` — the live temperature every user sees on the map |
| **Open-Meteo Marine** | real-time | Coastal + very large lakes (SST-derived) |
| **Copernicus LSWT** (satellite) | ~6 months, semiannual | Historical anchor points in `lakes_history` — high-quality daily satellite readings that back-fill the chart |

Rule: Copernicus never overwrites `lakes_current` — it appends to
history only, so the live UI is always fresh and the historical chart
gains a satellite-grade truth line. See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full data-flow
diagram.

## Stack

- **Web:** Next.js 15 · React 19 · TypeScript · Tailwind CSS 4 · Framer Motion · MapLibre GL 4.7
- **Data pipeline:** Node (`services/openmeteo-refresh`) + Python (`services/copernicus-fetcher`)
- **DB:** Supabase Postgres + PostGIS · unique index on `(lake_id, measured_at, source)` for idempotent history writes
- **Cron:** GitHub Actions (daily 03:00 UTC for Open-Meteo, 04:00 UTC for Copernicus)
- **Hosting:** Vercel (web) · Supabase (DB) · GitHub Actions (workers) · Cloudflare (DNS)
- **i18n:** English / Czech / German — 200+ scalar strings + 6 plural families per locale, guarded by CI check

## Monorepo layout

```
apps/
  web/                    Next.js 15 app — landing, /map, /lake/[slug], /country/[code], /sources
packages/
  types/                  Shared TypeScript types
  ui/                     Shared UI primitives (TempPill, GlassCard, …)
services/
  copernicus-fetcher/     Python worker — daily satellite LSWT fetch
  openmeteo-refresh/      Node worker — daily weather refresh + operator scripts
supabase/
  migrations/             SQL schema (versioned)
  seed/                   Initial HydroLAKES import
.github/workflows/
  daily-fetch.yml         Open-Meteo daily cron
  copernicus-refresh.yml  Copernicus daily cron
  ci.yml                  Test / lint / typecheck / build gate
docs/                     Deployment, architecture, i18n, deploy runbooks
```

## Quick start

Requires: Node 22+, pnpm, Supabase CLI, an .env.local at repo root with
`NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

```bash
# Install
pnpm install

# Link to hosted Supabase (uses ./supabase/config.toml)
supabase link --project-ref <your-ref>

# Apply schema
supabase db push

# Seed the lake registry
pnpm --filter openmeteo-refresh seed:more       # ~190 curated worldwide lakes
pnpm --filter openmeteo-refresh seed:batch-2    # +65 lakes (E. Asia, Balkans, …)

# Populate current + historical temperatures
pnpm --filter openmeteo-refresh start
pnpm --filter openmeteo-refresh photos          # Wikipedia thumbnails

# Optional: satellite historical data (requires CDS API key, see docs/DEPLOY-COPERNICUS.md)
CDSAPI_KEY=... python services/copernicus-fetcher/fetch.py

# Run the web app
pnpm --filter web dev
```

Open http://localhost:3000

## Data sources

| Source | License | Role |
| --- | --- | --- |
| Copernicus Climate CDS (LSWT) | Copernicus License | Historical satellite (v4.5.2) |
| Open-Meteo Forecast | CC BY 4.0 | Live daily temperature estimate |
| Open-Meteo Marine | CC BY 4.0 | Sea + very large lakes SST |
| Wikipedia / Wikimedia Commons | CC-BY-SA | Lake photos (served through in-app CORS proxy) |
| HydroLAKES + manual curation | CC BY 4.0 | Lake registry (name, area, coordinates) |
| RainViewer | Free tier | Live precipitation overlay |
| OpenStreetMap / Carto Positron / Esri World Imagery | ODbL / CC-BY / Esri terms | Base maps |

## Operator scripts

Every long-running data job lives under
`services/openmeteo-refresh/src/` and shares the same Supabase service
role client:

- `refresh.ts` — nightly `lakes_current` + `lakes_history` refresh (production cron)
- `backfill.ts` — one-off bulk historical fill after adding new lakes
- `photos-backfill.ts` — Wikimedia thumbnail lookup for every lake without a `photo_url`
- `seed-more.ts` / `seed-batch-2.ts` — INSERT-IGNORE from curated JSON/TS lists
- `dedupe-lakes.ts` — collapse duplicate rows created before the unique constraint

## Testing / quality gates

```bash
pnpm --filter web test        # 67 Vitest suites, mostly i18n + temperature math
pnpm --filter web lint        # ESLint (next lint)
pnpm --filter web tsc --noEmit
pnpm i18n:check               # locale-parity guard (used in CI)
```

All four run in `.github/workflows/ci.yml` on every push; the `main`
branch is intended to stay deployable.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — components and data-flow
- [`docs/DEPLOY.md`](docs/DEPLOY.md) — end-to-end deploy runbook
- [`docs/DEPLOY-COPERNICUS.md`](docs/DEPLOY-COPERNICUS.md) — CDS licence acceptance and worker deploy
- [`docs/I18N.md`](docs/I18N.md) — locale workflow + DeepL sync
- [`docs/SETUP.md`](docs/SETUP.md) — fresh-clone setup guide
- [`docs/ANALYTICS.md`](docs/ANALYTICS.md) — event taxonomy

## Production checklist

- [x] Live data flowing daily (Open-Meteo + Copernicus history anchors)
- [x] 256 lakes across 34 countries
- [x] i18n: en / cs / de complete, parity-tested
- [x] SyncBadge — public data-freshness indicator in the nav
- [x] Image proxy for CORS-restricted Wikimedia photos
- [x] MapLibre satellite + light + dark + streets basemaps working
- [x] Rain radar (RainViewer) overlay
- [x] Playwright headless audit — production build clean
- [ ] `robots.txt` + sitemap.xml (present, needs post-domain-cutover review)
- [ ] Analytics wired to a real endpoint (currently no-op)
- [ ] Post-launch: ERA5 monthly reanalysis for `lakes_history` gap-filling

## License

Data — see each source's own license (Copernicus, CC BY 4.0, ODbL, CC-BY-SA).
Code — MIT.
