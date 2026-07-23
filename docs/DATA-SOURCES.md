# Weelake · Data Sources & Sync Architecture

**Status:** draft v1 (2026-07-21).  Update in the same PR whenever a
source is added, retired, or its cadence changes.

## The end goal

> Planet-wide lake coverage with the freshest possible water
> temperature at every lake, plus a trustworthy long-term trend line
> reconstructed from higher-quality historical sources.

Nothing else in this file matters if it doesn't serve that goal.

---

## The three-tier data model

Every reading we ingest lands in one of three roles:

| Role | Table | Purpose | Latency target |
|---|---|---|---|
| **Live** | `lakes_current` | The single row a user sees on the map today | ≤ 24 h |
| **Recent** | `lakes_history` (source ∈ live sources) | Rolling 7–30 day trend line for the SelectedSheet mini chart | ≤ 24 h |
| **Anchor** | `lakes_history` (archive sources) | Multi-year satellite-grade truth for long-term trend | months, but reliable |

**Rule:** every source knows which role it plays. A source can serve
one role or several (Open-Meteo Forecast serves Live + Recent).
Copernicus only ever serves Anchor. This is enforced in the fetcher
code — a fetcher marked `role: "anchor"` refuses to write to
`lakes_current`, even if a caller passes it.

---

## Sources at a glance

Sorted by role, then by refresh cadence.

| Source | Role | Cadence | Latency | Coverage | Access | Quality |
|---|---|---|---|---|---|---|
| **Open-Meteo Forecast** | Live + Recent | Hourly upstream, we pull daily | Real-time (sub-hour) | Global (~11 M grid cells; every lake we know) | Free HTTP, CC-BY 4.0 | Air-model-derived → good for well-mixed inland lakes, weaker for deep alpine or stratified reservoirs |
| **Open-Meteo Marine** | Live + Recent | Hourly upstream, we pull daily | ~1 h | Coastal + inland lakes covered by Baltic/Med SST products (~40 of our 322) | Free HTTP, CC-BY 4.0 | Satellite-derived SST → high on the covered lakes |
| **ChMI (Czech Hydrometeorological Institute)** | Live + Recent | Daily bulletin + hourly on some sites | 6–24 h | ~30 Czech reservoirs + rivers with public bathing spots | Free HTTP CSV/JSON (unofficial scrape of `chmi.cz`), CC-BY-NC 3.0 CZ | In-situ probe measurements — highest quality where available |
| **Povodí ČR (5 river basins)** | Live + Recent | Hourly upstream, daily bulletin | 6–24 h | ~60 Czech reservoirs | Free CSV per basin (`pvl.cz`, `pmo.cz`, `poh.cz`, `pod.cz`, `pla.cz`) | In-situ — same quality tier as ChMI |
| **NOAA CoastWatch / NCEI** (planned) | Live + Recent | Daily | 24–48 h | Great Lakes + Alaska + FL + Puget Sound + Chesapeake | Free HTTP, US public domain | Satellite SST — excellent US freshwater coverage |
| **Copernicus Marine (CMEMS)** | Live + Recent | Daily | 12–48 h | Every marine + brackish "lake" globally (Med, Baltic, Caspian, Great Lakes when reprocessed) | Free (registration), Copernicus License | Satellite-derived, blended forecast + reanalysis |
| **Copernicus CDS · LSWT v4.5.2** | Anchor | Semiannual (Feb + Aug) | **~6 months** | Every lake globally > ~100 km² | Free (registration + licence acceptance), Copernicus License | ESA CCI daily lake water temperature — gold standard for climate work |
| **ERA5 reanalysis** (planned) | Anchor + Recent | Daily | ~5 days | Global grid — every lake | Free via CDS, Copernicus License | Model reanalysis; blends observations with a numerical model, good for filling the 6-month gap between LSWT and today |
| **HydroLAKES + OpenStreetMap** | Registry | Static | N/A | Global (1.4 M lakes globally, ~1000 curated by us) | CC-BY 4.0 / ODbL | Geographic reference, not a temperature source |

Notes on the "Coverage" column: numbers reflect what the source
theoretically covers, not what we currently ingest. A fetcher's job is
to reduce that gap.

---

## Cadence per source — when do they publish?

The **cadence** column above answers "how often does the upstream
release new data?". Our fetcher schedules mirror that:

- Real-time / hourly upstream → we still schedule **daily** in
  production. Users don't need sub-hourly refresh for water
  temperature; the cost is worth trading for a lower request budget
  and simpler ops.
- Daily upstream → schedule daily, 1–2 h AFTER the upstream cutoff.
- Weekly / semiannual → schedule daily anyway, and let the fetcher
  no-op when no new data is available. Cheap heartbeat > risk of
  missing a release.

The **latency** column is the delay from a physical measurement to it
being fetchable. Copernicus CDS LSWT is the worst offender at ~6
months but the highest quality. Users do not see anchor-role data on
the live map — see the "role" contract above.

---

## Fetcher framework

Every scheduled data-fetch job in Weelake follows the same shape,
lives under `services/fetchers/<source-key>/`, and inherits one of two
runtimes:

