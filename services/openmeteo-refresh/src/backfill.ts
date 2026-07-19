/**
 * Weelake · One-shot backfill worker
 *
 * Fetches PAST 14 days of daily water/air temperature for every lake and
 * populates `lakes_history` so the detail-page chart shows a real curve
 * before the daily cron has built up history organically.
 *
 * Data source: Open-Meteo Marine (past_days=14) for coastal / large-lake
 * lakes; falls back to Forecast API daily mean air temperature - 3°C for
 * interior lakes (quality='estimated').
 *
 * Usage:
 *   pnpm --filter openmeteo-refresh exec tsx src/backfill.ts
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
const DAYS = 14;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface Lake {
  id: string;
  slug: string;
  lat: number;
  lng: number;
}

interface Point { measured_at: string; temp_c: number; source: string; quality: "medium" | "estimated" }

async function marineHistory(lat: number, lng: number): Promise<Point[] | null> {
  const url = `${MARINE}?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&daily=sea_surface_temperature_mean&past_days=${DAYS}&forecast_days=1&timezone=UTC`;
  const r = await fetch(url).catch(() => null);
  if (!r?.ok) return null;
  const j = await r.json() as any;
  const times: string[] = j?.daily?.time ?? [];
  const temps: (number|null)[] = j?.daily?.sea_surface_temperature_mean ?? [];
  const out: Point[] = [];
  for (let i = 0; i < times.length; i++) {
    if (temps[i] != null) {
      out.push({
        measured_at: new Date(times[i] + "T12:00:00Z").toISOString(),
        temp_c: Number(temps[i]!.toFixed(2)),
        source: "openmeteo_marine",
        quality: "medium",
      });
    }
  }
  return out.length ? out : null;
}

async function forecastHistory(lat: number, lng: number): Promise<Point[] | null> {
  const url = `${FORECAST}?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&daily=temperature_2m_max,temperature_2m_min&past_days=${DAYS}&forecast_days=1&timezone=UTC`;
  const r = await fetch(url).catch(() => null);
  if (!r?.ok) return null;
  const j = await r.json() as any;
  const times: string[] = j?.daily?.time ?? [];
  const highs: number[] = j?.daily?.temperature_2m_max ?? [];
  const lows:  number[] = j?.daily?.temperature_2m_min ?? [];
  const out: Point[] = [];
  for (let i = 0; i < times.length; i++) {
    const mean = (highs[i] + lows[i]) / 2;
    // Water lags air. In warm season, water ~ 0.85 * air_mean; in cold ~ air_mean + 4.
    // Compromise: air_mean - 2.5°C, clamped to [0, 32].
    const water = Math.max(0, Math.min(32, mean - 2.5));
    out.push({
      measured_at: new Date(times[i] + "T12:00:00Z").toISOString(),
      temp_c: Number(water.toFixed(1)),
      source: "openmeteo_forecast",
      quality: "estimated",
    });
  }
  return out.length ? out : null;
}

async function backfillLake(l: Lake): Promise<number> {
  const points = (await marineHistory(l.lat, l.lng)) ?? (await forecastHistory(l.lat, l.lng));
  if (!points || points.length === 0) return 0;

  const rows = points.map((p) => ({ lake_id: l.id, ...p }));

  // Clear any existing rows in the target window first to avoid mixing.
  const fromIso = new Date(Date.now() - (DAYS + 2) * 86400_000).toISOString();
  await supabase.from("lakes_history").delete().eq("lake_id", l.id).gte("measured_at", fromIso);

  const { error } = await supabase.from("lakes_history").insert(rows);
  if (error) {
    console.error(`[${l.slug}] insert error:`, error.message);
    return 0;
  }

  // Refresh lakes_current from the most recent point.
  const latest = points[points.length - 1];
  await supabase.from("lakes_current").upsert({
    lake_id: l.id,
    temp_c: latest.temp_c,
    measured_at: latest.measured_at,
    source: latest.source,
    quality: latest.quality,
    updated_at: new Date().toISOString(),
  });

  return rows.length;
}

async function main() {
  console.log(`V-Lake · backfill · fetching past ${DAYS} days for all lakes`);
  const { data, error } = await supabase.from("lakes").select("id, slug, lat, lng");
  if (error) { console.error(error); process.exit(1); }
  const list = (data ?? []) as Lake[];

  let totalRows = 0, ok = 0, fail = 0;
  const CONCURRENCY = 4;
  for (let i = 0; i < list.length; i += CONCURRENCY) {
    const chunk = list.slice(i, i + CONCURRENCY);
    const counts = await Promise.all(chunk.map(backfillLake));
    counts.forEach((n, idx) => {
      const l = chunk[idx];
      if (n > 0) {
        ok++; totalRows += n;
        console.log(`  ✓ ${l.slug.padEnd(24)}  ${n} points`);
      } else {
        fail++;
        console.log(`  ✗ ${l.slug.padEnd(24)}  no data`);
      }
    });
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log(`Done. ok=${ok} fail=${fail} total_rows=${totalRows}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
