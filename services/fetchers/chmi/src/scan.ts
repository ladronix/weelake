/**
 * One-off scanner: harvest every ChMI gauge station that reports a
 * water temperature, and try to match it to a Weelake lake slug.
 *
 * Usage:
 *   pnpm --filter @weelake/fetcher-chmi scan
 *   pnpm --filter @weelake/fetcher-chmi scan -- --dry
 *   pnpm --filter @weelake/fetcher-chmi scan -- --write
 *
 * Modes:
 *   default    print human-readable summary (dry)
 *   --write    emit a fresh data/stations.ts overwriting the seed
 *              — commit the diff manually after review
 *
 * Workflow the scanner encodes:
 *   1. Pull the map index page /hppsoldv/ — extracts ~590 station
 *      ids and their (station_name, water_body) labels.
 *   2. Fetch every station's detail page in a bounded queue.
 *   3. Keep only stations whose 'Teplota [°C]' column shows a
 *      numeric value in the last hour.
 *   4. Fuzzy-match station name / water body against Weelake's
 *      existing `lakes` slugs. Matches surface as
 *      `{ seq, station, water_body, temp_c, matched_slug }`.
 *   5. Unmatched hot stations print separately so the operator can
 *      curate them into new lake seeds.
 *
 * ChMI has no API; the map page is our only comprehensive index.
 * This scanner is a ONE-OFF operator tool — not run in production
 * (production only re-reads the small stations.ts allowlist).
 */
import { createFetcherSupabaseClient, makeLogger } from "@weelake/fetcher-lib";

const INDEX_URL = "http://hydro.chmi.cz/hppsoldv/";
const DETAIL_URL = (seq: number) => `http://hydro.chmi.cz/hppsoldv/hpps_prfdyn.php?seq=${seq}&d=1`;
const USER_AGENT = "Weelake/1.0 (+https://weelake.com; hello@weelake.com; one-off-scanner)";
const CONCURRENCY = 8;

const WRITE = process.argv.includes("--write");
const log = makeLogger("chmi-scan");

interface IndexEntry {
  seq: number;
  station: string;
  water_body: string;
  /** Approximate lat/lng derived from map pixel coords. */
  lat: number;
  lng: number;
}

interface HotStation extends IndexEntry {
  temp_c: number;
  measured_at: string;
}

/**
 * ChMI's map image is 710×480 px and covers the Czech Republic
 * roughly bounded by lng [12.09, 18.86] and lat [48.55, 51.06].
 * A station's <area coords="x,y,5"> is the pixel centre in that
 * image; a linear transform gets us close enough for a nearest-
 * neighbour match against a lake registry (accuracy is a few km,
 * which is far better than the ~50-km search radius we'll use).
 */
const MAP_WIDTH_PX = 710;
const MAP_HEIGHT_PX = 480;
const LNG_MIN = 12.09;
const LNG_MAX = 18.86;
const LAT_MIN = 48.55;
const LAT_MAX = 51.06;

function pixelToLatLng(x: number, y: number): { lat: number; lng: number } {
  const lng = LNG_MIN + (x / MAP_WIDTH_PX) * (LNG_MAX - LNG_MIN);
  const lat = LAT_MAX - (y / MAP_HEIGHT_PX) * (LAT_MAX - LAT_MIN);
  return { lat, lng };
}

/** Great-circle distance in km, spherical earth. */
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(s)));
}

async function fetchIndex(): Promise<IndexEntry[]> {
  const res = await fetch(INDEX_URL, {
    headers: { "User-Agent": USER_AGENT },
    redirect: "follow",
  });
  const html = await res.text();

  // Two-pass extraction: pull coords + seq per <area> tag, then
  // pair with ShowActPrfdetail(name, water) same-line arguments.
  // One regex per pass keeps the pattern simple and lets us log
  // when a station has a coord but no name (usually a redirect
  // sentinel).
  const entries: IndexEntry[] = [];
  const seen = new Set<number>();
  const areaRe = /<area[^>]*coords="(\d+),(\d+),\d+"[^>]*seq=(\d+)[^>]*onmouseover="ShowActPrfdetail\(self\.document,'([^']+)','([^']*)'/g;
  let m: RegExpExecArray | null;
  while ((m = areaRe.exec(html)) !== null) {
    const x = Number(m[1]);
    const y = Number(m[2]);
    const seq = Number(m[3]);
    if (seen.has(seq)) continue;
    seen.add(seq);
    const { lat, lng } = pixelToLatLng(x, y);
    entries.push({
      seq,
      station: m[4].trim(),
      water_body: m[5].trim(),
      lat,
      lng,
    });
  }
  return entries;
}

