-- Water quality columns + algae risk on lakes_current
alter table public.lakes_current
  add column if not exists quality_index int check (quality_index between 0 and 100),
  add column if not exists algae_risk    text check (algae_risk in ('low','moderate','high','unknown')),
  add column if not exists turbidity_ntu numeric;

-- Same on lakes_history (for evolution)
alter table public.lakes_history
  add column if not exists quality_index int,
  add column if not exists algae_risk    text,
  add column if not exists turbidity_ntu numeric;

comment on column public.lakes_current.quality_index is 'Water quality index 0-100 (higher = cleaner). Composite of turbidity, chlorophyll, transparency.';
comment on column public.lakes_current.algae_risk    is 'Estimated cyanobacterial bloom risk (from chlorophyll-a). Placeholder until Copernicus integration.';
comment on column public.lakes_current.turbidity_ntu is 'Turbidity in NTU (nephelometric turbidity units). Nulls until CDS data flow.';
