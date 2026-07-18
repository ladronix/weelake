import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";

/**
 * GET /api/stats
 * Aggregated stats for the landing counter.
 * Cached for 5 minutes at edge.
 */
export async function GET() {
  const supabase = createSupabaseServiceClient();

  const [
    { count: totalLakes },
    { data: allCountries },
    { data: maxRow },
    { data: minRow },
  ] = await Promise.all([
    supabase.from("lakes").select("*", { count: "exact", head: true }),
    supabase.from("lakes").select("country_code"),
    supabase.from("lakes_current").select("temp_c").order("temp_c", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("lakes_current").select("temp_c").order("temp_c", { ascending: true }).limit(1).maybeSingle(),
  ]);

  const uniqueCountries = new Set((allCountries ?? []).map((r) => r.country_code)).size;

  return NextResponse.json(
    {
      total_lakes: totalLakes ?? 0,
      countries_count: uniqueCountries,
      max_temp_c: maxRow?.temp_c ?? null,
      min_temp_c: minRow?.temp_c ?? null,
      updated_at: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800" } },
  );
}
