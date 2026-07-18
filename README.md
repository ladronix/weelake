# Weelake · V-Lake

> Global lake temperatures. Live. Beautiful. Free.

The first open, global map of lake, reservoir, and freshwater temperatures.
Windy for water. Real-time data from Copernicus, Open-Meteo, and community reports.

## Status

- 🌊 **Phase 0 — Foundation** (in progress)
- Codename: **V-Lake**
- Domain: `weelake.com` (target)

## Stack

- **Web:** Next.js 15 · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · Framer Motion
- **Map:** MapLibre GL JS · Protomaps
- **DB:** Supabase Postgres + PostGIS
- **Data sources:** Copernicus (CDS + Marine), Open-Meteo, HydroLAKES, OpenStreetMap
- **Data pipeline:** Python (`services/copernicus-fetcher`) + Node (`services/openmeteo-refresh`)
- **Cron:** GitHub Actions (daily 03:00 UTC)
- **Hosting:** Vercel (web) · Railway (Python worker) · Supabase (DB) · Cloudflare (DNS)

## Monorepo layout

```
apps/
  web/                    Next.js 15 app (landing + map + detail + country)
packages/
  types/                  Shared TypeScript types
  ui/                     Shared UI components
  map/                    MapLibre wrapper
services/
  copernicus-fetcher/     Python worker: daily satellite LSWT fetch
  openmeteo-refresh/      Node worker: hourly weather refresh
supabase/
  migrations/             SQL schema
  seed/                   Initial HydroLAKES import
  functions/              Edge Functions
scripts/
  seed-lakes.ts           Import HydroLAKES for CZ/AT/DE + top world
.github/workflows/
  daily-fetch.yml         GitHub Actions cron
  ci.yml                  Type-check, lint, build
```

## Quick start

```bash
# 1. Install deps
pnpm install

# 2. Setup Supabase locally (or link to remote project)
supabase start

# 3. Run migrations
supabase db reset

# 4. Seed lakes
pnpm --filter web run seed

# 5. Start dev
pnpm --filter web dev
```

Open http://localhost:3000

## Data sources

| Source | License | Purpose |
| --- | --- | --- |
| Copernicus Marine LSWT | Copernicus License (free) | Daily satellite lake surface water temperature |
| Copernicus Climate CDS | Copernicus License (free) | Historical + regional lake data |
| Open-Meteo | CC BY 4.0 | Weather forecast, wind, UV |
| Open-Meteo Marine | CC BY 4.0 | Sea/large-lake surface temp (fallback) |
| HydroLAKES | CC BY 4.0 | Lake registry (name, area, depth, bbox) |
| OpenStreetMap | ODbL | Beaches, parking, points of interest |
| REST Countries | Free | Flag SVGs, ISO codes |

## Roadmap

- [x] Repo scaffolding
- [ ] Next.js app + Tailwind + shadcn setup
- [ ] Supabase schema + PostGIS
- [ ] HydroLAKES import (CZ + AT + DE + top 100 world)
- [ ] Open-Meteo Marine integration (fast start)
- [ ] Landing page with live stats + search + country grid
- [ ] Map view with MapLibre + heatmap layer
- [ ] Lake detail with 7-day chart
- [ ] Country pages
- [ ] Copernicus CDS Python worker
- [ ] PWA + i18n (CZ/EN/DE)
- [ ] Global expansion (~10k lakes)

## License

Data: See individual source licenses (Copernicus License, CC BY 4.0, ODbL).
Code: MIT (TBD).
