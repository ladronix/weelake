# Weelake · Local development guide

Getting to a running localhost. For production deployment, see **`DEPLOY.md`**.

---

## 1. Accounts to create (~30 min total)

| # | Service | Purpose | Sign-up link | Wait time |
|---|---|---|---|---|
| 1 | **GitHub** | Repo + Actions cron | https://github.com/signup | instant |
| 2 | **Vercel** | Web hosting | https://vercel.com/signup | instant (login with GitHub) |
| 3 | **Supabase** | DB + PostGIS + Storage | https://supabase.com/dashboard/sign-up | instant |
| 4 | **Copernicus CDS** | Satellite lake temperature | https://cds.climate.copernicus.eu/user/register | 1-2 days approval |
| 5 | **Copernicus Marine** | Sea/large-lake temp | https://data.marine.copernicus.eu/register | ~1 day |
| 6 | **Railway** | Python worker (Copernicus) | https://railway.com | instant |
| 7 | **Cloudflare** | DNS + CDN (once domain is bought) | https://dash.cloudflare.com/sign-up | instant |
| 8 | **Domain registrar** | `weelake.com` | Cloudflare Registrar (cheapest) or Namecheap | instant, ~$10 |

Optional (can wait):
- **Sentry** (error tracking) — free tier
- **Plausible** (analytics) — $9/mo or self-hosted
- **Protomaps** (map tiles) — free with attribution

---

## 2. Supabase project setup

1. Create a new project: pick region **eu-central-1** (closest to CZ/AT/DE).
2. Password: generate strong, save to password manager.
3. In *Database → Extensions* enable:
   - `postgis`
   - `pg_trgm`
   - `uuid-ossp`
4. In *Settings → API* copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret)
5. Install Supabase CLI locally:
   ```
   brew install supabase/tap/supabase
   supabase login
   supabase link --project-ref YOUR_REF
   ```
6. Push migrations + seed:
   ```
   supabase db push
   psql "$SUPABASE_DB_URL" -f supabase/seed/01_countries.sql
   psql "$SUPABASE_DB_URL" -f supabase/seed/02_lakes_mvp.sql
   ```

---

## 3. First local run

```bash
# In repo root
cp .env.example .env.local     # fill in Supabase keys
pnpm install
pnpm --filter web dev
```

Open http://localhost:3000 — should show the landing with 60+ lakes.

Trigger a first data refresh:

```bash
pnpm --filter openmeteo-refresh start
```

Reload landing — hottest/coldest lists populate.

---

## 4. Deploy to Vercel

1. Push repo to GitHub.
2. In Vercel: *Add New → Project → Import Git*.
3. Root directory: `apps/web`.
4. Framework: **Next.js** (auto-detected).
5. Add env vars from `.env.local`.
6. Deploy.

---

## 5. Domain

**Recommended:** Buy `weelake.com` via **Cloudflare Registrar** (at cost, ~$10/yr).

1. Cloudflare *Registrar → Register Domain* → weelake.com
2. Add DNS records:
   ```
   CNAME  @    cname.vercel-dns.com
   CNAME  www  cname.vercel-dns.com
   ```
3. In Vercel *Settings → Domains* add `weelake.com` and `www.weelake.com`.

---

## 6. GitHub Actions daily cron

In GitHub repo → *Settings → Secrets and variables → Actions*, add:

- `SUPABASE_URL` — your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — service role key

The `.github/workflows/daily-fetch.yml` will run every day at 03:00 UTC.
Test manually first via *Actions → Daily temperature refresh → Run workflow*.

---

## 7. Copernicus upgrade (optional, phase 2)

Once your CDS account is approved:

1. Save your API key at `~/.cdsapirc`:
   ```
   url: https://cds.climate.copernicus.eu/api/v2
   key: UID:API_KEY
   ```
2. Deploy the Python worker to Railway:
   ```
   railway login
   railway link
   railway up --service copernicus-fetcher
   ```
3. Add env vars on Railway: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CDSAPI_KEY`.
4. Schedule via Railway cron (or GitHub Actions calling the same script).

---

## 8. Post-launch checklist

- [ ] Lighthouse audit → mobile ≥ 95
- [ ] Add sitemap to Google Search Console + Bing Webmaster
- [ ] Post on Product Hunt
- [ ] Post on Hacker News (Show HN)
- [ ] Post on Reddit r/wildswimming, r/dataisbeautiful, r/paddleboarding
- [ ] Announce on Twitter/X + LinkedIn
- [ ] Set up Plausible / Umami analytics
- [ ] Wire Sentry for error tracking

---

## Troubleshooting

**"Missing SUPABASE_URL" during build**
→ Set env vars in Vercel project *before* deploying, or set placeholders in CI.

**MapLibre `Cannot read properties of undefined`**
→ Ensure `maplibre-gl/dist/maplibre-gl.css` is imported in the map component.

**Open-Meteo returns null temperatures**
→ Marine API only covers coastal + very large lakes. Interior lakes fall back
   to `openmeteo_forecast` (estimated). Upgrade to Copernicus for accuracy.

**Fuzzy search returns nothing**
→ Confirm `pg_trgm` extension is enabled: `select * from pg_extension;`
