# Weelake · Onboarding — tvoje 30 minut

Repo: **git@github.com:ladronix/weelake.git**
Supabase: **https://gjfchiipsqhlsbjkkmdi.supabase.co**

Přesné pořadí, co udělat teď hned.

---

## ✅ Hotovo (udělal jsem)

- [x] Monorepo scaffold (Next.js 15 + Tailwind + MapLibre + Supabase)
- [x] 65 jezer v seedu (CZ, AT, DE, CH, IT, HU, SI/HR, SE/NO/FI, GB, FR, ES, US, CA, NZ, AU)
- [x] 33 zemí s vlajkami
- [x] Landing s hero, search, live stats, mini-map, country grid, hot/cold
- [x] Mapa MapLibre + heatmap vrstva + filtry + bottom sheet
- [x] Detail jezera s 7-day chartem, počasím, forecastem, swim safety verdict
- [x] API routes: `/api/lakes`, `/api/lake/[slug]`, `/api/search`, `/api/stats`
- [x] PWA manifest, sitemap, robots
- [x] Open-Meteo refresh worker (Node) — daily cron
- [x] Copernicus fetcher (Python) — scaffold pro Phase 2
- [x] CI pipeline: lint + type-check + **35/35 testů** + build + python + audit
- [x] Daily cron workflow
- [x] Post-deploy smoke test workflow
- [x] Vercel config s security headers
- [x] Push na `ladronix/weelake`

---

## 🔧 Krok 1 · Supabase schéma (10 min)

Tvůj projekt: **https://gjfchiipsqhlsbjkkmdi.supabase.co**

1. Otevři https://supabase.com/dashboard/project/gjfchiipsqhlsbjkkmdi
2. **Database → Extensions** — zapni:
   - `postgis`
   - `pg_trgm`
   - `uuid-ossp`
3. **SQL Editor → New query** → vlož a spusť postupně tyto soubory z repa:
   - `supabase/migrations/20260719000000_initial_schema.sql`
   - `supabase/seed/01_countries.sql`
   - `supabase/seed/02_lakes_mvp.sql`
4. Ověř:
   ```sql
   select count(*) as lakes, count(distinct country_code) as countries from public.lakes;
   ```
   Očekávaný výsledek: **65 lakes · 25 countries**.
5. **Settings → API** — zkopíruj tři hodnoty:
   - `Project URL` = `https://gjfchiipsqhlsbjkkmdi.supabase.co`
   - `anon public` = …
   - `service_role secret` = … (nikdy nepublikuj)

---

## 🔧 Krok 2 · Lokální dev (2 min)

```bash
cd /Users/I314819/SAPDevelop/orch/projects/weelake
cp .env.example .env.local
```

V `.env.local` vyplň:
```
NEXT_PUBLIC_SUPABASE_URL=https://gjfchiipsqhlsbjkkmdi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Spusť:
```bash
pnpm --filter web dev
```

Otevři http://localhost:3000

**Natáhni první teploty:**
```bash
export NEXT_PUBLIC_SUPABASE_URL="https://gjfchiipsqhlsbjkkmdi.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJ..."
pnpm --filter openmeteo-refresh start
```

Reloadni landing — teploty a hot/cold listy naskočí.

---

## 🔧 Krok 3 · GitHub Secrets pro CI/CD (2 min)

Jdi na https://github.com/ladronix/weelake/settings/secrets/actions

Přidej dva secrets:
- `SUPABASE_URL` = `https://gjfchiipsqhlsbjkkmdi.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = service role key ze Supabase

Otestuj daily cron ručně:
1. https://github.com/ladronix/weelake/actions/workflows/daily-fetch.yml
2. **Run workflow → Run workflow**
3. Za ~2 min proteče. V Supabase v tabulce `lakes_current` uvidíš teploty.

---

## 🔧 Krok 4 · Vercel (5 min)

1. https://vercel.com → **Add New → Project → Import Git Repository**
2. Vyber `ladronix/weelake` (musíš dát Vercel access k tomu GitHub účtu; s ladronix účtem je to čisté)
3. **Configure Project:**
   - Framework: **Next.js** (auto)
   - Root Directory: `.` (kořen — `vercel.json` říká Vercelu, kam sáhnout)
   - Build Command: (nech default z `vercel.json`)
   - Install Command: (nech default z `vercel.json`)
4. **Environment Variables** — přidej:
   ```
   NEXT_PUBLIC_SUPABASE_URL       = https://gjfchiipsqhlsbjkkmdi.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY  = eyJ...
   SUPABASE_SERVICE_ROLE_KEY      = eyJ...
   NEXT_PUBLIC_SITE_URL           = https://weelake.vercel.app
   NEXT_PUBLIC_SITE_NAME          = V-Lake
   ```
5. **Deploy** — za ~2 min máš `https://weelake-<hash>.vercel.app` živé.

---

## 🔧 Krok 5 · Doména (10 min — kdy chceš)

Nejlevněji přes Cloudflare Registrar (~$10/rok, at-cost):

1. https://dash.cloudflare.com → **Registrar → Register Domain** → `weelake.com`
2. Po registraci DNS už bude na Cloudflare. Přidej:
   ```
   Type    Name    Content                    Proxy
   CNAME   @       cname.vercel-dns.com       DNS only
   CNAME   www     cname.vercel-dns.com       DNS only
   ```
3. Vercel → **Settings → Domains → Add** → `weelake.com` (Vercel automaticky vydá SSL).
4. V env vars Vercelu změň `NEXT_PUBLIC_SITE_URL=https://weelake.com`.
5. Redeploy.

---

## 🔧 Krok 6 · Copernicus (počkat 1-2 dny)

Zaregistruj se, ať schvalování běží:
1. https://cds.climate.copernicus.eu/user/register
2. https://data.marine.copernicus.eu/register

Za pár dní přijde schválení → API key → nasadíme Python worker na Railway (Phase 2).

---

## 📊 Co běží v CI/CD

**Push na `main` nebo PR:**
1. **Quality** — lint, TypeScript, 35 unit testů
2. **Build** — Next.js production build (všech 9 route)
3. **Python** — py_compile na Copernicus scriptu
4. **Audit** — pnpm audit --prod --audit-level high

**Denně 03:00 UTC:**
- Daily temperature refresh — Node worker natáhne teploty pro všech 65 jezer.

**Po každém úspěšném CI na main:**
- Smoke test — probe `/`, `/map`, `/api/stats`, `/api/search?q=lipno`, `robots.txt`, `sitemap.xml`.

---

## ✅ Kontrolní checklist

- [ ] Supabase migrace + seed spuštěny → 65 lakes
- [ ] `.env.local` vyplněný, `pnpm --filter web dev` funguje
- [ ] `pnpm --filter openmeteo-refresh start` naplnil `lakes_current`
- [ ] GitHub Secrets nastaveny
- [ ] Daily cron ručně spuštěn a úspěšný
- [ ] Vercel projekt vytvořený, env vars nastaveny, deployed
- [ ] Otevřel jsi `https://weelake-XXX.vercel.app` a vidíš teploty
- [ ] (Volitelné) Doména `weelake.com` napojena

Máš-li všech 8 zaškrtnuto, jsi **live** a připraven na launch.

Launch playbook je v `docs/PROMO.md`.
