# Weelake · Copernicus Deployment

**Status:** Worker written, containerised, and wired to a GitHub Actions
schedule. Not yet running in production.

## Data source

- Dataset: `satellite-lake-water-temperature` (version `4_5_2`)
- Portal: https://cds.climate.copernicus.eu/datasets/satellite-lake-water-temperature
- Product: Lake Surface Water Temperature (LSWT), satellite-derived,
  global daily grid at ~1 km resolution.

## Update cadence (upstream)

The dataset is versioned **monthly** — each new "version" ships around
the 10th of the following month. Within a version, near-real-time (NRT)
extensions add fresh daily grids with a ~7-14 day latency (the time it
takes ESA / Copernicus to process the satellite pass into gridded L3).

Practical implication: running our fetcher every hour is wasteful. Once
per day is enough — the day-to-day delta is only new NRT grids, and
we're already covered by Open-Meteo forecasts / marine SST for the
same-day picture.

## Weelake refresh schedule

| Worker | Cadence | Trigger | Purpose |
|--------|---------|---------|---------|
| **Node Open-Meteo** | daily 03:00 UTC | GitHub Actions (`daily-fetch.yml`) | Fresh forecast + marine SST for every lake |
| **Python Copernicus** | daily 04:00 UTC | GitHub Actions (`copernicus-refresh.yml`) | Upgrade `source` from `openmeteo_*` to `copernicus_cds` where NRT grid has a value |

The Copernicus worker runs one hour after the Node worker so any lake
with a satellite reading today ends up with the higher-quality source
in `lakes_current`. Lakes not covered by the LSWT dataset (small
reservoirs, ponds, land-locked areas outside the satellite mask)
retain the Open-Meteo value silently.

## Deployment target

**Choice: GitHub Actions**, not Railway.

Reasons:
1. **RAM.** The Copernicus fetch downloads a ~700-800 MB NetCDF file and
   opens it via `xarray` (which mmaps the whole array). Railway's free
   tier caps at 512 MB, we'd hit swap. GitHub Actions runners have 7 GB
   available and are free for public repos.
2. **Cost.** GitHub cron is free; Railway "always-on" would cost
   $5/month even for a job that runs 45 seconds a day.
3. **Simplicity.** No extra service to monitor. Failures show up in the
   GitHub Actions dashboard alongside the rest of CI.
4. **Sekret rotation.** Same GitHub UI as `SUPABASE_SERVICE_ROLE_KEY`.

The Dockerfile in `services/copernicus-fetcher/` is kept as a
reference build; Railway config would be a straight `railway up` from
that directory if we ever move.

## Required secrets

Set these in the GitHub repo settings → Secrets and variables → Actions:

| Secret | Where from |
|--------|-----------|
| `CDSAPI_KEY` | https://cds.climate.copernicus.eu/how-to-api (personal token). CDS Beta migration moved to a plain-string API key; do NOT include the `uid:` prefix any more. |
| `SUPABASE_URL` | already set for Open-Meteo worker |
| `SUPABASE_SERVICE_ROLE_KEY` | already set for Open-Meteo worker |

## First run + smoke test

Before wiring the schedule, run manually to confirm the CDS request
succeeds and Supabase writes go through:

```bash
# Test locally against the real Copernicus API (needs .cdsapirc or CDSAPI_KEY env)
cd services/copernicus-fetcher
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
CDSAPI_KEY="…" \
  SUPABASE_URL="…" \
  SUPABASE_SERVICE_ROLE_KEY="…" \
  python fetch.py --days 3

# From CI:
gh workflow run copernicus-refresh
```

## Monitoring

- `/admin/trackers` shows the current source-mix. As Copernicus rolls
  out, the "copernicus_cds" row should grow from 0 to ~20-40% of lakes
  (big lakes only; small reservoirs stay on Open-Meteo).
- GitHub Actions history holds the worker log with per-lake outcomes.

## Follow-ups

- [ ] Rotate the leaked CDS API key that briefly appeared in
      `docs/copernikus.md` earlier revisions before the schedule ships.
- [ ] Consider caching the NetCDF download between runs (S3?) if we
      start running more than once per day.
- [ ] Once `copernicus_id` lookup table is populated (per-lake ID from
      HydroLAKES → CCI-Lakes crosswalk), swap `sample_at()` from
      nearest-neighbour to per-ID lookup — more robust for small lakes.
