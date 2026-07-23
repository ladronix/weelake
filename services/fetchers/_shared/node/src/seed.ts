import type { SupabaseClient } from "@supabase/supabase-js";
import type { Logger } from "./logger";

export interface SeedLake {
  slug: string;
  name: string;
  country_code: string;
  lat: number;
  lng: number;
  area_km2?: number | null;
  type?: string;
  /** Optional local-language name; helps future dedupe by matching
   *  seed batches that use the English name against ones that use
   *  the local one. */
  name_local?: string | null;
}

export interface SeedResult {
  /** Slug of the newly inserted row (empty if skipped). */
  slug: string;
  /** What happened: inserted / skipped-slug / skipped-duplicate / failed. */
  outcome: "inserted" | "skipped_slug" | "skipped_duplicate" | "failed";
  /** For skipped_duplicate — which existing lake this one duplicates. */
  duplicate_of?: string;
  /** For failed — the error message. */
  message?: string;
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

/** Fold diacritics + non-alphanumerics; used for name similarity. */
function normaliseName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(lake|reservoir|nádrž|přehrada|jezero|see|pond|rybník|lac|lago|meer)\b/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Idempotent, duplicate-aware lake insert.
 *
 * Every seed batch should call this instead of a raw
 * `supabase.from("lakes").insert(...)`. It prevents THREE distinct
 * kinds of "duplicate" that have bitten us:
 *
 *   1. Same slug already exists           — skip.
 *   2. Different slug but same normalised
 *      name (e.g. 'most' vs 'most-lake')  — skip AND warn so the
 *                                            operator can prune the
 *                                            batch source list.
 *   3. Different slug + different name
 *      but coordinates within 500 m       — same physical lake seeded
 *                                            under two Wikipedia names
 *                                            (e.g. Lac Léman FR vs
 *                                            Lake Geneva CH). Skip
 *                                            AND warn.
 *
 * Returns a SeedResult so the caller's batch script can print a
 * clean summary — inserted vs. skipped-slug vs. skipped-duplicate
 * vs. failed.
 *
 * NOT a database transaction — a batch that inserts N lakes runs N
 * separate calls. That's intentional: the seed script is an
 * operator tool, run manually, and a partial success beats a full
 * rollback when one row hits a schema-validation edge case.
 */
export async function insertLakeDeduped(
  supabase: SupabaseClient,
  lake: SeedLake,
  existing: ExistingLake[],
  log?: Logger,
): Promise<SeedResult> {
  const slugHit = existing.find((e) => e.slug === lake.slug);
  if (slugHit) {
    return { slug: lake.slug, outcome: "skipped_slug", duplicate_of: slugHit.slug };
  }

  const targetName = normaliseName(lake.name);
  const targetLocal = lake.name_local ? normaliseName(lake.name_local) : "";

  // Name-based match. Same country only — two lakes with identical
  // names in different countries are legit distinct.
  const nameHit = existing.find((e) => {
    if (e.country_code !== lake.country_code) return false;
    const en = normaliseName(e.name);
    const el = e.name_local ? normaliseName(e.name_local) : "";
    return en === targetName || el === targetName || en === targetLocal;
  });
  if (nameHit) {
    log?.warn({
      event: "seed.skip_duplicate",
      reason: "name",
      candidate: lake.slug,
      duplicate_of: nameHit.slug,
    });
    return { slug: lake.slug, outcome: "skipped_duplicate", duplicate_of: nameHit.slug };
  }

  // Spatial match — within 500 m and same country. Handles the
  // "Lac Léman FR shore vs Lake Geneva CH shore" and similar
  // cross-batch confusion.
  const nearHit = existing.find((e) => {
    if (e.country_code !== lake.country_code) return false;
    return haversineKm({ lat: e.lat, lng: e.lng }, lake) < 0.5;
  });
  if (nearHit) {
    log?.warn({
      event: "seed.skip_duplicate",
      reason: "spatial",
      candidate: lake.slug,
      duplicate_of: nearHit.slug,
    });
    return { slug: lake.slug, outcome: "skipped_duplicate", duplicate_of: nearHit.slug };
  }

  // OK to insert.
  const { error } = await supabase.from("lakes").insert({
    slug: lake.slug,
    name: lake.name,
    name_local: lake.name_local ?? null,
    country_code: lake.country_code,
    lat: lake.lat,
    lng: lake.lng,
    area_km2: lake.area_km2 ?? null,
    type: lake.type ?? "lake",
  });
  if (error) {
    return { slug: lake.slug, outcome: "failed", message: error.message };
  }
  // Keep the in-memory existing list current so subsequent inserts
  // in the same batch don't accept a self-duplicate.
  existing.push({
    slug: lake.slug,
    name: lake.name,
    name_local: lake.name_local ?? null,
    country_code: lake.country_code,
    lat: lake.lat,
    lng: lake.lng,
  });
  return { slug: lake.slug, outcome: "inserted" };
}

export interface ExistingLake {
  slug: string;
  name: string;
  name_local: string | null;
  country_code: string;
  lat: number;
  lng: number;
}

/** Fetch the current lakes table, in the shape insertLakeDeduped needs. */
export async function loadExistingLakes(supabase: SupabaseClient): Promise<ExistingLake[]> {
  const { data, error } = await supabase
    .from("lakes")
    .select("slug, name, name_local, country_code, lat, lng");
  if (error) throw new Error(`load existing lakes: ${error.message}`);
  return (data ?? []) as ExistingLake[];
}

/**
 * Batch runner — takes an array of seeds, calls insertLakeDeduped
 * for each, and prints a summary. This is what a `seed-batch-N.ts`
 * script should call at the top level.
 */
export async function runSeedBatch(
  supabase: SupabaseClient,
  batchName: string,
  seeds: readonly SeedLake[],
  opts: { dry?: boolean; log?: Logger } = {},
): Promise<void> {
  const log = opts.log;
  const existing = await loadExistingLakes(supabase);
  log?.info({ event: "seed.plan", batch: batchName, size: seeds.length, existing: existing.length });

  const counts = { inserted: 0, skipped_slug: 0, skipped_duplicate: 0, failed: 0 };

  for (const seed of seeds) {
    if (opts.dry) {
      // In dry mode, still evaluate against existing so operator sees
      // what would happen; just don't hit the DB write path.
      const preview = { ...seed };
      const slugHit = existing.find((e) => e.slug === preview.slug);
      const nameHit = existing.find(
        (e) =>
          e.country_code === preview.country_code &&
          (normaliseName(e.name) === normaliseName(preview.name) ||
            (e.name_local && normaliseName(e.name_local) === normaliseName(preview.name))),
      );
      const nearHit = existing.find(
        (e) => e.country_code === preview.country_code && haversineKm(e, preview) < 0.5,
      );
      const outcome = slugHit ? "skipped_slug" : nameHit || nearHit ? "skipped_duplicate" : "inserted";
      console.log(`  [dry] ${outcome.padEnd(20)} ${preview.slug.padEnd(24)} ${preview.name}`);
      counts[outcome]++;
      continue;
    }

    const result = await insertLakeDeduped(supabase, seed, existing, log);
    counts[result.outcome]++;
    const tag =
      result.outcome === "inserted" ? "OK  " :
      result.outcome === "skipped_slug" ? "skip" :
      result.outcome === "skipped_duplicate" ? "dupe" :
      "FAIL";
    const note = result.duplicate_of ? ` (dupe of ${result.duplicate_of})` : result.message ? ` — ${result.message}` : "";
    console.log(`  ${tag} ${seed.slug.padEnd(24)} ${seed.name}${note}`);
  }

  console.log(
    `\n${batchName}: inserted=${counts.inserted} skipped_slug=${counts.skipped_slug} skipped_duplicate=${counts.skipped_duplicate} failed=${counts.failed} (of ${seeds.length})`,
  );
  log?.info({ event: "seed.finish", batch: batchName, ...counts });
}
