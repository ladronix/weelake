/**
 * Weelake · Wikimedia Commons photo fetcher (backfill worker)
 *
 * For every lake with `wiki_url` set (or by name lookup), fetch the page's
 * primary image via the MediaWiki API and store its URL in `lakes.photo_url`.
 *
 * Free · no key required · CC-BY-SA licences (we credit in the footer).
 *
 * Run:
 *   pnpm --filter openmeteo-refresh exec tsx src/photos-backfill.ts
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
}

/** Extract the article title from a Wikipedia URL. */
function articleTitleFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    // e.g. https://en.wikipedia.org/wiki/Lipno_Reservoir → "Lipno_Reservoir"
    const parts = u.pathname.split("/wiki/");
    if (parts.length !== 2) return null;
    return decodeURIComponent(parts[1]);
  } catch {
    return null;
  }
}

/**
 * Query the Wikipedia REST API for the "originalimage" of a page.
 * The English wiki has the best photo coverage for most world lakes.
 */
async function fetchWikipediaImage(title: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "V-Lake/1.0 (https://weelake.com; contact@weelake.com)" },
    });
    if (!r.ok) return null;
    const j = await r.json() as { originalimage?: { source?: string }; thumbnail?: { source?: string } };
    return j.originalimage?.source ?? j.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

/**
 * Fallback: search Wikimedia Commons for images tagged with the lake name.
 */
async function fetchCommonsImage(query: string): Promise<string | null> {
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*` +
    `&generator=search&gsrsearch=${encodeURIComponent(query + " lake")}` +
    `&gsrlimit=1&gsrnamespace=6&prop=imageinfo&iiprop=url&iiurlwidth=800`;
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "V-Lake/1.0" },
    });
    if (!r.ok) return null;
    const j = await r.json() as any;
    const pages = j.query?.pages ?? {};
    for (const pid of Object.keys(pages)) {
      const info = pages[pid].imageinfo?.[0];
      if (info?.thumburl) return info.thumburl as string;
      if (info?.url) return info.url as string;
    }
    return null;
  } catch {
    return null;
  }
}

async function findPhoto(lake: Lake): Promise<string | null> {
  // 1. If wiki_url points at an article, extract title.
  if (lake.wiki_url) {
    const title = articleTitleFromUrl(lake.wiki_url);
    if (title) {
      const url = await fetchWikipediaImage(title);
      if (url) return url;
    }
  }
  // 2. Try the English name directly.
  {
    const url = await fetchWikipediaImage(lake.name.replace(/ /g, "_"));
    if (url) return url;
  }
  // 3. Try Commons search.
  const url = await fetchCommonsImage(lake.name);
  return url;
}

async function main() {
  const { data, error } = await supabase
    .from("lakes")
    .select("id, slug, name, name_local, country_code, wiki_url, photo_url");
  if (error) { console.error(error); process.exit(1); }
  const rows = (data ?? []) as Lake[];
  console.log(`Backfilling photos for ${rows.length} lakes…`);

  let ok = 0, skipped = 0, fail = 0;
  const CONC = 4;
  for (let i = 0; i < rows.length; i += CONC) {
    const chunk = rows.slice(i, i + CONC);
    const results = await Promise.all(chunk.map(async (l) => {
      if (l.photo_url) return { l, url: l.photo_url, skipped: true };
      const url = await findPhoto(l);
      if (url) {
        const { error: e } = await supabase.from("lakes").update({ photo_url: url }).eq("id", l.id);
        if (e) return { l, url: null, err: e.message };
      }
      return { l, url };
    }));
    results.forEach((r) => {
      if (r.skipped) { skipped++; console.log(`  ⏭ ${r.l.slug.padEnd(24)} already has photo`); }
      else if (r.url) { ok++; console.log(`  ✓ ${r.l.slug.padEnd(24)} ${r.url.slice(0, 80)}`); }
      else { fail++; console.log(`  ✗ ${r.l.slug.padEnd(24)} no image found`); }
    });
    await new Promise((r) => setTimeout(r, 400));
  }
  console.log(`Done. ok=${ok} skipped=${skipped} fail=${fail} total=${rows.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