- **Node fetchers** (`services/fetchers/<name>/`) — TypeScript, pnpm
  workspace, uses `@weelake/fetcher-lib` (shared logger + Supabase
  client + run-tracking). Runs are executed by GitHub Actions.
- **Python fetchers** (`services/fetchers/<name>/`) — for anything
  needing NetCDF / xarray (Copernicus LSWT). Same run-tracking
  contract via the Supabase REST API.

The shared contract:

```
services/fetchers/
├── _shared/
│   ├── node/            # @weelake/fetcher-lib (TS)
│   │   ├── logger.ts    # structured JSON logs → stdout + Supabase
│   │   ├── supabase.ts  # service-role client
│   │   ├── run.ts       # startRun/finishRun with fetcher_runs row
│   │   └── retry.ts     # exponential backoff + jitter helper
│   └── python/
│       └── weelake_fetcher/
│           ├── logger.py
│           ├── supabase.py
│           └── run.py
├── openmeteo/           # existing openmeteo-refresh, renamed
├── copernicus-lswt/     # existing copernicus-fetcher, renamed
├── chmi/                # new — Czech Hydrometeorological Institute
├── povodi/              # new — Povodí water-manager bulletins
└── era5/                # planned — ERA5 reanalysis
```

### `fetcher_runs` monitoring table

Every fetcher writes one row to `public.fetcher_runs` per invocation:

```sql
create table public.fetcher_runs (
  id           uuid primary key default gen_random_uuid(),
  fetcher      text not null,             -- "openmeteo" | "copernicus-lswt" | ...
  role         text not null,             -- "live" | "recent" | "anchor"
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  status       text not null,             -- "running" | "ok" | "partial" | "failed"
  ok_count     int not null default 0,
  fail_count   int not null default 0,
  skip_count   int not null default 0,
  message      text,                      -- last error / summary
  duration_ms  int
);
create index on public.fetcher_runs (fetcher, started_at desc);
```

Exposed to the app via `/api/monitor` → returns per-fetcher
`{ last_run, success_rate_7d, avg_duration_ms }` for a future admin
dashboard.

### Naming convention

- Directory + package name: `services/fetchers/<source-key>/`
- Source key: kebab-case, exactly what appears in
  `lakes_history.source` after normalisation (so
  `copernicus_cds` = `services/fetchers/copernicus-lswt/`,
  intentional divergence documented here).
- GitHub Actions workflow: `.github/workflows/fetch-<source-key>.yml`.
- Cron schedule: staggered by 15-minute offsets so no two fetchers
  fight for Supabase's 60-connection limit.

### Logging

Every fetcher log line is structured JSON:

```json
{"ts":"2026-07-21T04:00:12Z","fetcher":"openmeteo","level":"info","event":"lake.ok","slug":"balaton","temp_c":22.1,"source":"openmeteo_forecast"}
```

The `event` field is the primary index:

- `run.start` / `run.finish` — matches a `fetcher_runs` row
- `lake.ok` / `lake.skip` / `lake.fail` — per-entity outcome
- `http.retry` — one retry attempt with reason
- `warn.*` — non-fatal anomalies worth eyeballing

Local dev: pretty-printed to stdout via the same helper. Production:
raw JSON so GitHub Actions log aggregation stays parseable.

### Retry policy

Every outbound HTTP call in a fetcher goes through the shared retry
helper:

- Max 3 attempts, exponential backoff (1s / 3s / 9s + full jitter).
- Retriable: 5xx, 429, network errors.
- Not retriable: 4xx (fix the request, don't hammer the upstream).
- One `http.retry` log per attempt so we can see if we're being rate-
  limited over time.

---

## Roadmap (execution order)

The fetcher framework unlocks each of these one-by-one:

1. **Rename existing workers** into the `services/fetchers/` layout.
   Zero behaviour change; just directory + package name + workflow
   file. **This first** because everything else depends on the shared
   lib.
2. **Add `fetcher_runs` migration + shared lib**. Every fetcher
   instrumented uniformly.
3. **CHMI fetcher** — cheap first win, big CZ user impact.
4. **Povodí fetchers** (one per basin) — Vltavy, Ohře, Moravy, Odry,
   Labe. Each is small; sharing the framework keeps the diff modest.
5. **`/api/monitor` endpoint + admin dashboard** — visibility so we
   know which fetchers are healthy.
6. **ERA5 fetcher** — fills the 5-day-to-6-month gap between live
   sources and the LSWT anchor. Python + xarray, similar shape to the
   Copernicus LSWT fetcher.
7. **NOAA CoastWatch** — expand US coverage.
8. **Lake polygons from HydroLAKES** — replaces the point marker with
   a proper shape when zoomed in. New table `lake_geometries`, GeoJSON
   per lake, served through a tiled PMTiles archive to keep bandwidth
   sane.
9. **Sub-hourly opt-in** for a small set of "flagship" lakes if user
   demand warrants it.

Each step ships as its own PR; each PR touches this file if it
changes the contract.
