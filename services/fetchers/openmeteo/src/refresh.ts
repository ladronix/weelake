/**
 * Weelake · Open-Meteo fetcher
 *
 * Role: live + recent
 * Cadence: daily at 03:00 UTC (GitHub Actions)
 * Latency: sub-hour real-time
 *
 * For every lake in `public.lakes`:
 *   1. try Open-Meteo Marine (SST — good for coastal + very large lakes)
 *   2. fall back to Open-Meteo Forecast (air-model-derived estimate)
 * and write into `lakes_current` + `lakes_history`.
 *
 * All output goes through the shared fetcher-lib logger so a
 * production run emits structured JSON lines. All HTTP calls are
 * retried with exponential backoff. One `fetcher_runs` row is
 * written per invocation for monitoring.
 */
import {
  createFetcherSupabaseClient,
  makeLogger,
  retry,
  withRun,
} from "@weelake/fetcher-lib";

const MARINE   = "https://marine-api.open-meteo.com/v1/marine";
const FORECAST = "https://api.open-meteo.com/v1/forecast";
const FETCHER  = "openmeteo";
const CONCURRENCY = 6;

const log = makeLogger(FETCHER);
const supabase = createFetcherSupabaseClient();

interface Lake {
  id: string;
  slug: string;
  name: string;
  lat: number;
  lng: number;
  type: string;
  area_km2: number | null;
}

async function fetchMarine(lat: number, lng: number) {
  const url =
    `${MARINE}?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&hourly=sea_surface_temperature&past_days=1&forecast_days=1&timezone=auto`;
  const res = await retry(() => fetch(url), { log, label: "openmeteo.marine" });
  if (!res.ok) return null;
  const j = (await res.json()) as {
    hourly?: { time?: string[]; sea_surface_temperature?: (number | null)[] };
  };
  const times = j.hourly?.time ?? [];
  const temps = j.hourly?.sea_surface_temperature ?? [];
  for (let i = times.length - 1; i >= 0; i--) {
    if (temps[i] != null) {
      return { temp_c: temps[i]!, measured_at: new Date(times[i]).toISOString() };
    }
  }
  return null;
}

async function fetchForecastEstimate(lat: number, lng: number) {
  const url =
    `${FORECAST}?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&current=temperature_2m&daily=temperature_2m_max,temperature_2m_min` +
    `&past_days=7&forecast_days=1&timezone=auto`;
  const res = await retry(() => fetch(url), { log, label: "openmeteo.forecast" });
  if (!res.ok) return null;
  const j = (await res.json()) as {
    daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[] };
  };

  const highs = j.daily?.temperature_2m_max ?? [];
  const lows = j.daily?.temperature_2m_min ?? [];
  if (highs.length === 0) return null;

  const mean =
    (highs.reduce((a, b) => a + b, 0) + lows.reduce((a, b) => a + b, 0)) /
    (highs.length + lows.length);
  // Empirical offset: water lags air by ~2.5°C in temperate climates.
  const est = Math.max(0, mean - 2.5);
  return { temp_c: Number(est.toFixed(1)), measured_at: new Date().toISOString() };
}

async function refreshLake(lake: Lake): Promise<{ ok: boolean; source: string; temp?: number }> {
  let value: { temp_c: number; measured_at: string } | null = null;
  let source = "openmeteo_marine";
  let quality: "high" | "medium" | "low" | "estimated" = "medium";

  try {
    value = await fetchMarine(lake.lat, lake.lng);
  } catch {
    // fall through to forecast estimate
  }

  if (!value) {
    source = "openmeteo_forecast";
    quality = "estimated";
    const est = await fetchForecastEstimate(lake.lat, lake.lng);
    if (est) value = est;
  }

  if (!value) return { ok: false, source: "none" };

  const now = new Date().toISOString();
  const { error: eCur } = await supabase
    .from("lakes_current")
    .upsert({
      lake_id: lake.id,
      temp_c: value.temp_c,
      measured_at: value.measured_at,
      source,
      quality,
      updated_at: now,
    });
  if (eCur) {
    log.error({ event: "lake.upsert_failed", slug: lake.slug, target: "lakes_current", message: eCur.message });
  }

  const { error: eHist } = await supabase
    .from("lakes_history")
    .upsert(
      {
        lake_id: lake.id,
        temp_c: value.temp_c,
        measured_at: value.measured_at,
        source,
        quality,
      },
      { onConflict: "lake_id,measured_at,source", ignoreDuplicates: true },
    );
  if (eHist) {
    log.error({ event: "lake.upsert_failed", slug: lake.slug, target: "lakes_history", message: eHist.message });
  }

  return { ok: !eCur, source, temp: value.temp_c };
}

async function main() {
  await withRun(supabase, FETCHER, "live", log, async (counts) => {
    const { data: lakes, error } = await supabase
      .from("lakes")
      .select("id, slug, name, lat, lng, type, area_km2");
    if (error) throw new Error(`lakes read failed: ${error.message}`);

    const list = (lakes ?? []) as Lake[];
    log.info({ event: "run.plan", lakes: list.length });

    for (let i = 0; i < list.length; i += CONCURRENCY) {
      const chunk = list.slice(i, i + CONCURRENCY);
      const results = await Promise.all(chunk.map(refreshLake));
      results.forEach((r, idx) => {
        const l = chunk[idx];
        if (r.ok) {
          counts.ok++;
          log.info({ event: "lake.ok", slug: l.slug, temp_c: r.temp, source: r.source });
        } else {
          counts.fail++;
          log.warn({ event: "lake.fail", slug: l.slug });
        }
      });
      // Be a good citizen with Open-Meteo's public endpoint.
      await new Promise((r) => setTimeout(r, 250));
    }
  });
}

main().catch((e) => {
  // withRun already logged run.crash; exit non-zero for the CI status.
  console.error(e);
  process.exit(1);
});
