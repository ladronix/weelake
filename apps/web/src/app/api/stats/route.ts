import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";

/**
 * GET /api/stats
 * Aggregated stats for the landing counter + sync banner.
 * Cached for 5 minutes at edge.
 *
 * Returns:
 *   total_lakes      — how many lakes we know about
 *   countries_count  — how many distinct countries they span
 *   max_temp_c       — warmest current reading
 *   min_temp_c       — coldest current reading
 *   last_sync_at     — the newest `updated_at` across `lakes_current`,
 *                      i.e. when a background worker last successfully
 *                      upserted a temperature into the DB
 *   sources          — { source: count } distribution across
 *                      `lakes_current.source` (e.g. openmeteo_forecast,
 *                      openmeteo_marine, copernicus_cds)
 *   updated_at       — this endpoint's own response timestamp (kept
 *                      for backwards compat with older callers)
 */
export async function GET() {
  const supabase = createSupabaseServiceClient();

  const [
    { count: totalLakes },
    { data: allCountries },
    { data: maxRow },
    { data: minRow },
    { data: latestSync },
    { data: sourcesRaw },
  ] = await Promise.all([
    supabase.from("lakes").select("*", { count: "exact", head: true }),
    supabase.from("lakes").select("country_code"),
    supabase.from("lakes_current").select("temp_c").order("temp_c", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("lakes_current").select("temp_c").order("temp_c", { ascending: true }).limit(1).maybeSingle(),
    supabase.from("lakes_current").select("updated_at").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("lakes_current").select("source"),
  ]);

  const uniqueCountries = new Set((allCountries ?? []).map((r) => r.country_code)).size;

  const sources: Record<string, number> = {};
  for (const row of sourcesRaw ?? []) {
    const key = row.source ?? "unknown";
    sources[key] = (sources[key] ?? 0) + 1;
  }

  return NextResponse.json(
    {
      total_lakes: totalLakes ?? 0,
      countries_count: uniqueCountries,
      max_temp_c: maxRow?.temp_c ?? null,
      min_temp_c: minRow?.temp_c ?? null,
      last_sync_at: latestSync?.updated_at ?? null,
      sources,
      updated_at: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800" } },
  );
}
