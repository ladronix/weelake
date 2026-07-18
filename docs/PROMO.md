# Promotion playbook

## Positioning

**One sentence:** "Windy, but for water temperatures."

**Elevator pitch (30s):**
> V-Lake is the first free, global map of lake and freshwater temperatures.
> Powered by Copernicus satellites and Open-Meteo, it shows live water temps
> for thousands of lakes worldwide with a beautiful, mobile-first interface.
> No signup, no paywall — just a map. Ever wondered if it's warm enough to
> swim at Lipno today? V-Lake tells you in one tap.

**Longer pitch (for HN / PH):**
> I've built V-Lake — a free global map of lake water temperatures. It
> combines Copernicus satellite LSWT, Open-Meteo forecasts, and HydroLAKES
> to show real-time water temperatures for lakes across Europe with plans
> for global coverage. Every lake page gets 7-day history, weather forecast,
> and a swim-safety verdict. Built on Next.js + Supabase + MapLibre.
> Open data all the way down. All code lives on GitHub.

---

## Launch sequence (T-minus)

### T-7 days · pre-launch
- [ ] Screenshots (light + dark, mobile + desktop)
- [ ] 20-second demo video (loom or screen record)
- [ ] Draft tweets, HN post, PH tagline
- [ ] Set up Plausible analytics
- [ ] Warm up Twitter following: reply/retweet Windy, Copernicus, wild swimming
- [ ] Reach out to 3 friendly journalists (climate, tech, travel)
- [ ] Add "Ping me on launch" waitlist on the landing (optional)

### T-1 day
- [ ] Final Lighthouse pass (≥ 95 mobile)
- [ ] Verify daily cron ran successfully
- [ ] Test on iOS Safari + Android Chrome
- [ ] Schedule Product Hunt for 00:01 PT

### T-Day
- [ ] **Product Hunt** — polished listing, first comment ready
- [ ] **Hacker News** — Show HN post @ 08:00 EST
- [ ] **Twitter/X** — thread with 5 slides
- [ ] **LinkedIn** — personal post about the build journey
- [ ] **Reddit:**
   - r/wildswimming (largest fit)
   - r/dataisbeautiful (visualization angle)
   - r/paddleboarding (activity angle)
   - r/webdev (technical angle)
   - r/csharp/etc — nope, tech-agnostic subs only
   - Country-specific: r/czech, r/austria, r/germany
- [ ] Reach out to newsletters: TLDR, Sunday Best (Dave Peck), Recomendo

### T+1 to T+7
- [ ] Respond to every comment on HN / PH / Reddit within 30min
- [ ] Ship 1-2 highly requested features fast (visibility of iteration)
- [ ] Post a "Lessons from the launch" thread day 7

---

## Content pillars (evergreen)

### 1. Daily/weekly temperature bulletins
Automated Twitter/X bot posts:
- "Warmest lake in Europe today: 🔥 Balaton HU · 28.4°C"
- "Cold-swim challenge: brave the 4.2°C Achensee AT ❄"
- Weekly digest with a map screenshot

### 2. Programmatic SEO pages
Every lake × language × season = a page:
- `/lake/lipno` (year-round)
- `/lake/lipno/summer` (June-Aug avg)
- `/de/see/bodensee` (localized DE version)
- `/best-lakes-for-swimming/austria` (aggregated)

### 3. Embeddable widget
```html
<iframe src="https://weelake.com/embed/lipno" width="240" height="80"></iframe>
```
For camp sites, hotels, tourism offices — free backlinks + brand awareness.

### 4. Weekly YouTube shorts
Timelapse of heatmap over a week. Zero-effort content once template is built.

### 5. Reddit "What lake should I swim at?" bot (later)
Reply to threads in r/wildswimming with current temps and V-Lake link.
Must respect subreddit rules (no spam).

---

## Partnerships (post-launch)

| Partner type | Ask | Give |
|---|---|---|
| Kempy / camp sites (CZ, AT, DE) | Backlink from their site | Free embedded widget with their lake's temp |
| Turistický portál (Kudy z nudy, Visit Austria) | Sitemap referral | Custom regional pages |
| Paddleboard/SUP brands | Instagram feature | Co-branded gallery + swim guide |
| Weather bloggers | Interview / mention | Data attribution + backlink |
| Copernicus / ESA | Case-study feature | Publicity value (attracts audiences) |

---

## Metrics to track

Week 1:
- Uniques (target 5k)
- HN upvotes (target 300+)
- PH position (top 5)
- Twitter/X impressions (target 50k)

Week 4:
- Weekly returning users
- Search impressions in GSC
- Number of countries with traffic

Month 3:
- Organic search share of traffic (target 50%)
- Programmatic lake pages indexed (target > 500)
- Referring domains (target 30+)

---

## Tone of voice

- Warm, curious, matter-of-fact.
- Facts first — never overpromise ("real-time" is fine only when data source updates ≥ daily).
- No emoji flood. One or two, deliberate.
- Praise the underlying data providers by name (Copernicus, Open-Meteo).
- Never mock competitors. Say "complements Windy, focused on water".

---

## Reserved copy snippets

### Product Hunt tagline
> **V-Lake · Global lake temperatures, live.**
> Windy for water. A free map of every lake on Earth with real-time temperatures, 7-day history, and swim-safety verdicts. Powered by Copernicus.

### HN title
> Show HN: V-Lake – A free global map of live lake water temperatures

### Twitter thread starter
> After 6 weekends, V-Lake is live 🌊
>
> A free, open, global map of lake water temperatures.
> Powered by Copernicus + Open-Meteo. No signup. No ads.
>
> Type a lake, see today's water temp, 7-day history, weather, and a swim verdict. Here's how I built it 🧵

### App Store / Play (future)
> V-Lake — Global lake temperatures. Find the perfect swim near you. Live water temps for every major lake in Europe (and the world). Free forever.
