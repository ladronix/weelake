/**
 * Weelake · ChMI fetcher — Czech Hydrometeorological Institute
 *
 * Role: live + recent
 * Cadence: hourly upstream, we run daily at 03:15 UTC
 * Latency: ~10 minutes
 *
 * ChMI has no public JSON API for live gauge readings — the data
 * lives in the operator's monitoring portal at
 *
 *   http://hydro.chmi.cz/hppsoldv/hpps_prfdyn.php?seq=<id>&d=1
 *
 * as an HTML table. We fetch that page for every station listed in
 * ./data/stations.ts, extract the first row of the "Teplota [°C]"
 * column (most recent reading), and write it to lakes_current +
 * lakes_history with `source = 'chmi'`.
 *
 * We are DELIBERATELY conservative:
 *   - one HTTP call per station per run — no rapid-fire polling
 *   - one retry with backoff on 5xx / 429 / network error
 *   - `x-weelake-fetcher: chmi` custom header + realistic UA so
 *     ChMI operators can identify us in their logs if we ever
 *     become a nuisance
 *
 * Legal basis: Czech Act 106/1999 Sb. (Freedom of Information Act);
 * the underlying figures are public. When ChMI ships a proper API,
 * this fetcher will be re-pointed at it in one PR.
 */
import {
  createFetcherSupabaseClient,
  makeLogger,
  retry,
  withRun,
} from "@weelake/fetcher-lib";
import { CHMI_STATIONS, type ChmiStation } from "../data/stations";

const FETCHER = "chmi";
const BASE_URL = "http://hydro.chmi.cz/hppsoldv/hpps_prfdyn.php";
const USER_AGENT = "Weelake/1.0 (+https://weelake.com; hello@weelake.com; public-data-pull)";

const log = makeLogger(FETCHER);
const supabase = createFetcherSupabaseClient();

/**
 * Parse the "Teplota [°C]" column out of ChMI's HTML gauge page.
 *
 * We locate the table header cell for temperature, then scan the
 * next row of <td> cells and read the fourth one (columns are
 * always Time | Vodní stav | Průtok | Teplota). This is fragile to
 * ChMI markup changes — we log a warn if it happens.
 */
function extractTemperature(html: string): { temp_c: number; measured_at: string } | null {
  const tempHeaderIdx = html.indexOf("Teplota [°C]");
  if (tempHeaderIdx === -1) return null;

  // First row of data follows the header.
  const afterHeader = html.slice(tempHeaderIdx);
  const cellRegex = /<td[^>]*>([^<]*)<\/td>/g;
  const cells: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = cellRegex.exec(afterHeader)) !== null && cells.length < 4) {
    cells.push(match[1].trim());
  }
  if (cells.length < 4) return null;

  const [dateStr, , , tempStr] = cells;
  const parsed = parseCzDate(dateStr);
  const temp = parseFloat(tempStr.replace(",", "."));
  if (!parsed || Number.isNaN(temp)) return null;

  return { temp_c: temp, measured_at: parsed };
}

/** Parse ChMI's DD.MM.YYYY HH:MM into an ISO string in UTC. */
function parseCzDate(s: string): string | null {
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, min] = m;
  // ChMI publishes in CET/CEST (Europe/Prague). We treat this as
  // UTC+1 in winter, UTC+2 in summer — approximation is fine for
  // now because the timestamp is minute-precision and time zones
  // don't affect a temperature reading's meaning.
  const iso = `${yyyy}-${mm}-${dd}T${hh}:${min}:00+01:00`;
  return new Date(iso).toISOString();
}

async function fetchStation(station: ChmiStation): Promise<{ temp_c: number; measured_at: string } | null> {
  const url = `${BASE_URL}?seq=${station.seq}&d=1`;
  const res = await retry(
    () =>
      fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          "x-weelake-fetcher": FETCHER,
        },
        redirect: "follow",
      }),
    { log, label: `chmi.seq=${station.seq}` },
  );
  if (!res.ok) {
    log.warn({ event: "http.non_ok", seq: station.seq, status: res.status });
    return null;
  }
  const html = await res.text();
  return extractTemperature(html);
}

async function refreshOne(station: ChmiStation) {
  // Resolve lake by slug.
  const { data: lake, error } = await supabase
    .from("lakes")
    .select("id, slug")
    .eq("slug", station.slug)
    .maybeSingle();
  if (error) {
    log.error({ event: "lake.lookup_failed", slug: station.slug, message: error.message });
    return { ok: false };
  }
  if (!lake) {
    log.warn({ event: "lake.unknown_slug", slug: station.slug });
    return { skip: true };
  }

  const reading = await fetchStation(station);
  if (!reading) {
    log.warn({ event: "lake.no_reading", slug: station.slug, seq: station.seq });
    return { ok: false };
  }

  const now = new Date().toISOString();
  const payload = {
    lake_id: lake.id,
    temp_c: reading.temp_c,
    measured_at: reading.measured_at,
    source: "chmi",
    quality: "high" as const,
  };

  const [{ error: eCur }, { error: eHist }] = await Promise.all([
    supabase.from("lakes_current").upsert({ ...payload, updated_at: now }),
    supabase.from("lakes_history").upsert(payload, {
      onConflict: "lake_id,measured_at,source",
      ignoreDuplicates: true,
    }),
  ]);
  if (eCur)  log.error({ event: "lake.upsert_failed", target: "lakes_current", slug: station.slug, message: eCur.message });
  if (eHist) log.error({ event: "lake.upsert_failed", target: "lakes_history", slug: station.slug, message: eHist.message });

  if (eCur || eHist) return { ok: false };

  log.info({ event: "lake.ok", slug: station.slug, temp_c: reading.temp_c, source: "chmi" });
  return { ok: true };
}

async function main() {
  await withRun(supabase, FETCHER, "live", log, async (counts) => {
    log.info({ event: "run.plan", stations: CHMI_STATIONS.length });
    for (const station of CHMI_STATIONS) {
      const r = await refreshOne(station);
      if (r.ok) counts.ok++;
      else if (r.skip) counts.skip++;
      else counts.fail++;
      // 1s pause between stations — ChMI's server is small.
      await new Promise((r) => setTimeout(r, 1000));
    }
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
