/**
 * V-Lake · batch #2 seed
 * ---------------------
 * Idempotent seeder for the extra lakes defined in
 * ./data/lakes-batch-2.ts. Skips any slug that already exists in
 * the lakes table. Run after `seed-more` to fatten the global
 * coverage before the next backfill.
 *
 * Usage:
 *    pnpm --filter openmeteo-refresh seed-batch-2
 *    pnpm --filter openmeteo-refresh seed-batch-2 -- --dry   # preview
 */
import { createClient } from "@supabase/supabase-js";
import { LAKES_BATCH_2 } from "../data/lakes-batch-2";

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

  const fresh = LAKES_BATCH_2.filter((l) => !existingSlugs.has(l.slug));
  const skipped = LAKES_BATCH_2.length - fresh.length;

  console.log(`Batch #2 has ${LAKES_BATCH_2.length} entries; ${skipped} already exist; inserting ${fresh.length}.`);
  if (DRY) {
    console.log("Dry run — first 5 to be inserted:", fresh.slice(0, 5));
    return;
  }

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
    if (error) console.warn(`· ${lake.slug} — ${error.message}`);
    else console.log(`· ${lake.slug} inserted`);
  }
  console.log("Done — remember to run photos-backfill and refresh next.");
}

main().catch((e) => { console.error(e); process.exit(1); });
