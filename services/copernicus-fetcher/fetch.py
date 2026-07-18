"""
Weelake · Copernicus fetcher
============================

Downloads daily Lake Surface Water Temperature (LSWT) from the Copernicus
Climate Data Store (CDS) or Copernicus Marine (CMEMS), extracts a value
for every lake registered in Supabase, and upserts into `lakes_current`
+ appends `lakes_history`.

Trigger:
    - Deployed to Railway with an internal Nixpacks Python image
    - Or via GitHub Actions on a schedule
    - Local:  `python fetch.py`

Environment variables:
    CDSAPI_URL, CDSAPI_KEY               (~/.cdsapirc equivalent)
    COPERNICUS_MARINE_USER, ...PASSWORD
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

Notes:
    - This is a scaffold. Copernicus dataset selection depends on which
      variable ID you register for. The template below uses the
      Global Ocean Physics Analysis (GLOBAL_ANALYSIS_FORECAST_PHY_001_024)
      which covers seas and very large lakes.
    - For continental lakes, switch to `SATELLITE_LAKE_WATER_TEMPERATURE`
      via CDS.
"""
from __future__ import annotations

import datetime as dt
import logging
import os
from typing import Any

import httpx
from postgrest import APIError
from supabase import Client, create_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("weelake.copernicus")


def get_supabase() -> Client:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing")
    return create_client(url, key)


def fetch_copernicus_marine_temp(lat: float, lng: float) -> dict[str, Any] | None:
    """
    Query CMEMS via the copernicus-marine toolbox (client-only).
    Placeholder: returns None until the toolbox subset script is wired.

    Real implementation should use `copernicus_marine.subset()` to
    download a NetCDF slice around the coordinate, then extract the
    nearest grid cell temperature.
    """
    log.debug("CMEMS fetch stub for %.4f,%.4f", lat, lng)
    return None


def fetch_openmeteo_marine_fallback(lat: float, lng: float) -> dict[str, Any] | None:
    """Open-Meteo Marine as a public, key-free fallback."""
    url = "https://marine-api.open-meteo.com/v1/marine"
    params = {
        "latitude": f"{lat:.4f}",
        "longitude": f"{lng:.4f}",
        "hourly": "sea_surface_temperature",
        "past_days": 1,
        "forecast_days": 1,
        "timezone": "auto",
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
                    "temp_c": float(temps[i]),
                    "measured_at": dt.datetime.fromisoformat(times[i]).astimezone(dt.timezone.utc).isoformat(),
                    "source": "openmeteo_marine",
                    "quality": "medium",
                }
    except Exception as e:
        log.warning("Open-Meteo marine fallback failed: %s", e)
    return None


def refresh_all() -> None:
    supabase = get_supabase()
    lakes = supabase.table("lakes").select("id,slug,lat,lng,type,copernicus_id").execute().data or []
    log.info("Refreshing %d lakes", len(lakes))

    ok = fail = 0
    for lake in lakes:
        result = (
            fetch_copernicus_marine_temp(lake["lat"], lake["lng"])
            or fetch_openmeteo_marine_fallback(lake["lat"], lake["lng"])
        )
        if not result:
            fail += 1
            log.info("· %-24s  no data", lake["slug"])
            continue

        payload = {
            "lake_id": lake["id"],
            "temp_c": result["temp_c"],
            "measured_at": result["measured_at"],
            "source": result["source"],
            "quality": result["quality"],
            "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        }

        try:
            supabase.table("lakes_current").upsert(payload).execute()
            supabase.table("lakes_history").insert({k: v for k, v in payload.items() if k != "updated_at"}).execute()
            ok += 1
            log.info("· %-24s  %.1f°C  (%s)", lake["slug"], result["temp_c"], result["source"])
        except APIError as e:
            fail += 1
            log.error("· %-24s  DB error: %s", lake["slug"], e.message)

    log.info("Done. ok=%d fail=%d total=%d", ok, fail, len(lakes))


if __name__ == "__main__":
    refresh_all()
