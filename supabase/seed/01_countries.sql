-- ==============================================================================
-- Weelake · countries seed
-- ISO 3166-1 alpha-2 with flag emoji
-- ==============================================================================

insert into public.countries (code, name, emoji, region, featured) values
  ('CZ', 'Czechia',        '🇨🇿', 'Europe',  true),
  ('AT', 'Austria',        '🇦🇹', 'Europe',  true),
  ('DE', 'Germany',        '🇩🇪', 'Europe',  true),
  ('CH', 'Switzerland',    '🇨🇭', 'Europe',  true),
  ('IT', 'Italy',          '🇮🇹', 'Europe',  true),
  ('FR', 'France',         '🇫🇷', 'Europe',  true),
  ('PL', 'Poland',         '🇵🇱', 'Europe',  true),
  ('SK', 'Slovakia',       '🇸🇰', 'Europe',  true),
  ('HU', 'Hungary',        '🇭🇺', 'Europe',  true),
  ('SI', 'Slovenia',       '🇸🇮', 'Europe',  true),
  ('HR', 'Croatia',        '🇭🇷', 'Europe',  true),
  ('NL', 'Netherlands',    '🇳🇱', 'Europe',  false),
  ('BE', 'Belgium',        '🇧🇪', 'Europe',  false),
  ('SE', 'Sweden',         '🇸🇪', 'Europe',  true),
  ('NO', 'Norway',         '🇳🇴', 'Europe',  true),
  ('FI', 'Finland',        '🇫🇮', 'Europe',  true),
  ('DK', 'Denmark',        '🇩🇰', 'Europe',  false),
  ('IE', 'Ireland',        '🇮🇪', 'Europe',  false),
  ('GB', 'United Kingdom', '🇬🇧', 'Europe',  true),
  ('ES', 'Spain',          '🇪🇸', 'Europe',  true),
  ('PT', 'Portugal',       '🇵🇹', 'Europe',  false),
  ('GR', 'Greece',         '🇬🇷', 'Europe',  false),
  ('IS', 'Iceland',        '🇮🇸', 'Europe',  false),
  ('EE', 'Estonia',        '🇪🇪', 'Europe',  false),
  ('LV', 'Latvia',         '🇱🇻', 'Europe',  false),
  ('LT', 'Lithuania',      '🇱🇹', 'Europe',  false),
  ('RO', 'Romania',        '🇷🇴', 'Europe',  false),
  ('BG', 'Bulgaria',       '🇧🇬', 'Europe',  false),
  ('US', 'United States',  '🇺🇸', 'Americas', true),
  ('CA', 'Canada',         '🇨🇦', 'Americas', true),
  ('AU', 'Australia',      '🇦🇺', 'Oceania',  true),
  ('NZ', 'New Zealand',    '🇳🇿', 'Oceania',  true),
  ('JP', 'Japan',          '🇯🇵', 'Asia',    false)
on conflict (code) do update set
  name = excluded.name,
  emoji = excluded.emoji,
  region = excluded.region,
  featured = excluded.featured;
