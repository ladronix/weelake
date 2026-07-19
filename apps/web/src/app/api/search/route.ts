import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";

/**
 * GET /api/search
 *  ?q=lipno        → fuzzy name search
 *  ?lat=X&lng=Y    → nearest lakes to a coordinate
 *  ?featured=1     → curated top lakes for empty-state autocomplete
 *  &limit=N        → max results (default 10, max 50)
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q     = url.searchParams.get("q")?.trim() ?? "";
  const lat   = parseFloat(url.searchParams.get("lat") ?? "");
  const lng   = parseFloat(url.searchParams.get("lng") ?? "");
  const featured = url.searchParams.get("featured") === "1";
  const limit = Math.min(50, parseInt(url.searchParams.get("limit") ?? "10", 10) || 10);

  const supabase = createSupabaseServiceClient();

  // Featured — most-important lakes for the empty-state search dropdown.
  // Cached aggressively because the list is stable.
  if (featured) {
    const { data, error } = await supabase
      .from("lakes")
      .select("id, slug, name, name_local, country_code, lat, lng, photo_url, lakes_current:lakes_current(temp_c)")
      .order("importance", { ascending: false })
      .order("area_km2", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const results = (data ?? []).map((r) => {
      const cur = Array.isArray(r.lakes_current) ? r.lakes_current[0] : r.lakes_current;
      return {
        id: r.id,
        slug: r.slug,
        name: r.name,
        name_local: r.name_local,
        country_code: r.country_code,
        lat: r.lat,
        lng: r.lng,
        photo_url: r.photo_url,
        temp_c: cur?.temp_c != null ? Number(cur.temp_c) : null,
      };
    });
    return NextResponse.json(
      { results, mode: "featured" },
      { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } },
    );
  }

  // Location-based
  if (!q && !Number.isNaN(lat) && !Number.isNaN(lng)) {
    const { data, error } = await supabase.rpc("nearest_lakes", {
      in_lat: lat, in_lng: lng, radius_km: 800, max_results: limit,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(
      { results: data ?? [], mode: "geo" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // Text-based
  if (q.length > 0) {
    const { data, error } = await supabase.rpc("search_lakes", { q, max_results: limit });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(
      { results: data ?? [], mode: "text" },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  }

  return NextResponse.json({ results: [], mode: "empty" });
}
