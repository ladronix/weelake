-- Deduplication constraint for lakes_history.
--
-- Without this, running the Copernicus refresh worker twice on the
-- same day (or the Open-Meteo worker firing twice) would append
-- duplicate rows for the exact same (lake_id, measured_at, source)
-- triple. The unique index below turns those repeats into no-ops
-- when combined with `on_conflict` on the insert path, and forces
-- future insertions to explicitly resolve the collision.
--
-- Note: two DIFFERENT sources on the same day are NOT collisions
-- and remain distinct rows on purpose — the detail-page chart uses
-- the `source` column to render satellite vs. estimated samples
-- side by side.

-- Remove any existing duplicates that would violate the unique
-- constraint (keep the most recently inserted row per triple).
delete from public.lakes_history a
using public.lakes_history b
where a.ctid < b.ctid
  and a.lake_id     = b.lake_id
  and a.measured_at = b.measured_at
  and a.source      = b.source;

create unique index if not exists lakes_history_lake_time_source_uniq
  on public.lakes_history (lake_id, measured_at, source);
