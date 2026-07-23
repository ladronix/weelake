/**
 * Weelake · batch #3 seed — European recreation lakes.
 *
 * Runs the same idempotent INSERT-IGNORE pattern as seed-batch-2:
 * fetch existing slugs, skip anything already present, insert the
 * rest one row at a time so a single validation error doesn't wipe
 * the whole batch.
 *
 * Usage:
 *    pnpm --filter openmeteo-refresh seed:batch-3
 *    pnpm --filter openmeteo-refresh seed:batch-3 -- --dry
 *
 * After a successful run:
 *    pnpm --filter openmeteo-refresh start          # refresh temps
 *    pnpm --filter openmeteo-refresh photos         # Wikimedia thumbnails
 */
import { createClient } from "@supabase/supabase-js";
import { LAKES_BATCH_3 } from "../data/lakes-batch-3";

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

async function main() {
  const { data: existing } = await supabase.from("lakes").select("slug");
  const existingSlugs = new Set(existing?.map((r) => r.slug) ?? []);
  const fresh = LAKES_BATCH_3.filter((l) => !existingSlugs.has(l.slug));
  const skipped = LAKES_BATCH_3.length - fresh.length;

  console.log(`Batch #3 has ${LAKES_BATCH_3.length} entries; ${skipped} already exist; inserting ${fresh.length}.`);
  if (DRY) {
    console.log("Dry run - first 5 to be inserted:", fresh.slice(0, 5));
    return;
  }

  let ok = 0, fail = 0;
  for (const lake of fresh) {
    const { error } = await supabase.from("lakes").insert({
      slug:         lake.slug,
      name:         lake.name,
      country_code: lake.country_code,
      lat:          lake.lat,
      lng:          lake.lng,
      area_km2:     lake.area_km2 ?? null,
      type:         lake.type ?? "lake",
    });
    if (error) { console.warn(`X ${lake.slug} - ${error.message}`); fail++; }
    else       { console.log (`OK ${lake.slug}`); ok++; }
  }
  console.log(`Done. inserted=${ok} failed=${fail}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
