import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { fetchWeather } from "@/lib/openmeteo";

/**
 * GET /api/lake/[slug]/trend
 *
 * Compact trend payload for the map's SelectedSheet mini-chart —
 * strictly cheaper than /api/lake/[slug] which returns the whole
 * detail-page dataset. Runs two parallel reads:
 *
 *   1. lakes_history over the last 8 days (water temperature,
 *      grouped daily by any 'source' — we prefer the freshest
 *      row per date so the line stays consistent).
 *
 *   2. Open-Meteo forecast for the same lat/lng — we keep the
 *      last 7 days of AIR temperature (daily max/min → mean)
 *      so the two series share the same X axis.
 *
 * Response shape:
 *   [{ t: "2026-07-14", water: 21.4, air: 26.9 }, ...]
 *
 * `t` is the ISO date (YYYY-MM-DD). `water` / `air` may be null
 * for a specific date if we don't have that source's reading.
 * The chart handles null gaps by breaking the polyline.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const supabase = createSupabaseServiceClient();

  const { data: lake, error } = await supabase
    .from("lakes")
    .select("id, lat, lng")
    .eq("slug", slug)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!lake) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 3600e3).toISOString();

  // Water history — pull all sources, deduplicate to one row per
  // date preferring the freshest measurement.
  const historyPromise = supabase
    .from("lakes_history")
    .select("temp_c, measured_at, source")
    .eq("lake_id", lake.id)
    .gte("measured_at", eightDaysAgo)
    .order("measured_at", { ascending: true });

  // Air temp — daily historical + short forecast so the current
  // day's air matches the map view.
  const airPromise = fetchWeather(lake.lat, lake.lng).catch(() => null);

  const [{ data: history }, weather] = await Promise.all([historyPromise, airPromise]);

  // Group water history by date, keeping the last row per date.
  const waterByDate = new Map<string, number>();
  for (const row of history ?? []) {
    if (row.temp_c == null) continue;
    const date = row.measured_at.slice(0, 10);
    waterByDate.set(date, row.temp_c);
  }

  // Build air-by-date map from Open-Meteo daily bins.
  const airByDate = new Map<string, number>();
  if (weather?.daily) {
    for (let i = 0; i < weather.daily.time.length; i++) {
      const max = weather.daily.temperature_2m_max[i];
      const min = weather.daily.temperature_2m_min[i];
      if (max == null || min == null) continue;
      airByDate.set(weather.daily.time[i], (max + min) / 2);
    }
  }

  // Build the last 8 date buckets so both series align even if
  // one is missing entries for some days.
  const points: Array<{ t: string; water: number | null; air: number | null }> = [];
  const today = new Date();
  for (let i = 7; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    points.push({
      t: iso,
      water: waterByDate.get(iso) ?? null,
      air: airByDate.get(iso) ?? null,
    });
  }

  return NextResponse.json(
    { points },
    {
      headers: {
        // Client-cache aggressively — a lake's 7-day trend barely
        // changes minute-to-minute, and re-clicking the same pin
        // shouldn't re-hit the DB.
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
      },
    },
  );
}
