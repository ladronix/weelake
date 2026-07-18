/**
 * Weelake · Open-Meteo refresh worker
 *
 * Purpose:
 *   - Iterate every lake in `public.lakes`
 *   - Fetch current water temperature (marine API) and weather (forecast API)
 *   - Upsert into `lakes_current` and append to `lakes_history`
 *
 * Trigger:
 *   - GitHub Actions daily (03:00 UTC)
 *   - Manual: `pnpm --filter openmeteo-refresh start`
 *
 * Note:
 *   Open-Meteo's marine API only covers coastal / very large lakes.
 *   For interior lakes we currently fall back to a heuristic mean of
 *   forecasted air temp minus 3°C (labeled 'estimated' quality).
 *   This is a placeholder until the Copernicus Python worker takes over.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const MARINE   = "https://marine-api.open-meteo.com/v1/marine";
const FORECAST = "https://api.open-meteo.com/v1/forecast";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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
  const url = `${MARINE}?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&hourly=sea_surface_temperature&past_days=1&forecast_days=1&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const j = await res.json() as any;
  const times: string[] = j?.hourly?.time ?? [];
  const temps: (number|null)[] = j?.hourly?.sea_surface_temperature ?? [];
  for (let i = times.length - 1; i >= 0; i--) {
    if (temps[i] != null) return { temp_c: temps[i]!, measured_at: new Date(times[i]).toISOString() };
  }
  return null;
}

async function fetchForecastEstimate(lat: number, lng: number) {
  const url = `${FORECAST}?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=temperature_2m&daily=temperature_2m_max,temperature_2m_min&past_days=7&forecast_days=1&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const j = await res.json() as any;

  // 7-day mean of air max — a rough proxy for surface water in temperate climates.
  const highs: number[] = j?.daily?.temperature_2m_max ?? [];
  const lows: number[] = j?.daily?.temperature_2m_min ?? [];
  if (!highs.length) return null;

  const mean = (highs.reduce((a, b) => a + b, 0) + lows.reduce((a, b) => a + b, 0)) / (highs.length + lows.length);
  // Empirical offset: water lags air, larger lakes have smaller amplitude.
  const est = Math.max(0, mean - 2.5);

  return {
    temp_c: Number(est.toFixed(1)),
    measured_at: new Date().toISOString(),
    quality: "estimated" as const,
  };
}

async function refreshLake(lake: Lake): Promise<{ ok: boolean; source: string; temp?: number }> {
  // Try marine first
  let value: { temp_c: number; measured_at: string } | null = null;
  let source = "openmeteo_marine";
  let quality: "high" | "medium" | "low" | "estimated" = "medium";

  try {
    value = await fetchMarine(lake.lat, lake.lng);
  } catch {}

  if (!value) {
    source = "openmeteo_forecast";
    quality = "estimated";
    const est = await fetchForecastEstimate(lake.lat, lake.lng);
    if (est) value = { temp_c: est.temp_c, measured_at: est.measured_at };
  }

  if (!value) return { ok: false, source: "none" };

  const now = new Date().toISOString();

  // Upsert current
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
  if (eCur) console.error(`[${lake.slug}] current upsert failed:`, eCur.message);

  // Append history
  const { error: eHist } = await supabase
    .from("lakes_history")
    .insert({
      lake_id: lake.id,
      temp_c: value.temp_c,
      measured_at: value.measured_at,
      source,
      quality,
    });
  if (eHist) console.error(`[${lake.slug}] history insert failed:`, eHist.message);

  return { ok: !eCur, source, temp: value.temp_c };
}

async function main() {
  console.log("V-Lake · openmeteo-refresh · start");
  const { data: lakes, error } = await supabase
    .from("lakes")
    .select("id, slug, name, lat, lng, type, area_km2");
  if (error) {
    console.error("Failed to fetch lakes:", error.message);
    process.exit(1);
  }

  const list = (lakes ?? []) as Lake[];
  console.log(`Refreshing ${list.length} lakes…`);

  let ok = 0, fail = 0;
  const CONCURRENCY = 6;
  for (let i = 0; i < list.length; i += CONCURRENCY) {
    const chunk = list.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map(refreshLake));
    results.forEach((r, idx) => {
      const l = chunk[idx];
      if (r.ok) {
        ok++;
        console.log(`  ✓ ${l.slug.padEnd(24)} ${r.temp?.toFixed(1).padStart(5)}°C  (${r.source})`);
      } else {
        fail++;
        console.log(`  ✗ ${l.slug.padEnd(24)} no data`);
      }
    });
    // Be a good citizen — rate-limit gently.
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log(`Done. ok=${ok} fail=${fail} total=${list.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
