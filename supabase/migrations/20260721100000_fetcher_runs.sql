-- Fetcher run tracking.
--
-- Every scheduled data fetch (openmeteo, copernicus-lswt, chmi,
-- povodí-*, era5, …) inserts one row on start and updates it on
-- finish. The table lets us:
--
--   1. Show data-freshness to users (SyncBadge already pulls
--      lakes_current.updated_at; this adds per-fetcher last-run
--      timing so we can say 'Copernicus last covered up to
--      2025-12-21, last run 2 hours ago succeeded').
--   2. Alert on stuck fetchers via a simple query (any fetcher
--      whose newest row is 'running' + started_at > 30 min ago
--      probably crashed).
--   3. Compute a rolling success rate + p50 duration per fetcher
--      for the /api/monitor dashboard.
--
-- The table is deliberately tiny (11 columns) so the write path
-- stays fast and doesn't need indexes beyond the one below.

create table if not exists public.fetcher_runs (
  id           uuid primary key default gen_random_uuid(),
  fetcher      text not null,
  role         text not null check (role in ('live', 'recent', 'anchor')),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  status       text not null default 'running'
               check (status in ('running', 'ok', 'partial', 'failed')),
  ok_count     int not null default 0,
  fail_count   int not null default 0,
  skip_count   int not null default 0,
  message      text,
  duration_ms  int
);

-- The only index we need: /api/monitor + the SyncBadge tooltip
-- both ask 'give me the most recent runs per fetcher', which is
-- exactly this DESC lookup.
create index if not exists fetcher_runs_by_fetcher_time
  on public.fetcher_runs (fetcher, started_at desc);

-- Row-level security: publicly readable (dashboard is public), only
-- service_role writes. Consistent with lakes_current / lakes_history.
alter table public.fetcher_runs enable row level security;

drop policy if exists "public read fetcher_runs" on public.fetcher_runs;
create policy "public read fetcher_runs" on public.fetcher_runs
  for select using (true);
