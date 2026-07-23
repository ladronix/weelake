-- Lake geometries — per-lake polygon (or MultiPolygon) shape.
--
-- Populated by a separate fetcher (services/fetchers/overpass) that
-- queries OpenStreetMap via the Overpass API for the actual shape
-- of every lake we know about. Client renders the polygon as a
-- semi-transparent water-blue fill on the map at zoom >= 6, in
-- addition to the temperature pill.
--
-- Design:
--   - GeoJSON stored as jsonb, not PostGIS geography. Reasons:
--       * We only need to serve the polygon back to a MapLibre
--         source; MapLibre wants GeoJSON.
--       * PostGIS would let us do spatial queries but our access
--         pattern is "give me polygon for this lake_id", which is
--         a primary-key lookup, not a spatial one.
--   - Polygons are pre-simplified (Douglas-Peucker at ~0.001°) by
--     the fetcher so a lake averages ~50 vertices. Full-fidelity
--     shorelines would inflate the payload 10-20x for no visible
--     gain at map zoom levels our users see.
--   - `updated_at` lets us re-fetch only when OSM might have
--     changed the shape (rare, so cadence can be weekly).
--   - `source` records where the polygon came from — mostly OSM
--     but leaves room for a manual override or a HydroLAKES import.
--
-- Access: public read, service-role write. Matches lakes and
-- lakes_current / lakes_history RLS policies.

create table if not exists public.lake_geometries (
  lake_id      uuid primary key references public.lakes(id) on delete cascade,
  geometry     jsonb not null,
  source       text not null check (source in ('osm', 'hydrolakes', 'manual')),
  simplified   boolean not null default true,
  vertex_count int,
  updated_at   timestamptz not null default now()
);

-- Row-level security.
alter table public.lake_geometries enable row level security;

drop policy if exists "public read lake_geometries" on public.lake_geometries;
create policy "public read lake_geometries" on public.lake_geometries
  for select using (true);
