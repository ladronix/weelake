/**
 * V-Lake · seed additional lakes
 * ------------------------------
 * Reads a curated JSON list of lakes and INSERT-IGNOREs them into the
 * `lakes` table (skips any slug that already exists). The curated
 * approach is more reliable than Wikidata SPARQL, which frequently
 * times out on the WDQS public endpoint and returns rows with area in
 * inconsistent units (m² vs km²).
 *
 * The seed list lives at services/openmeteo-refresh/data/lakes-seed.json
 * and is version-controlled; add rows there and re-run.
 *
 * After the insert, run:
 *    pnpm --filter openmeteo-refresh backfill
 *
 * Usage:
 *    pnpm --filter openmeteo-refresh seed:wikidata            # live insert
 *    pnpm --filter openmeteo-refresh seed:wikidata -- --dry   # preview
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_FILE = join(__dirname, "..", "data", "lakes-seed.json");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DRY = process.argv.includes("--dry");

interface SeedLake {
  slug: string;
  name: string;
  country_code: string;
  lat: number;
  lng: number;
  area_km2?: number;
  type?: string;
}

async function main() {
  console.log(`V-Lake · seed  ${DRY ? "(dry-run)" : "(live)"}`);

  const raw = JSON.parse(readFileSync(SEED_FILE, "utf8")) as { lakes: SeedLake[] };
  const candidates = raw.lakes;
  console.log(`  seed file: ${candidates.length} lakes`);

  const { data: existingLakes } = await supabase.from("lakes").select("slug");
  const existing = new Set((existingLakes ?? []).map((r) => r.slug));
  console.log(`  existing: ${existing.size} lakes in DB`);

  const rows = candidates
    .filter((l) => !existing.has(l.slug))
    .map((l) => ({
      slug: l.slug,
      name: l.name,
      country_code: l.country_code,
      lat: l.lat,
      lng: l.lng,
      area_km2: l.area_km2 ?? null,
      type: l.type ?? "lake",
      // Rough importance heuristic: log10(area_km2) + 3, capped [1..10].
      // Lets the map's importance-sort-key surface big lakes first at
      // low zoom levels.
      importance:
        l.area_km2 != null
          ? Math.max(1, Math.min(10, Math.round(Math.log10(Math.max(1, l.area_km2)) + 3)))
          : 3,
    }));

  console.log(`  to insert: ${rows.length} new lakes`);

  if (rows.length === 0) {
    console.log(`  nothing to do — all seed lakes already present.`);
    return;
  }

  if (DRY) {
    console.table(rows.slice(0, 20).map((r) => ({
      slug: r.slug,
      country: r.country_code,
      area: r.area_km2,
      importance: r.importance,
    })));
    console.log(`  (dry-run — ${rows.length} total; showing first 20)`);
    return;
  }

  const CHUNK = 50;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error, count } = await supabase.from("lakes").insert(chunk, { count: "exact" });
    if (error) {
      console.error(`  chunk ${i / CHUNK} error:`, error.message);
      // Best-effort: try individual inserts so one bad row doesn't kill the batch.
      for (const r of chunk) {
        const { error: e2 } = await supabase.from("lakes").insert(r);
        if (e2) console.warn(`    skip ${r.slug}: ${e2.message}`);
        else inserted++;
      }
      continue;
    }
    inserted += count ?? chunk.length;
    process.stdout.write(".");
  }
  process.stdout.write("\n");
  console.log(`  inserted ${inserted} new lakes`);
  console.log(`  next: pnpm --filter openmeteo-refresh backfill  (fills lakes_history + lakes_current)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
