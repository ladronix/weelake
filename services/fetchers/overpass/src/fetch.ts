/**
 * Weelake · OpenStreetMap Overpass polygon fetcher
 *
 * Role: registry (writes to lake_geometries, not lakes_current)
 * Cadence: weekly is fine; OSM shorelines are stable
 * Latency: n/a — shape data, not temperature
 *
 * For every lake in `public.lakes` that doesn't have a
 * lake_geometries row yet, query OpenStreetMap's Overpass API
 * for a `natural=water` feature within ~2 km of the lake's
 * point, extract its polygon, simplify it to ~50 vertices, and
 * upsert into `lake_geometries`.
 *
 * ============================================================
 * Rate-limit notes for the public Overpass endpoint:
 *   - default 25 s query timeout, 512 MB memory
 *   - one worker at a time is the safest default; two is OK
 *   - burst > 5 concurrent requests will be shed
 * We use CONCURRENCY = 2 with 500 ms breather between requests.
 * A full 344-lake run takes ~5 minutes.
 * ============================================================
 *
 * The polygon lookup query uses `around:2000` (2 km radius from
 * the lake's centre point). This is deliberately loose — OSM's
 * `natural=water` polygon centroid can sit a few hundred metres
 * from our seed coordinate depending on shore geometry. We pick
 * the largest polygon returned (by vertex count) as the winner;
 * that ensures we get the main basin, not a nearby smaller pond.
 *
 * Simplification: Douglas-Peucker with tolerance 0.001° which
 * translates to roughly 100 m at Weelake latitudes. A large
 * multi-basin lake ends up at ~50-100 vertices, a small
 * reservoir at ~20. Total payload stays under 100 KB even at
 * 1000 lakes.
 */
import {
  createFetcherSupabaseClient,
  makeLogger,
  retry,
  withRun,
} from "@weelake/fetcher-lib";

const FETCHER = "overpass";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const USER_AGENT = "Weelake/1.0 (+https://weelake.com; hello@weelake.com)";
// Overpass public endpoint is generous but not infinite: 2 slots
// per client, 15s query cost budget refills at 2/s. Two workers +
// a 2s inter-request breather has held up cleanly for 344 lakes
// in past runs — bursting faster earns 429s inside the first
// dozen requests.
const CONCURRENCY = 2;
const INTER_REQUEST_MS = 2000;
const SIMPLIFY_TOLERANCE_DEG = 0.001;
const REBUILD = process.argv.includes("--rebuild");
const ONE_SLUG = process.argv.includes("--one")
  ? process.argv[process.argv.indexOf("--one") + 1]
  : null;

const log = makeLogger(FETCHER);
const supabase = createFetcherSupabaseClient();

interface Lake {
  id: string;
  slug: string;
  name: string;
  lat: number;
  lng: number;
  area_km2: number | null;
}

/** GeoJSON position type. */
type Position = [number, number];
type Ring = Position[];

interface PolygonGeom {
  type: "Polygon";
  coordinates: Ring[]; // [outer, ...inner]
}
interface MultiPolygonGeom {
  type: "MultiPolygon";
  coordinates: Ring[][];
}
type LakeGeometry = PolygonGeom | MultiPolygonGeom;

// --------------------------------------------------------------
// Overpass query
// --------------------------------------------------------------

/**
 * Build an Overpass QL query that asks for any natural=water or
 * water=* polygon (way or relation) whose centre is within
 * `aroundMeters` of a point, returning full geometry.
 *
 * `aroundMeters` scales with the lake's area — small lakes use
 * a tight 500m radius (avoids grabbing neighbouring water), big
 * lakes need up to 50 km because our seed lat/lng is the lake
 * centre, but the polygon boundary lives on the shore. Overpass
 * `around` checks distance to any polygon node, so we need enough
 * radius to reach the shore from centre.
 */
function overpassQuery(lat: number, lng: number, aroundMeters: number): string {
  return `
    [out:json][timeout:25];
    (
      way(around:${aroundMeters},${lat},${lng})["natural"="water"];
      relation(around:${aroundMeters},${lat},${lng})["natural"="water"];
      way(around:${aroundMeters},${lat},${lng})["water"];
      relation(around:${aroundMeters},${lat},${lng})["water"];
    );
    out geom;
  `;
}

/**
 * Rule of thumb: for a roughly circular lake of area A km², the
 * distance from centre to shore is √(A/π). Multiply by 1.5 to give
 * Overpass some slack for irregular shorelines. Clamp to a floor
 * of 500m (small lakes) and a ceiling of 50 km (Balaton, Ladoga).
 */
