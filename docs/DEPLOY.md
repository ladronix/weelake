# V-Lake · Deployment guide

**Live production checklist.**
This file supersedes the earlier `SETUP.md` for infra-side decisions.

---

## Architecture at a glance

```
                        ┌──────────────────────────┐
                        │  weelake.com (browser)   │
                        └────────────┬─────────────┘
                                     │ HTTPS · edge cache
                        ┌────────────▼─────────────┐
                        │      Vercel (Next.js)    │
                        │  static + edge functions │
                        └────────────┬─────────────┘
                                     │ Supabase REST + RPC
                        ┌────────────▼─────────────┐
                        │   Supabase (Postgres)    │
                        │   PostGIS · RLS · RPC    │
                        └────────────▲─────────────┘
                                     │ upserts
                    ┌────────────────┴────────────────┐
                    │                                 │
       ┌────────────▼───────────┐        ┌────────────▼──────────┐
       │  Node cron (GitHub     │        │ Python cron (Railway) │
       │  Actions · daily 03:00 │        │ Copernicus CDS · 04:00 │
       │  Open-Meteo refresh    │        │ high-quality LSWT     │
       │  + photo backfill      │        │ overrides where data  │
       └────────────────────────┘        └───────────────────────┘
```

**Why this split?**
- **Vercel** for the web: zero-config Next.js, edge CDN, image optimisation
  — cheapest & fastest way to serve a global read-heavy site.
- **Railway** for the Python worker: needs `cdsapi`, `xarray`, `netCDF4` +
  system libraries. GitHub Actions could do it but the build is heavy and
  the payload downloads can hit minute-limits. Railway's Docker service
  keeps the image warm.
- **GitHub Actions** for the light Node worker: Supabase-only, zero external
  data flow — fits inside the 2000-minutes/month free tier easily.

---

## Accounts you need

| # | Service | Purpose | Cost |
|---|---|---|---|
| 1 | **GitHub** — `ladronix/weelake` | Code, CI, cron | Free |
| 2 | **Supabase** — `gjfchiipsqhlsbjkkmdi.supabase.co` | Postgres + PostGIS | Free tier (500 MB) |
| 3 | **Vercel** | Next.js hosting | Hobby (free) |
| 4 | **Cloudflare Registrar** | `weelake.com` domain | ~$10/yr |
| 5 | **Copernicus CDS** | Satellite LSWT | Free (registration) |
| 6 | **Railway** — `weelake` project | Python worker | $5 credit/mo (free tier) |
| 7 | **Umami Cloud** (optional) | Cookie-free analytics | Free ≤ 100k events/mo |

---

## Environment variables

Copy all these to **Vercel → Settings → Environment Variables** and to
**Railway → weelake service → Variables** (Copernicus + Supabase only for the worker).

### Public (safe in the browser)

```
NEXT_PUBLIC_SUPABASE_URL=https://gjfchiipsqhlsbjkkmdi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1Ni…    # from Supabase → Settings → API
NEXT_PUBLIC_SITE_URL=https://weelake.com
NEXT_PUBLIC_SITE_NAME=V-Lake
NEXT_PUBLIC_UMAMI_WEBSITE_ID=                        # optional
NEXT_PUBLIC_HERO_VIDEO=                              # set to "1" after uploading videos
```

### Server-only (never expose in the browser)

```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1Ni…       # from Supabase → Settings → API
CDSAPI_URL=https://cds.climate.copernicus.eu/api
CDSAPI_KEY=<uuid-from-cds-profile>                   # https://cds.climate.copernicus.eu/how-to-api
```

**Never commit these to git.** Rotate the CDS key that was accidentally
committed in `docs/copernikus.md` before shipping.

---

## Step-by-step deploy

### 1. Vercel (web app)

