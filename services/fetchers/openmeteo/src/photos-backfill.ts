/**
 * Weelake · Wikimedia photo backfill (v2)
 *
 * For every lake without a `photo_url`, try progressively looser
 * lookups to find a good hero image:
 *
 *   1. If `wiki_url` is set → fetch that Wikipedia page's summary
 *      image (originalimage → thumbnail).
 *   2. Try the English Wikipedia page whose title matches the
 *      lake's `name`.
 *   3. If the lake has a `name_local` (typically the native
 *      Czech / German / French / etc. form) → try the Wikipedia
 *      in that language.
 *   4. Try Wikimedia Commons full-text search with the English name
 *      appended with 'lake'/'reservoir' hint.
 *   5. Try Commons search with just the local name.
 *   6. As a last resort, try Commons search with the country code
 *      appended (helps disambiguate common lake names).
 *
 * Every step is a single HTTP hit; six attempts × 65 unlinked
 * lakes × 400ms breather = ~2.6 min worst case. Politeness
 * (User-Agent + inter-request delay) keeps Wikimedia's rate
 * limiter happy.
 *
 * Idempotent: if a lake gets a photo_url mid-run and the script is
 * re-run, that lake is skipped.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface Lake {
  id: string;
  slug: string;
  name: string;
  name_local: string | null;
  country_code: string;
  wiki_url: string | null;
  photo_url: string | null;
  type: string;
}

/** Extract the article title from a Wikipedia URL. */
function articleTitleFromUrl(url: string): { lang: string; title: string } | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/wiki/");
    if (parts.length !== 2) return null;
    const lang = u.hostname.match(/^([a-z]{2,3})\.wikipedia\.org$/)?.[1] ?? "en";
    return { lang, title: decodeURIComponent(parts[1]) };
  } catch {
    return null;
  }
}

/** ISO-2 country code → preferred Wikipedia language. Not exhaustive but
 *  covers our current lake set well. */
function countryToWikiLang(cc: string): string {
  const map: Record<string, string> = {
    CZ: "cs", DE: "de", AT: "de", CH: "de", SK: "sk", PL: "pl",
    HU: "hu", IT: "it", FR: "fr", ES: "es", PT: "pt", NL: "nl",
    BE: "nl", SE: "sv", NO: "no", DK: "da", FI: "fi", IS: "is",
    IE: "en", GB: "en", GR: "el", TR: "tr", RU: "ru", UA: "uk",
    BY: "be", LT: "lt", LV: "lv", EE: "et", RO: "ro", BG: "bg",
    HR: "hr", RS: "sr", SI: "sl", ME: "sr", MK: "mk", AL: "sq",
    JP: "ja", CN: "zh", KP: "ko", KR: "ko", TH: "th", ID: "id",
    PH: "en", IR: "fa", IL: "he",
  };
  return map[cc] ?? "en";
}

/** Wikipedia REST summary endpoint — best structured way to get an image. */
async function wikipediaSummary(lang: string, title: string): Promise<string | null> {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Weelake/1.0 (+https://weelake.com; hello@weelake.com)" },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { originalimage?: { source?: string }; thumbnail?: { source?: string } };
    // Prefer originalimage (bigger, cropped by Wikipedia infobox convention)
    // but sanity-check the URL because Wikipedia sometimes returns raw
    // file paths whose extension isn't an image.
    const raw = j.originalimage?.source ?? j.thumbnail?.source ?? null;
    if (!raw) return null;
    if (!/\.(jpe?g|png|webp|svg)(\?|$)/i.test(raw)) return null;
    return raw;
  } catch {
    return null;
  }
}

/** Wikimedia Commons full-text search restricted to file namespace. */
async function commonsSearch(query: string): Promise<string | null> {
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*` +
    `&generator=search&gsrsearch=${encodeURIComponent(query)}` +
    `&gsrlimit=1&gsrnamespace=6&prop=imageinfo&iiprop=url&iiurlwidth=800`;
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Weelake/1.0 (+https://weelake.com; hello@weelake.com)" },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as {
      query?: { pages?: Record<string, { imageinfo?: Array<{ thumburl?: string; url?: string }> }> };
    };
    const pages = j.query?.pages ?? {};
    for (const pid of Object.keys(pages)) {
      const info = pages[pid].imageinfo?.[0];
      if (info?.thumburl) return info.thumburl;
      if (info?.url) return info.url;
    }
    return null;
  } catch {
    return null;
  }
}

async function findPhoto(lake: Lake): Promise<{ url: string; via: string } | null> {
  // 1. Existing wiki_url — parse language + title.
  if (lake.wiki_url) {
    const parsed = articleTitleFromUrl(lake.wiki_url);
    if (parsed) {
      const url = await wikipediaSummary(parsed.lang, parsed.title);
      if (url) return { url, via: `wiki_url:${parsed.lang}` };
    }
  }
  // 2. English Wikipedia page matching the English name.
  {
    const url = await wikipediaSummary("en", lake.name.replace(/ /g, "_"));
    if (url) return { url, via: "wiki_en" };
  }
  // 3. Local Wikipedia language if we know it (Czech, German, ...).
  const localLang = countryToWikiLang(lake.country_code);
  if (localLang !== "en") {
    const query = (lake.name_local ?? lake.name).replace(/ /g, "_");
    const url = await wikipediaSummary(localLang, query);
    if (url) return { url, via: `wiki_${localLang}` };
  }
  // 4. Commons full-text with type hint.
  {
    const typeHint = lake.type === "reservoir" ? "reservoir" : lake.type === "pond" ? "pond" : "lake";
    const url = await commonsSearch(`${lake.name} ${typeHint}`);
    if (url) return { url, via: "commons_en" };
  }
  // 5. Commons on the local name.
  if (lake.name_local && lake.name_local !== lake.name) {
    const url = await commonsSearch(lake.name_local);
    if (url) return { url, via: "commons_local" };
  }
  // 6. Commons with country code.
  {
    const url = await commonsSearch(`${lake.name} ${lake.country_code}`);
    if (url) return { url, via: "commons_country" };
  }
  return null;
}

async function main() {
  const { data, error } = await supabase
    .from("lakes")
    .select("id, slug, name, name_local, country_code, wiki_url, photo_url, type");
  if (error) { console.error(error); process.exit(1); }
  const rows = (data ?? []) as Lake[];
  const missing = rows.filter((l) => !l.photo_url);
  console.log(`Photos: ${rows.length - missing.length}/${rows.length} have photos, ${missing.length} to backfill.`);

  let ok = 0, fail = 0;
  const CONC = 3; // gentler than the old script — 3 in-flight
  for (let i = 0; i < missing.length; i += CONC) {
    const chunk = missing.slice(i, i + CONC);
    const results = await Promise.all(chunk.map(async (l) => {
      const found = await findPhoto(l);
      if (found) {
        const { error: e } = await supabase.from("lakes").update({ photo_url: found.url }).eq("id", l.id);
        if (e) return { l, err: e.message };
        return { l, found };
      }
      return { l };
    }));
    for (const r of results) {
      if (r.found) {
        ok++;
        console.log(`  OK ${r.l.slug.padEnd(24)} [${r.found.via.padEnd(14)}] ${r.found.url.slice(0, 80)}`);
      } else {
        fail++;
        console.log(`  X  ${r.l.slug.padEnd(24)} no image found`);
      }
    }
    // Rate-limit breather so Wikimedia doesn't 429 us on the burst.
    await new Promise((r) => setTimeout(r, 800));
  }
  console.log(`Done. ok=${ok} fail=${fail} total_missing=${missing.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
