import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";

/**
 * GET /api/lake/[slug]/polygon
 *
 * Returns the lake's simplified GeoJSON polygon so the map can draw
 * a shaded shape instead of a bare point marker. If we don't have a
 * shape yet (fetcher hasn't run or Overpass returned nothing), we
 * respond with { geometry: null } — the client falls back to the
 * point marker.
 *
 * Cached aggressively at the edge — a lake's shape is essentially
 * static (OSM updates go through a slow weekly refresh cycle).
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const supabase = createSupabaseServiceClient();

  const { data: lake, error: lakeErr } = await supabase
    .from("lakes")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (lakeErr) return NextResponse.json({ error: lakeErr.message }, { status: 500 });
  if (!lake) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: geom } = await supabase
    .from("lake_geometries")
    .select("geometry, source, vertex_count, updated_at")
    .eq("lake_id", lake.id)
    .maybeSingle();

  return NextResponse.json(
    {
      geometry: geom?.geometry ?? null,
      source: geom?.source ?? null,
      vertex_count: geom?.vertex_count ?? null,
      updated_at: geom?.updated_at ?? null,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
