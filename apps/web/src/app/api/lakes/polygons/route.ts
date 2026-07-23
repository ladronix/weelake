import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";

/**
 * GET /api/lakes/polygons
 *
 * Returns EVERY lake polygon we have as a single GeoJSON
 * FeatureCollection, plus a `lake_id` + `slug` in each feature's
 * properties so the map can associate a polygon with its
 * temperature pill.
 *
 * Payload size: ~50 polygons × ~50 vertices × 15 bytes ≈ 40 KB
 * for the current run of 344 lakes (only Balaton so far but
 * scales linearly). Cached 24h at the edge and further cached
 * client-side (immutable-ish), so the map fetches this once per
 * session.
 *
 * We deliberately keep this as one bulk endpoint rather than one
 * request per lake because MapLibre's `data` on a geojson source
 * expects a single URL or object; per-lake requests would need N
 * separate sources or a client-side aggregation step.
 */
type LakeRow = {
  lake_id: string;
  geometry: unknown;
  lakes: { slug: string; name: string } | null;
};

export async function GET() {
  const supabase = createSupabaseServiceClient();

  // Foreign-key traversal so we get the slug + name on each row
  // without a second round-trip.
  const { data, error } = await supabase
    .from("lake_geometries")
    .select("lake_id, geometry, lakes!inner(slug, name)");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = ((data ?? []) as unknown[]).map((r) => {
    const row = r as LakeRow;
    return {
      type: "Feature" as const,
      geometry: row.geometry,
      properties: {
        lake_id: row.lake_id,
        slug: row.lakes?.slug ?? null,
        name: row.lakes?.name ?? null,
      },
    };
  });

  return NextResponse.json(
    { type: "FeatureCollection", features: rows },
    {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
