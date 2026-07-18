# Architecture

## Overview

```
┌───────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                   │
│  ┌───────────────┐  ┌───────────────┐  ┌──────────────────────┐   │
│  │ Browser (web) │  │ PWA installed │  │ Future: Expo mobile  │   │
│  └───────┬───────┘  └───────┬───────┘  └──────────┬───────────┘   │
│          └─────────────────┬┴─────────────────────┘               │
└────────────────────────────┼──────────────────────────────────────┘
                             │
                             ▼
┌───────────────────────────────────────────────────────────────────┐
│                     NEXT.JS 15 · APP ROUTER (Vercel)               │
│  Server Components render landing / map / detail / country pages.  │
│  Route handlers `/api/*` are the public JSON API.                  │
│                                                                    │
│  Response caching:                                                  │
│    - /api/lakes      → s-maxage=300  SWR=1800                     │
│    - /api/lake/[s]   → s-maxage=900  SWR=3600                     │
│    - /api/stats      → s-maxage=300  SWR=1800                     │
│    - /api/search     → no cache (query-dependent)                 │
└──────────────┬──────────────────────────────┬─────────────────────┘
               │                              │
               ▼                              ▼
┌───────────────────────────┐    ┌──────────────────────────────────┐
│   SUPABASE POSTGRES       │    │        OPEN-METEO (live)          │
│   + PostGIS + pg_trgm     │    │  Weather · Wind · UV · Marine SST │
│                           │    │  No API key.                      │
│  Tables:                  │    │  Called live from `/api/lake/*`  │
│   - lakes                 │    │  Cached via HTTP `revalidate`.   │
│   - lakes_current         │    └──────────────────────────────────┘
│   - lakes_history         │
│   - weather_cache         │
│   - stats_snapshot        │
│   - countries             │
│                           │
│  Functions:               │
│   - search_lakes(q)       │
│   - nearest_lakes(lat,lng)│
└──────▲────────────────────┘
       │
       │ upsert / append
       │
┌──────┴────────────────────────────────────────────────────────────┐
│                     BATCH WORKERS (cron)                           │
│                                                                    │
│  1. openmeteo-refresh (Node · TypeScript)                          │
│     └─ GitHub Actions · daily 03:00 UTC                            │
│     └─ Iterates every lake, upserts lakes_current + appends history│
│                                                                    │
│  2. copernicus-fetcher (Python)                                    │
│     └─ Railway container · daily 04:00 UTC                         │
│     └─ CMEMS subset → NetCDF → point extraction → Supabase         │
│     └─ Optional: overrides openmeteo values with 'high' quality    │
└────────────────────────────────────────────────────────────────────┘
```

## Data flow: user opens landing

1. Request hits Vercel edge.
2. Next.js server component fires 3 Supabase queries in parallel
   (stats · countries · hot/cold lists).
3. React streams Suspense fallbacks first, then final HTML.
4. Client hydrates search input; typing debounces at 180ms and
   hits `/api/search?q=…` (Postgres `pg_trgm` fuzzy match).
5. Clicking a result navigates to `/lake/{slug}` (SSR again).

## Data flow: user opens lake detail

1. `/lake/{slug}` server component:
   - Loads `lakes` row from Postgres.
   - Loads `lakes_current` + 7-day `lakes_history`.
   - Fires Open-Meteo forecast API for weather + 7-day forecast (parallel).
   - Falls back to Open-Meteo Marine for water temp if no cached value.
2. Server renders full page — CLS is minimal because the temperature card is
   painted with server-known values.
3. Client renders 7-day area chart with Recharts (client component).

## Data flow: daily refresh

1. GitHub Actions cron `daily-fetch.yml` runs at 03:00 UTC.
2. Node worker:
   - `select * from lakes`
   - For each lake:
     - Try Marine SST at (lat, lng).
     - Fallback: air-temp estimated water temp.
   - Upsert `lakes_current` (source, quality set accordingly).
   - Append `lakes_history` (append-only, retained for chart).
3. (Later) Python Copernicus worker runs at 04:00 UTC:
   - For lakes with `copernicus_id`, downloads NetCDF slice.
   - Extracts nearest grid cell temperature.
   - Upserts with `source='copernicus_marine'`, `quality='high'` —
     overrides same-day Open-Meteo values.

## Why hybrid cache + live

| Concern | Live only | Cache only | Hybrid (chosen) |
|---|---|---|---|
| Freshness of weather | ✅ | ❌ | ✅ (fetched per detail view) |
| Landing load speed | ❌ (many API calls) | ✅ | ✅ (DB has current temps) |
| Rate limits with 10k lakes | Immediate blow-up | Safe | Safe (only detail pages hit APIs) |
| Historical charts | Not possible | ✅ | ✅ (`lakes_history` table) |
| Cost | High (compute) | Zero | Near-zero |

## Retention & pruning

- `lakes_current` — one row per lake, upserted daily.
- `lakes_history` — indefinite for now. Prune when > 90 days retention
  needed for premium (`delete from lakes_history where measured_at < now() - interval '90 days'`).

## Failure modes and fallbacks

| Failure | Handling |
|---|---|
| Open-Meteo down | `/api/lake/*` still serves cached temp + history; weather section shows "unavailable". |
| Copernicus down | Marine API fallback keeps values flowing. |
| Supabase down | Static assets served from Vercel; API returns 5xx; UI shows retry hint. |
| Cron job fails | `lakes_current.updated_at` grows old; UI displays "Updated N hours ago" warning. |

## Security

- Public reads on all data tables via RLS `using (true)`.
- Writes are only performed by workers using the service-role key
  (kept in GitHub Secrets + Vercel env, never client-side).
- No user auth in MVP → no PII surface.
- CSP + `frame-ancestors 'none'` recommended (add via `next.config.js` headers).
