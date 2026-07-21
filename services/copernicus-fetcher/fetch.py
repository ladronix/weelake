"""
Weelake · Copernicus CDS fetcher
================================

Downloads Lake Surface Water Temperature (LSWT) data from the
Copernicus Climate Data Store, extracts a value per registered lake,
and upserts into Supabase.

Dataset: `satellite-lake-water-temperature`
    https://cds.climate.copernicus.eu/datasets/satellite-lake-water-temperature

Ordering:
  1. Copernicus LSWT (satellite, high quality)  ← this script
  2. Open-Meteo Marine SST (large lakes / coasts) — Node worker
  3. Open-Meteo air-temp heuristic (fallback) — Node worker

Usage
-----
    python fetch.py --days 3

Environment
-----------
    CDSAPI_URL, CDSAPI_KEY          — set via .cdsapirc or env vars
    SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY

Notes
-----
The CDS API is asynchronous: submit request → poll → download.
The `cdsapi` client hides that; a single retrieve() blocks until ready.
"""
from __future__ import annotations

import argparse
import datetime as dt
import logging
import os
import tempfile
import zipfile
from pathlib import Path
from typing import Any

import httpx
from supabase import Client, create_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("weelake.copernicus")


# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------

def get_supabase() -> Client:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing")
    return create_client(url, key)


# ---------------------------------------------------------------------------
# CDS retrieval
# ---------------------------------------------------------------------------

def build_cds_client() -> Any:
    """
    Instantiate the CDS client with env-based auth.
    Falls back to ~/.cdsapirc if CDSAPI_URL / CDSAPI_KEY are unset.
    """
    try:
        import cdsapi
    except ImportError as e:
        raise RuntimeError(
            "cdsapi not installed. Add 'cdsapi>=0.7.7' to requirements.txt"
        ) from e

    url = os.environ.get("CDSAPI_URL") or "https://cds.climate.copernicus.eu/api"
    key = os.environ.get("CDSAPI_KEY")
    if key:
        return cdsapi.Client(url=url, key=key)
    return cdsapi.Client()


def download_lswt(
    days: int,
    workdir: Path,
) -> Path | None:
    """
    Download the most recent `days` of the Copernicus satellite LSWT dataset.
    Returns the path to the extracted NetCDF file, or None on failure.

    LSWT lag: the CDS dataset is documented as "approximately 6 months
    behind real-time" with semiannual updates, so a naive `today - N`
    query almost always returns 400. We probe a series of increasingly
    older windows (start ~6 months back, step back one month at a time
    up to 18 months) and return the first one CDS accepts. Each attempt
    is a single-request retrieve of `days` consecutive dates so the
    downloaded NetCDF file is small.
    """
    client = build_cds_client()

    # Probe offsets, in days, from today. 180 days = ~6 months (documented
    # latency). Each subsequent offset is +30 days further into the past.
    # We stop as soon as CDS returns a valid NetCDF, or after 12 tries.
    OFFSETS = [180, 210, 240, 270, 300, 330, 360, 420, 480, 540, 600, 660]

    target = workdir / "lswt.zip"
    today = dt.date.today()
    last_error: Exception | None = None

    for offset in OFFSETS:
        end = today - dt.timedelta(days=offset)
        fetch_days = [end - dt.timedelta(days=d) for d in range(days)]

        years   = sorted({f"{d.year}" for d in fetch_days})
        months  = sorted({f"{d.month:02d}" for d in fetch_days})
        day_ids = sorted({f"{d.day:02d}" for d in fetch_days})

        request = {
            "variable": ["lake_surface_water_temperature"],
            "year":     years,
            "month":    months,
            "day":      day_ids,
            "version":  "4_5_2",
            "format":   "zip",
        }
        log.info(
            "Requesting CDS LSWT (offset=%dd, target=%s±%dd)",
            offset,
            end.isoformat(),
            days,
        )
        try:
            client.retrieve("satellite-lake-water-temperature", request, str(target))
            break
        except Exception as e:
            msg = str(e)
            # 400 = window out of range or invalid combination.
            # Try the next older window; any other error is fatal.
            if "400" in msg or "invalid request" in msg.lower():
                last_error = e
                continue
            log.error("CDS retrieve failed hard: %s", e)
            return None
    else:
        # Exhausted every offset without success.
        log.error(
            "CDS retrieve failed on every window (tried offsets %s). Last error: %s",
            OFFSETS,
            last_error,
        )
        return None

    # Extract NetCDF from the zip.
    try:
        with zipfile.ZipFile(target) as z:
            for name in z.namelist():
                if name.endswith(".nc"):
                    z.extract(name, workdir)
                    return workdir / name
    except zipfile.BadZipFile as e:
        log.error("bad zip returned: %s", e)
    return None