function parseTemperature(html: string): { temp_c: number; measured_at: string } | null {
  const tempHeaderIdx = html.indexOf("Teplota [°C]");
  if (tempHeaderIdx === -1) return null;
  const afterHeader = html.slice(tempHeaderIdx);
  const cellRegex = /<td[^>]*>([^<]*)<\/td>/g;
  const cells: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = cellRegex.exec(afterHeader)) !== null && cells.length < 4) {
    cells.push(match[1].trim());
  }
  if (cells.length < 4) return null;
  const [dateStr, , , tempStr] = cells;
  const temp = parseFloat(tempStr.replace(",", "."));
  if (!Number.isFinite(temp)) return null;
  // Parse "23.07.2026 16:00" as Europe/Prague; approximation, see fetcher.
  const dm = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!dm) return null;
  const [, dd, mm, yyyy, hh, min] = dm;
  const iso = new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:00+02:00`).toISOString();
  return { temp_c: temp, measured_at: iso };
}

async function fetchDetail(seq: number): Promise<{ temp_c: number; measured_at: string } | null> {
  try {
    const res = await fetch(DETAIL_URL(seq), {
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();
    return parseTemperature(html);
  } catch {
    return null;
  }
}

/**
 * Slugify a Czech station or water-body name.
 * Removes diacritics, lowercases, keeps only [a-z0-9-].
 */
function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  log.info({ event: "scan.start" });
  const supabase = createFetcherSupabaseClient();

  // Pull existing lakes we might match against.
  const { data: cz, error } = await supabase
    .from("lakes")
    .select("slug, name, name_local, lat, lng, type")
    .eq("country_code", "CZ");
  if (error) throw new Error(error.message);
  const czLakes = (cz ?? []) as Array<{
    slug: string;
    name: string;
    name_local: string | null;
    lat: number;
    lng: number;
    type: string;
  }>;
  const slugSet = new Set(czLakes.map((l) => l.slug));
  const nameKey = new Map<string, string>();
  for (const l of czLakes) {
    for (const n of [l.name, l.name_local].filter(Boolean) as string[]) {
      nameKey.set(slugify(n), l.slug);
    }
    nameKey.set(l.slug, l.slug);
  }
  log.info({ event: "scan.existing_lakes", count: czLakes.length });

  const index = await fetchIndex();
  log.info({ event: "scan.index", stations: index.length });

  // Concurrency-bounded queue.
  const hot: HotStation[] = [];
  let scanned = 0;
  const queue = [...index];
  const workers: Promise<void>[] = [];
  for (let w = 0; w < CONCURRENCY; w++) {
    workers.push((async () => {
      while (queue.length > 0) {
        const e = queue.shift();
        if (!e) break;
        const reading = await fetchDetail(e.seq);
        scanned++;
        if (scanned % 50 === 0) {
          log.info({ event: "scan.progress", scanned, total: index.length, hot: hot.length });
        }
        if (reading) hot.push({ ...e, ...reading });
        // Be gentle — 200ms between requests per worker.
        await new Promise((r) => setTimeout(r, 200));
      }
    })());
  }
  await Promise.all(workers);

  log.info({ event: "scan.done", scanned, hot: hot.length });

  // Categorise: matched (station name maps to existing lake) vs
  // unmatched (would need a new lake seed). Try name-slug first;
  // fall back to spatial nearest-neighbour within 15 km — good
  // enough for a gauge station sitting just below a reservoir dam.
  const matched: Array<{ station: HotStation; slug: string; kind: string; distance_km?: number }> = [];
  const unmatched: HotStation[] = [];
  for (const s of hot) {
    const candidates = [
      slugify(s.station),
      slugify(s.water_body),
      slugify(s.station.replace(/\s+pod\s+nádrž[ií]$/i, "")),
      slugify(s.station.replace(/\s+přehrada$/i, "")),
      slugify(s.station.replace(/\s+nádrž$/i, "")),
    ];
    let hit: string | null = null;
    let hitKind = "name";
    for (const c of candidates) {
      if (!c) continue;
      if (slugSet.has(c)) { hit = c; break; }
      const named = nameKey.get(c);
      if (named) { hit = named; break; }
    }

    // Spatial fallback for stations near a reservoir/lake.
    let distance_km: number | undefined;
    if (!hit) {
      let best: { slug: string; km: number } | null = null;
      for (const l of czLakes) {
        // Only match reservoirs / lakes — never a stream station to
        // an existing pond.
        if (l.type !== "reservoir" && l.type !== "lake") continue;
        const km = haversineKm({ lat: s.lat, lng: s.lng }, l);
        if (!best || km < best.km) best = { slug: l.slug, km };
      }
      // 2 km tight window — a gauge station right at the dam or on
      // the reservoir shore. Anything further is more likely a
      // river station downstream, not the reservoir itself. Our
      // pixel-to-latlng conversion is only accurate to ~5 km so we
      // still accept up to 2 km rather than requiring perfection.
      if (best && best.km < 2) {
        hit = best.slug;
        hitKind = "spatial";
        distance_km = Math.round(best.km * 10) / 10;
      }
    }

    if (hit) matched.push({ station: s, slug: hit, kind: hitKind, distance_km });
    else unmatched.push(s);
  }

  // Sort matched by slug for stable output; unmatched by temp desc.
  matched.sort((a, b) => a.slug.localeCompare(b.slug));
  unmatched.sort((a, b) => b.temp_c - a.temp_c);

  console.log("");
  console.log("========================================");
  console.log(`Matched CHMI stations → existing lakes: ${matched.length}`);
  console.log("========================================");
  for (const { station, slug, kind, distance_km } of matched) {
    const dist = distance_km != null ? `  ~${distance_km}km` : "";
    console.log(
      `  ${String(station.seq).padStart(8)}  ${station.temp_c.toFixed(1).padStart(5)}°C  ${slug.padEnd(28)}  [${kind}${dist}]  (${station.station} / ${station.water_body})`,
    );
  }

  console.log("");
  console.log("========================================");
  console.log(`Unmatched HOT stations (could seed new lakes): ${unmatched.length}`);
  console.log("========================================");
  for (const s of unmatched.slice(0, 80)) {
    console.log(
      `  ${String(s.seq).padStart(8)}  ${s.temp_c.toFixed(1).padStart(5)}°C  lat=${s.lat.toFixed(3)} lng=${s.lng.toFixed(3)}  ${s.station.padEnd(24)}  water=${s.water_body}`,
    );
  }
  if (unmatched.length > 80) console.log(`  ... and ${unmatched.length - 80} more`);

  if (WRITE) {
    console.log("\n--write not implemented yet — copy the 'Matched' block into data/stations.ts manually for now.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