function aroundRadiusMeters(areaKm2: number | null): number {
  if (!areaKm2 || areaKm2 <= 0) return 2000;
  const centreToShoreKm = Math.sqrt(areaKm2 / Math.PI) * 1.5;
  const metres = Math.round(centreToShoreKm * 1000);
  return Math.max(500, Math.min(50000, metres));
}

interface OverpassResponse {
  elements: OverpassElement[];
}

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
  members?: Array<{
    type: "node" | "way" | "relation";
    ref: number;
    role: string;
    geometry?: Array<{ lat: number; lon: number }>;
  }>;
}

async function overpassLookup(lat: number, lng: number, aroundMeters: number): Promise<OverpassResponse | null> {
  const body = "data=" + encodeURIComponent(overpassQuery(lat, lng, aroundMeters));
  const res = await retry(
    () =>
      fetch(OVERPASS_URL, {
        method: "POST",
        headers: {
          "User-Agent": USER_AGENT,
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
        body,
      }),
    { log, label: "overpass", attempts: 3, baseDelayMs: 3000 },
  );
  if (!res.ok) return null;
  return (await res.json()) as OverpassResponse;
}

// --------------------------------------------------------------
// OSM → GeoJSON
// --------------------------------------------------------------

/**
 * Convert an Overpass way (list of geometry points) into a GeoJSON
 * closed ring. OSM ways for closed water bodies already start and
 * end on the same node; we defensively close if they don't.
 */
function wayToRing(geom: Array<{ lat: number; lon: number }>): Ring | null {
  if (!geom || geom.length < 3) return null;
  const ring: Ring = geom.map((p) => [p.lon, p.lat] as Position);
  const [ax, ay] = ring[0];
  const [bx, by] = ring[ring.length - 1];
  if (ax !== bx || ay !== by) ring.push([ax, ay]);
  return ring;
}

/** Vertex count on a ring, minus the duplicated closing vertex. */
function ringVertices(ring: Ring): number {
  return Math.max(0, ring.length - 1);
}

/**
 * Pick the "best" element from an Overpass response as the lake's
 * shape. Best = largest by vertex count, on the theory that the
 * real lake polygon is more detailed than nearby small ponds.
 */
function selectBest(elements: OverpassElement[]): OverpassElement | null {
  let best: { el: OverpassElement; vertices: number } | null = null;
  for (const el of elements) {
    let vertices = 0;
    if (el.type === "way" && el.geometry) {
      vertices = el.geometry.length;
    } else if (el.type === "relation" && el.members) {
      for (const m of el.members) {
        if (m.geometry) vertices += m.geometry.length;
      }
    }
    if (vertices === 0) continue;
    if (!best || vertices > best.vertices) best = { el, vertices };
  }
  return best?.el ?? null;
}

/**
 * Assemble a GeoJSON Polygon or MultiPolygon from an Overpass element.
 * Relations become MultiPolygons; ways become Polygons.
 *
 * We do NOT attempt to correctly assemble inner rings ("holes") from
 * relations here — a water body's islands are visually nice but the
 * added complexity of matching outer/inner roles across way members
 * is not worth the effort for this initial version. Water renders
 * as a single outer polygon per member.
 */
function elementToGeometry(el: OverpassElement): LakeGeometry | null {
  if (el.type === "way" && el.geometry) {
    const ring = wayToRing(el.geometry);
    if (!ring) return null;
    return { type: "Polygon", coordinates: [ring] };
  }
  if (el.type === "relation" && el.members) {
    const rings: Ring[] = [];
    for (const m of el.members) {
      if (m.type !== "way" || !m.geometry) continue;
      if (m.role !== "outer" && m.role !== "") continue;
      const ring = wayToRing(m.geometry);
      if (ring) rings.push(ring);
    }
    if (rings.length === 0) return null;
    if (rings.length === 1) return { type: "Polygon", coordinates: [rings[0]] };
    return { type: "MultiPolygon", coordinates: rings.map((r) => [r]) };
  }
  return null;
}

// --------------------------------------------------------------
// Douglas-Peucker simplification
// --------------------------------------------------------------

/** Perpendicular distance from point p to line ab. */
function perpDist(p: Position, a: Position, b: Position): number {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  const projx = ax + t * dx;
  const projy = ay + t * dy;
  return Math.hypot(px - projx, py - projy);
}

function simplifyRing(ring: Ring, tolerance: number): Ring {
  if (ring.length <= 3) return ring;
  // Douglas-Peucker iterative.
  const keep = new Array(ring.length).fill(false);
  keep[0] = keep[ring.length - 1] = true;
  const stack: Array<[number, number]> = [[0, ring.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    let maxDist = 0;
    let idx = -1;
    for (let i = start + 1; i < end; i++) {
      const d = perpDist(ring[i], ring[start], ring[end]);
      if (d > maxDist) { maxDist = d; idx = i; }
    }
    if (maxDist > tolerance && idx > -1) {
      keep[idx] = true;
      stack.push([start, idx]);
      stack.push([idx, end]);
    }
  }
  const out: Ring = [];
  for (let i = 0; i < ring.length; i++) if (keep[i]) out.push(ring[i]);
  return out;
}

function simplifyGeometry(geom: LakeGeometry): LakeGeometry {
  if (geom.type === "Polygon") {
    return { type: "Polygon", coordinates: geom.coordinates.map((r) => simplifyRing(r, SIMPLIFY_TOLERANCE_DEG)) };
  }
  return {
    type: "MultiPolygon",
    coordinates: geom.coordinates.map((poly) =>
      poly.map((r) => simplifyRing(r, SIMPLIFY_TOLERANCE_DEG)),
    ),
  };
}

function countVertices(geom: LakeGeometry): number {
  if (geom.type === "Polygon") return geom.coordinates.reduce((n, r) => n + ringVertices(r), 0);
  return geom.coordinates.reduce(
    (n, poly) => n + poly.reduce((m, r) => m + ringVertices(r), 0),
    0,
  );
}

// --------------------------------------------------------------
// Fetch + upsert per lake
// --------------------------------------------------------------

async function processLake(lake: Lake): Promise<"ok" | "skip" | "fail"> {
  // Skip if we already have a shape (unless --rebuild).
  if (!REBUILD) {
    const { data } = await supabase
      .from("lake_geometries")
      .select("lake_id")
      .eq("lake_id", lake.id)
      .maybeSingle();
    if (data) {
      log.debug({ event: "lake.skip_have_geom", slug: lake.slug });
      return "skip";
    }
  }

  const around = aroundRadiusMeters(lake.area_km2);
  const resp = await overpassLookup(lake.lat, lake.lng, around);
  if (!resp || !resp.elements || resp.elements.length === 0) {
    log.warn({ event: "lake.no_overpass_result", slug: lake.slug });
    return "fail";
  }

  const best = selectBest(resp.elements);
  if (!best) {
    log.warn({ event: "lake.no_polygon_candidate", slug: lake.slug });
    return "fail";
  }
  const raw = elementToGeometry(best);
  if (!raw) {
    log.warn({ event: "lake.geometry_extract_failed", slug: lake.slug });
    return "fail";
  }
  const simplified = simplifyGeometry(raw);
  const vertices = countVertices(simplified);

  const { error } = await supabase.from("lake_geometries").upsert({
    lake_id: lake.id,
    geometry: simplified,
    source: "osm",
    simplified: true,
    vertex_count: vertices,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    log.error({ event: "lake.upsert_failed", slug: lake.slug, message: error.message });
    return "fail";
  }
  log.info({
    event: "lake.ok",
    slug: lake.slug,
    osm_type: best.type,
    osm_id: best.id,
    vertices,
    kind: simplified.type,
  });
  return "ok";
}

// --------------------------------------------------------------
// Main loop
// --------------------------------------------------------------

async function main() {
  await withRun(supabase, FETCHER, "recent", log, async (counts) => {
    let q = supabase.from("lakes").select("id, slug, name, lat, lng, area_km2");
    if (ONE_SLUG) q = q.eq("slug", ONE_SLUG);
    const { data: lakes, error } = await q;
    if (error) throw new Error(`lakes read failed: ${error.message}`);

    const list = (lakes ?? []) as Lake[];
    log.info({ event: "run.plan", lakes: list.length, rebuild: REBUILD, one: ONE_SLUG });

    for (let i = 0; i < list.length; i += CONCURRENCY) {
      const chunk = list.slice(i, i + CONCURRENCY);
      const results = await Promise.all(chunk.map(processLake));
      for (const r of results) {
        if (r === "ok") counts.ok++;
        else if (r === "skip") counts.skip++;
        else counts.fail++;
      }
      // Overpass rate-limit breather.
      await new Promise((r) => setTimeout(r, INTER_REQUEST_MS));
    }
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