1. https://vercel.com → **Import Git repository → `ladronix/weelake`**
2. **Framework preset:** Next.js (auto-detected)
3. **Root directory:** `.` (the `vercel.json` at the repo root handles the monorepo)
4. **Environment variables:** paste all the `NEXT_PUBLIC_*` and `SUPABASE_SERVICE_ROLE_KEY`
5. **Deploy** — the first build takes ~2 min

### 2. Domain (Cloudflare Registrar)

1. Dashboard → **Registrar → Register Domain → weelake.com**
2. Cloudflare will auto-configure DNS. Add these records:
   ```
   Type   Name   Content                    Proxy
   CNAME  @      cname.vercel-dns.com       DNS-only
   CNAME  www    cname.vercel-dns.com       DNS-only
   ```
3. In Vercel → **Domains → Add → `weelake.com`** → wait for automatic SSL

### 3. Supabase (one-time database setup)

Only needed on first setup. Migrations already applied.

```bash
supabase link --project-ref gjfchiipsqhlsbjkkmdi
supabase db push --linked
supabase db query --linked -f supabase/seed/01_countries.sql
supabase db query --linked -f supabase/seed/02_lakes_mvp.sql
```

### 4. GitHub Actions (Node cron)

1. Repo → **Settings → Secrets and variables → Actions → New secret**
2. Add:
   - `SUPABASE_URL` = `https://gjfchiipsqhlsbjkkmdi.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = service-role key
3. Actions tab → **Daily temperature refresh → Run workflow** — verify it succeeds
4. Cron is now scheduled at 03:00 UTC daily.

### 5. Railway (Python Copernicus worker)

**Prereqs:** account created, Railway CLI installed (`brew install railway`).

```bash
cd services/copernicus-fetcher
railway login
railway link --project weelake         # already created
railway up                             # push code, build Dockerfile
```

Then in the Railway dashboard → **weelake project → variables**:

```
SUPABASE_URL=https://gjfchiipsqhlsbjkkmdi.supabase.co
SUPABASE_SERVICE_ROLE_KEY=…
CDSAPI_URL=https://cds.climate.copernicus.eu/api
CDSAPI_KEY=…
```

**Schedule the cron:**
- Railway → Service → Settings → Cron Schedule → `0 4 * * *` (04:00 UTC daily)

### 6. Analytics (optional)

1. Sign up at https://umami.is
2. Add website `weelake.com`
3. Copy the Website ID
4. Vercel → env vars → `NEXT_PUBLIC_UMAMI_WEBSITE_ID=<uuid>`
5. Redeploy — analytics script loads only in production

---

## Post-deploy verification

Run the smoke test from GitHub Actions:

- **Actions → Smoke test (production) → Run workflow** → default URL

Expected: all six checks pass (landing 200, map 200, /api/stats JSON,
/api/search finds Lipno, robots.txt with Sitemap line, sitemap.xml served).

---

## Ongoing maintenance

| Task | When | How |
|---|---|---|
| Weekly SQL vacuum | Optional monthly | `supabase db query --linked "vacuum analyze;"` |
| Rotate service-role key | On any suspected leak | Supabase → Settings → API → Reset |
| Rebuild photos | When adding new lakes | `pnpm --filter openmeteo-refresh exec tsx src/photos-backfill.ts` |
| Add a new lake | Any time | Insert into `lakes` table; next cron picks it up |
| Prune old history | Every 6 months | `delete from lakes_history where measured_at < now() - interval '180 days';` |

---

## Cost projections

| Scenario | Monthly |
|---|---|
| MVP (<10k pageviews/mo) | $0 |
| Growing (100k pageviews) | Free tiers still hold |
| Scaling (500k+ pageviews) | Supabase Pro $25 + Vercel Pro $20 = ~$45 |
| Global expansion (1M lakes) | Add Cloudflare R2 for static assets ~$5 |

---

## Rollback

Any commit on `main` can be redeployed via Vercel → **Deployments → …→ Redeploy**.
Database migrations are one-way (never destructive); do NOT run
`supabase db reset` against the linked production project.
