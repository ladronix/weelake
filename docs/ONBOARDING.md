# Weelake · Onboarding — tvoje 30 minut

Přesné pořadí, co udělat teď hned. Zabere ti ~30 minut a bude to fungovat.

---

## Krok 1 · GitHub (5 min)

1. Přihlas se na https://github.com
2. Vytvoř nový **prázdný** repo `weelake` (private nebo public — doporučeno public pro SEO / kredibilitu).
3. V lokálním adresáři:
   ```bash
   cd /Users/I314819/SAPDevelop/orch/projects/weelake
   git init
   git add .
   git commit -m "chore: initial scaffold"
   git branch -M main
   git remote add origin git@github.com:<username>/weelake.git
   git push -u origin main
   ```

---

## Krok 2 · Supabase (10 min) — KRITICKÉ

1. Zaregistruj se na https://supabase.com/dashboard (login přes GitHub)
2. **New project**
   - Name: `weelake`
   - Database password: vygeneruj silné, ulož do password manageru
   - Region: **eu-central-1** (Frankfurt) — nejblíž ČR/Rakousku/Německu
   - Pricing plan: **Free**
3. Počkej ~2 min, než se projekt nastartuje.
4. **Database → Extensions** — zapni:
   - `postgis`
   - `pg_trgm`
   - `uuid-ossp`
5. **Settings → API** → zkopíruj tři hodnoty:
   - `Project URL` → poznamenej si
   - `anon public` → poznamenej si
   - `service_role secret` → poznamenej si (nikdy nepublikuj)
6. **SQL Editor → New query** → vlož obsah `supabase/migrations/20260719000000_initial_schema.sql` a spusť
7. Stejným způsobem spusť `supabase/seed/01_countries.sql`
8. A `supabase/seed/02_lakes_mvp.sql`
9. Ověř: `SQL Editor → New query`
   ```sql
   select count(*) as lakes, count(distinct country_code) as countries from public.lakes;
   ```
   Očekávaný výsledek: ~65 jezer, ~25 zemí.

---

## Krok 3 · Lokální dev (5 min)

```bash
cd /Users/I314819/SAPDevelop/orch/projects/weelake
cp .env.example .env.local
```

Otevři `.env.local` a vlož ty tři hodnoty ze Supabase:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Instaluj deps a spusť:
```bash
# Pokud ještě nemáš pnpm:
brew install pnpm      # nebo `npm install -g pnpm`

pnpm install
pnpm --filter web dev
```

Otevři http://localhost:3000 — uvidíš landing s ~65 jezery bez teplot.

**Natáhni první teploty:**
```bash
# Nastav env pro worker
export NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGci..."

pnpm --filter openmeteo-refresh start
```

Za ~30 sekund proteče všech ~65 jezer. Reloadni landing — už uvidíš teploty, hot/cold listy, statistiky.

---

## Krok 4 · Vercel (5 min)

1. Na https://vercel.com přihlas se GitHubem.
2. **Add New → Project → Import** → vyber repo `weelake`.
3. **Configure Project:**
   - Root directory: `apps/web`
   - Framework: Next.js (auto)
   - Build command: (default `next build`)
4. **Environment Variables** — přidej stejné tři jako v `.env.local` + jeden navíc:
   ```
   NEXT_PUBLIC_SUPABASE_URL       = ...
   NEXT_PUBLIC_SUPABASE_ANON_KEY  = ...
   SUPABASE_SERVICE_ROLE_KEY      = ...
   NEXT_PUBLIC_SITE_URL           = https://weelake.vercel.app  (dočasně)
   ```
5. **Deploy** — po ~2 min máš `https://weelake.vercel.app` živé.

---

## Krok 5 · GitHub Actions daily cron (5 min)

1. V GitHubu jdi na repo → **Settings → Secrets and variables → Actions → New repository secret**
2. Přidej dva secrets:
   - `SUPABASE_URL` = Project URL ze Supabase
   - `SUPABASE_SERVICE_ROLE_KEY` = service role key
3. Jdi na tab **Actions**, vyber workflow **Daily temperature refresh**, klikni **Run workflow**.
4. Za ~1-2 min běžně dokončí. Teploty v DB se aktualizovaly.

Od teď se spouští každý den v 03:00 UTC automaticky.

---

## Krok 6 · Doména (10 min, volitelné teď)

**Nejlevnější varianta:** Cloudflare Registrar

1. https://dash.cloudflare.com → **Registrar → Register Domain**
2. Vyhledej `weelake.com`. Cena ~$10/rok (nejlevnější na trhu, žádný markup).
3. Po registraci: **DNS → Records** → přidej:
   ```
   Type    Name    Content                    Proxy
   CNAME   @       cname.vercel-dns.com       DNS only
   CNAME   www     cname.vercel-dns.com       DNS only
   ```
4. Ve Vercel: **Settings → Domains → Add** → `weelake.com` a `www.weelake.com`. Vercel automaticky vydá SSL cert (~2 min).

---

## Krok 7 · Copernicus (počkat 1-2 dny)

Copernicus je až v Phase 2 (přidá satelitní přesnost pro malá jezera).
Zatím to počká — Open-Meteo Marine + heuristický fallback stačí na MVP.

Zaregistruj se přesto teď, ať se schvalování rozjelo:
1. https://cds.climate.copernicus.eu/user/register
2. https://data.marine.copernicus.eu/register

Za ~1-2 dny přijde schvalovací mail, dostaneš API klíč a pak nasadíme Python worker na Railway.

---

## Kontrolní checklist

- [ ] GitHub repo pushnutý
- [ ] Supabase projekt hotový, DB naseedovaná (65 jezer)
- [ ] `.env.local` vyplněný, dev funguje
- [ ] Openmeteo worker natáhl první teploty
- [ ] Vercel deploy funguje
- [ ] GitHub Actions cron zapnutý a proběhl
- [ ] Doména registrovaná a nasměrovaná (volitelné)

Máš-li všech 6 zaškrtnutých, jsi **hotový na launch**.

---

## Co následuje po launch dni

Přesně v `docs/PROMO.md` — Product Hunt, Hacker News, Reddit, Twitter posloupnost.

## Něco nefunguje?

Řešení v `docs/SETUP.md` sekci **Troubleshooting**.
Pokud narazíš na nový problém, dej mi vědět a hned to opravíme.