def sample_at(nc_path: Path, lat: float, lng: float) -> tuple[float | None, str | None]:
    """
    Extract the LSWT value nearest a (lat, lng) point from a NetCDF file.
    Returns (temperature_c, timestamp_iso) or (None, None).
    """
    try:
        import xarray as xr
    except ImportError as e:
        raise RuntimeError("xarray not installed. Add 'xarray' to requirements.txt") from e

    ds = xr.open_dataset(nc_path)
    var_name = None
    for candidate in ("lake_surface_water_temperature", "lswt", "temperature"):
        if candidate in ds.variables:
            var_name = candidate
            break
    if var_name is None:
        log.warning("No LSWT variable found in %s", nc_path.name)
        return None, None

    v = ds[var_name].sel(lat=lat, lon=lng, method="nearest")
    if "time" in v.dims:
        v = v.isel(time=-1)

    val = float(v.values)
    if val != val:  # NaN
        return None, None

    # NetCDF LSWT is in Kelvin; convert to Celsius when needed.
    if val > 200:
        val -= 273.15

    time_val = v.time.values if "time" in v.coords else None
    ts = str(time_val)[:19] if time_val is not None else dt.datetime.now(dt.timezone.utc).isoformat()

    return round(val, 2), ts


# ---------------------------------------------------------------------------
# Open-Meteo fallback (already covered by the Node worker; here as backup)
# ---------------------------------------------------------------------------

def fetch_openmeteo_marine_fallback(lat: float, lng: float) -> dict[str, Any] | None:
    url = "https://marine-api.open-meteo.com/v1/marine"
    params = {
        "latitude":     f"{lat:.4f}",
        "longitude":    f"{lng:.4f}",
        "hourly":       "sea_surface_temperature",
        "past_days":    1,
        "forecast_days": 1,
        "timezone":     "auto",
    }
    try:
        r = httpx.get(url, params=params, timeout=15)
        r.raise_for_status()
        j = r.json()
        times = j.get("hourly", {}).get("time", [])
        temps = j.get("hourly", {}).get("sea_surface_temperature", [])
        for i in range(len(times) - 1, -1, -1):
            if temps[i] is not None:
                return {
                    "temp_c":      float(temps[i]),
                    "measured_at": dt.datetime.fromisoformat(times[i]).astimezone(dt.timezone.utc).isoformat(),
                    "source":      "openmeteo_marine",
                    "quality":     "medium",
                }
    except Exception as e:
        log.warning("Open-Meteo marine fallback failed: %s", e)
    return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def refresh_all(days: int) -> None:
    """
    Fetch Copernicus LSWT for every lake and write the result into
    Supabase. Data-strategy rule (2026-07):

    - Copernicus LSWT data lags real-time by ~6 months, so Open-Meteo
      Forecast is always the fresher source for `lakes_current`.
    - We therefore write Copernicus samples into `lakes_history` only,
      leaving `lakes_current` untouched unless the row is entirely
      absent (a lake we haven't seen a reading for at all).
    - This preserves the live-temperature UX (users always see today's
      Open-Meteo estimate) while enriching the historical chart with
      the higher-quality satellite anchor points.
    """
    supabase = get_supabase()
    lakes = (
        supabase.table("lakes")
        .select("id,slug,lat,lng,type,copernicus_id")
        .execute()
        .data or []
    )
    log.info("Refreshing %d lakes with Copernicus LSWT (past %d days)", len(lakes), days)

    with tempfile.TemporaryDirectory() as tmp:
        nc_path = download_lswt(days=days, workdir=Path(tmp))
        if nc_path is None:
            log.warning("Copernicus download unavailable; skipping (Node worker will keep data flowing)")
            return

        # Preload which lakes already have a `lakes_current` row so we
        # can decide per-lake whether to upsert or history-only.
        existing_current = {
            row["lake_id"]
            for row in (supabase.table("lakes_current").select("lake_id").execute().data or [])
        }

        ok_history = ok_seed_current = fail = 0
        for lake in lakes:
            temp_c, ts = sample_at(nc_path, lake["lat"], lake["lng"])
            if temp_c is None:
                fail += 1
                log.info("· %-24s no data", lake["slug"])
                continue

            payload_history = {
                "lake_id":     lake["id"],
                "temp_c":      temp_c,
                "measured_at": ts,
                "source":      "copernicus_cds",
                "quality":     "high",
            }
            try:
                # Always append to history so the detail-page chart can
                # show Copernicus alongside Open-Meteo. `measured_at`
                # from Copernicus is in the past (~6 months) so it
                # naturally sorts as an older data point, not the
                # latest.
                supabase.table("lakes_history").insert(payload_history).execute()
                ok_history += 1

                # Only seed `lakes_current` if the lake has no row yet
                # (i.e. Open-Meteo hasn't reached it for whatever reason).
                # This is a very rare fallback path.
                if lake["id"] not in existing_current:
                    now = dt.datetime.now(dt.timezone.utc).isoformat()
                    supabase.table("lakes_current").upsert({
                        **payload_history,
                        "updated_at": now,
                    }).execute()
                    ok_seed_current += 1

                log.info("· %-24s %.1f°C @ %s (history)", lake["slug"], temp_c, ts)
            except Exception as e:
                fail += 1
                log.error("· %-24s DB error: %s", lake["slug"], e)

        log.info(
            "Done. history=%d seed_current=%d fail=%d total=%d",
            ok_history, ok_seed_current, fail, len(lakes),
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Copernicus LSWT refresh worker")
    parser.add_argument("--days", type=int, default=3, help="Number of past days to fetch")
    args = parser.parse_args()
    refresh_all(days=args.days)
