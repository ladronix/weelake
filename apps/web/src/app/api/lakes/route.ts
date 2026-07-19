import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";

/**
 * GET /api/lakes
 * List all lakes with current temperature — used by /map and /country pages.
 *
 * Optional: ?country=CZ&limit=1000
 * Cached at edge for 5 minutes.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const country = url.searchParams.get("country")?.toUpperCase();
  const limit = Math.min(5000, parseInt(url.searchParams.get("limit") ?? "2000", 10));

  const supabase = createSupabaseServiceClient();
  let q = supabase
    .from("lakes")
    .select("id, slug, name, name_local, country_code, lat, lng, area_km2, type, importance, lakes_current:lakes_current(temp_c, measured_at, source, quality, quality_index, algae_risk, turbidity_ntu)")
    .order("importance", { ascending: false })
    .limit(limit);

  if (country) q = q.eq("country_code", country);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const lakes = (data ?? []).map((l) => {
    const cur = Array.isArray(l.lakes_current) ? l.lakes_current[0] : l.lakes_current;
    return {
      id: l.id, slug: l.slug, name: l.name, name_local: l.name_local,
      country_code: l.country_code, lat: l.lat, lng: l.lng,
      area_km2: l.area_km2, type: l.type, importance: l.importance,
      temp_c: cur?.temp_c != null ? Number(cur.temp_c) : null,
      measured_at: cur?.measured_at ?? null,
      source: cur?.source ?? null,
      quality: cur?.quality ?? null,
      quality_index: cur?.quality_index ?? null,
      algae_risk: cur?.algae_risk ?? null,
      turbidity_ntu: cur?.turbidity_ntu ?? null,
    };
  });

  return NextResponse.json(
    { count: lakes.length, lakes },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800",
      },
    },
  );
}
