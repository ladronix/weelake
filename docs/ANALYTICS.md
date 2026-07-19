# Analytics — decision & integration

## Options considered

| Provider | Free tier | Cookie-less | Self-hostable | GDPR ready | Setup |
|---|---|---|---|---|---|
| **Umami Cloud** | 100k events/mo | ✅ | ✅ | ✅ | 1 line script |
| **Plausible Cloud** | ❌ ($9/mo) | ✅ | ✅ | ✅ | 1 line script |
| **PostHog** | 1M events/mo | ⚠ (cookies opt-in) | ✅ | ✅ | 1 line + init |
| **Vercel Analytics** | 2.5k events/mo | ✅ | ❌ | ✅ | Native |
| **Google Analytics 4** | Unlimited | ❌ (cookies) | ❌ | ⚠ | Needs consent banner |

## Chosen: **Umami Cloud** (with graceful fallback to Vercel Analytics)

### Why
- **Free 100k events/mo** — covers early launch traffic.
- **No cookies, no consent banner needed** — perfect for a public content site.
- **Open source** — we can self-host on Railway/Fly.io if we outgrow the free tier.
- **1-line script tag** — no bundle bloat.
- **Custom event API** — we can track filter usage, map interactions, share clicks.

### What we track (all anonymous)
- Page views (path only, no query strings with PII)
- Custom events:
  - `map.filter` — { country, type, temp_range }
  - `map.basemap` — { basemap }
  - `map.locate` — user pressed "Find my location"
  - `search.query` — { length } (no actual query text)
  - `lake.view` — { slug }
  - `lake.navigate` — user tapped Navigate
  - `lake.share` — user tapped Share
  - `landing.nearby` — user tapped Find Nearby

### Setup steps
1. Register at https://umami.is (free)
2. Create a website entry for `weelake.com`
3. Copy the website ID (UUID)
4. Set `NEXT_PUBLIC_UMAMI_WEBSITE_ID` in Vercel and `.env.local`
5. Deploy — script loads only in production.

### Fallback
If `NEXT_PUBLIC_UMAMI_WEBSITE_ID` is empty, we use Vercel Analytics (works
automatically on Vercel, 2.5k events/mo free — fine for canary launch).
