import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";

/**
 * GET /api/search
 *  ?q=lipno        → fuzzy name search
 *  ?lat=X&lng=Y    → nearest lakes to a coordinate
 *  &limit=N        → max results (default 10, max 50)
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q     = url.searchParams.get("q")?.trim() ?? "";
  const lat   = parseFloat(url.searchParams.get("lat") ?? "");
  const lng   = parseFloat(url.searchParams.get("lng") ?? "");
  const limit = Math.min(50, parseInt(url.searchParams.get("limit") ?? "10", 10) || 10);

  const supabase = createSupabaseServiceClient();

  // Location-based
  if (!q && !Number.isNaN(lat) && !Number.isNaN(lng)) {
    const { data, error } = await supabase.rpc("nearest_lakes", {
      in_lat: lat, in_lng: lng, radius_km: 500, max_results: limit,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ results: data ?? [], mode: "geo" });
  }

  // Text-based
  if (q.length > 0) {
    const { data, error } = await supabase.rpc("search_lakes", { q, max_results: limit });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ results: data ?? [], mode: "text" });
  }

  return NextResponse.json({ results: [], mode: "empty" });
}
