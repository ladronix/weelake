# Weelake · Lake Polygon Research

**Status:** research phase (2026-07-23). No implementation shipped
yet — this file captures the options + a proposed path forward.

## The goal

Replace the point marker with the actual shape of the lake once
the user zooms in past a threshold (~z=8). Two motivations:

1. **Visual identity** — a lake IS its shoreline. A pill sitting on
   top of the water looks generic; a shaded polygon of Balaton with
   the pill anchored at the widest point looks like a real lake app.
2. **Hit target** — a polygon is easier to tap than a 20-px pill on
   mobile.

## Constraints

- Weelake currently has 344 lakes. HydroLAKES catalogues ~1.4 M
  globally. Any solution has to work for our shortlist without
  forcing us to ship a 1 GB shapefile.
- Vercel edge caching + s-maxage matters. Polygons need to be cheap
  to serve and cache.
- Client-side: MapLibre already speaks GeoJSON sources; a fetch of
  a single lake's polygon on click, or a bulk fetch of visible-in-
  viewport polygons, both fit our current architecture.

## Data source options

### Option A — HydroLAKES (McGill, 1.4 M lakes)

Full bulk archive: ~1 GB Shapefile / File Geodatabase. License:
CC-BY 4.0. Every lake ≥ 10 ha has a proper polygon.

- ✅ Global coverage. Every non-trivial lake is present.
- ✅ Consistent quality (published as a single research dataset).
- ✅ CC-BY 4.0 — commercial-use OK.
- ❌ 1 GB is way too much to ship — we'd need to preprocess.
- ❌ Distributed as Shapefile, not GeoJSON — needs one-off ETL.

**Path:** one-off Python job (using `geopandas`) that:
  1. downloads HydroLAKES,
  2. filters to only our lake slugs (using centroid distance
     matching against `lakes.lat/lng`),
  3. simplifies polygons to ~50 vertices max (Douglas-Peucker),
  4. writes one GeoJSON per lake to Supabase Storage
     (`lakes-polygons/<slug>.geojson`) OR embeds as a TEXT column
     in the `lakes` table.

Storage cost: 344 × ~2 KB simplified GeoJSON = ~700 KB total. Trivial.
API endpoint `/api/lake/[slug]/polygon` returns cached GeoJSON with
`Cache-Control: public, s-maxage=86400`.

### Option B — OpenStreetMap via Overpass API

Every reasonably famous lake has a `natural=water` relation in OSM
with a real-world polygon. Overpass exposes it via public JSON API.

- ✅ Real-time — OSM is updated by local contributors.
- ✅ Rich metadata (Wikipedia link, boat-launch amenities, etc.)
- ✅ Free, no auth.
- ❌ Public Overpass endpoint has variable latency + rate limits.
- ❌ Quality varies by region. Balaton has perfect polygons;
  smaller Czech reservoirs may only have simplified rings from
  10-year-old imports.

**Path:** one-off scraper that queries Overpass for each
`(name, country_code)` pair, saves the polygon geometry to a
`lake_geometries` table. Same simplification + storage as Option A.

### Option C — Ship only polygons for high-value lakes

Manual approach. Just top ~30 lakes (Great Lakes, Baikal, Constance,
Balaton, Como, Léman, Neusiedler, Ohrid, Sanabria, Bracciano, ...)
get polygons; everything else stays a marker.

- ✅ Instant win for visual impact where it matters most.
- ❌ Doesn't scale — every new "flagship" lake needs manual work.

## Proposed path

**Combine A + B**: HydroLAKES for the base layer (deterministic,
consistent), Overpass for lakes HydroLAKES doesn't cover (small
reservoirs). Store simplified polygons as GeoJSON in a new
`lake_geometries` table with a Supabase RLS policy identical to
`lakes` (public read).

## Schema

```sql
create table public.lake_geometries (
  lake_id      uuid primary key references public.lakes(id) on delete cascade,
  geometry     jsonb not null,             -- GeoJSON MultiPolygon or Polygon
  source       text not null,              -- 'hydrolakes' | 'osm' | 'manual'
  simplified   boolean not null default true,
  vertex_count int,                        -- for observability
  updated_at   timestamptz not null default now()
);
create index on public.lake_geometries using gin (geometry);
```

## Client integration

Two pieces:

1. `GET /api/lake/[slug]/polygon` — returns `{ geometry: GeoJSON }`
   with 24-hour edge cache. Called on map click, before or in
   parallel with the trend fetch.
2. New `lake-polygons` source added to the MapLibre style. Populated
   only when the user is zoomed past z=8 and reads visible polygons
   from a bulk endpoint (say `/api/lakes/polygons?bbox=...`).

For the SelectedSheet: also render the polygon in the header card
above the current gradient block, semi-transparent with the
temperature-bucket colour as fill — turns the sheet into a mini
static preview of the lake.

## Effort estimate

- Schema migration + `/api/lake/[slug]/polygon` endpoint: 2 h
- HydroLAKES ETL script (Python + geopandas): 4-6 h
- Overpass fallback for gaps: 2 h
- MapLibre client render + z=8 gating: 4 h
- SelectedSheet polygon preview: 1 h

Total: ~1 focused day of work, most of it running the ETL and
verifying quality. **Not blocking anything else** — polygons are
pure visual improvement, so this can ship any time after the
higher-priority fetcher / monitoring work is done.
