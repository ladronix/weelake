-- ==============================================================================
-- Weelake · V-Lake · initial schema
-- Postgres 15+ with PostGIS
-- ==============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists postgis;
create extension if not exists pg_trgm;   -- fulltext / fuzzy search

-- ------------------------------------------------------------------------------
-- LAKES · master registry
-- ------------------------------------------------------------------------------
create table if not exists public.lakes (
  id             uuid primary key default uuid_generate_v4(),
  slug           text not null unique,
  name           text not null,
  name_local     text,
  country_code   char(2) not null,
  region         text,
  lat            double precision not null,
  lng            double precision not null,
  geom           geography(Point, 4326) generated always as (
                   st_setsrid(st_makepoint(lng, lat), 4326)::geography
                 ) stored,
  bbox           geometry(Polygon, 4326),
  area_km2       numeric,
  max_depth_m    numeric,
  mean_depth_m   numeric,
  elevation_m    numeric,
  type           text not null default 'lake'
                   check (type in ('lake','reservoir','sea','lagoon','pond')),
  importance     smallint not null default 5 check (importance between 1 and 10),
  photo_url      text,
  wiki_url       text,
  copernicus_id  text,
  hydrolakes_id  bigint,
  osm_id         bigint,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists lakes_country_idx  on public.lakes (country_code);
create index if not exists lakes_geom_idx     on public.lakes using gist (geom);
create index if not exists lakes_importance_idx on public.lakes (importance desc);
create index if not exists lakes_name_trgm_idx on public.lakes
  using gin (name gin_trgm_ops);
create index if not exists lakes_name_local_trgm_idx on public.lakes
  using gin (name_local gin_trgm_ops);

-- ------------------------------------------------------------------------------
-- LAKES_CURRENT · latest known temperature (upsert 1× / day)
-- ------------------------------------------------------------------------------
create table if not exists public.lakes_current (
  lake_id       uuid primary key references public.lakes(id) on delete cascade,
  temp_c        numeric not null,
  measured_at   timestamptz not null,
  source        text not null,
  quality       text not null default 'medium'
                  check (quality in ('high','medium','low','estimated')),
  updated_at    timestamptz not null default now()
);

create index if not exists lakes_current_temp_idx on public.lakes_current (temp_c);
create index if not exists lakes_current_updated_idx on public.lakes_current (updated_at desc);

-- ------------------------------------------------------------------------------
-- LAKES_HISTORY · append-only, ≥ 7 days
-- ------------------------------------------------------------------------------
create table if not exists public.lakes_history (
  id            bigserial primary key,
  lake_id       uuid not null references public.lakes(id) on delete cascade,
  temp_c        numeric not null,
  measured_at   timestamptz not null,
  source        text not null,
  quality       text not null default 'medium',
  created_at    timestamptz not null default now()
);

create index if not exists lakes_history_lake_time_idx
  on public.lakes_history (lake_id, measured_at desc);
create index if not exists lakes_history_time_idx
  on public.lakes_history (measured_at desc);

-- ------------------------------------------------------------------------------
-- WEATHER_CACHE · short-TTL cache for Open-Meteo calls (deduplicate)
-- ------------------------------------------------------------------------------
create table if not exists public.weather_cache (
  lake_id       uuid primary key references public.lakes(id) on delete cascade,
  payload       jsonb not null,     -- WeatherSnapshot serialized
  forecast      jsonb,              -- 7-day forecast array
  fetched_at    timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- STATS_SNAPSHOT · materialized values for landing (refreshed by cron)
-- ------------------------------------------------------------------------------
create table if not exists public.stats_snapshot (
  key           text primary key,
  value         jsonb not null,
  updated_at    timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- COUNTRIES · reference data (ISO alpha-2 + flag emoji + display name)
-- ------------------------------------------------------------------------------
create table if not exists public.countries (
  code          char(2) primary key,
  name          text not null,
  emoji         text not null,
  region        text,
  featured      boolean not null default false
);

-- ------------------------------------------------------------------------------
-- RLS · public read, service-role write
-- ------------------------------------------------------------------------------
alter table public.lakes           enable row level security;
alter table public.lakes_current   enable row level security;
alter table public.lakes_history   enable row level security;
alter table public.weather_cache   enable row level security;
alter table public.stats_snapshot  enable row level security;
alter table public.countries       enable row level security;

create policy "public read lakes"          on public.lakes          for select using (true);
create policy "public read current"        on public.lakes_current  for select using (true);
create policy "public read history"        on public.lakes_history  for select using (true);
create policy "public read weather"        on public.weather_cache  for select using (true);
create policy "public read stats"          on public.stats_snapshot for select using (true);
create policy "public read countries"      on public.countries      for select using (true);

-- ------------------------------------------------------------------------------
-- HELPER FUNCTIONS
-- ------------------------------------------------------------------------------

-- Fuzzy search lakes by name (used by /api/search)
create or replace function public.search_lakes(q text, max_results int default 20)
returns table (
  id uuid,
  slug text,
  name text,
  name_local text,
  country_code char(2),
  lat double precision,
  lng double precision,
  temp_c numeric,
  measured_at timestamptz,
  score real
)
language sql
stable
as $$
  select
    l.id, l.slug, l.name, l.name_local, l.country_code, l.lat, l.lng,
    c.temp_c, c.measured_at,
    greatest(
      similarity(l.name, q),
      coalesce(similarity(l.name_local, q), 0)
    ) as score
  from public.lakes l
  left join public.lakes_current c on c.lake_id = l.id
  where l.name ilike '%' || q || '%'
     or l.name_local ilike '%' || q || '%'
     or similarity(l.name, q) > 0.2
  order by score desc, l.importance desc
  limit max_results;
$$;

-- Nearest lakes to a coordinate
create or replace function public.nearest_lakes(
  in_lat double precision,
  in_lng double precision,
  radius_km double precision default 100,
  max_results int default 20
)
returns table (
  id uuid,
  slug text,
  name text,
  country_code char(2),
  lat double precision,
  lng double precision,
  temp_c numeric,
  distance_km numeric
)
language sql
stable
as $$
  select
    l.id, l.slug, l.name, l.country_code, l.lat, l.lng,
    c.temp_c,
    round((st_distance(l.geom, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography) / 1000.0)::numeric, 2) as distance_km
  from public.lakes l
  left join public.lakes_current c on c.lake_id = l.id
  where st_dwithin(l.geom, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography, radius_km * 1000)
  order by l.geom <-> st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography
  limit max_results;
$$;

-- Timestamp trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists lakes_set_updated_at on public.lakes;
create trigger lakes_set_updated_at
  before update on public.lakes
  for each row execute function public.set_updated_at();
