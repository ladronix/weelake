/**
 * Weelake · CZ batch #4 seeder — INSERT-IGNORE.
 * Same shape as seed-batch-2 / seed-batch-3.
 */
import { createClient } from "@supabase/supabase-js";
import { LAKES_BATCH_4_CZ } from "../data/lakes-batch-4-cz";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error("Missing env"); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const DRY = process.argv.includes("--dry");

async function main() {
  const { data: existing } = await supabase.from("lakes").select("slug");
  const existingSlugs = new Set(existing?.map((r) => r.slug) ?? []);
  const fresh = LAKES_BATCH_4_CZ.filter((l) => !existingSlugs.has(l.slug));
  const skipped = LAKES_BATCH_4_CZ.length - fresh.length;
  console.log(`Batch #4 CZ: ${LAKES_BATCH_4_CZ.length} entries, ${skipped} exist, inserting ${fresh.length}.`);
  if (DRY) return;
  let ok = 0, fail = 0;
  for (const lake of fresh) {
    const { error } = await supabase.from("lakes").insert({
      slug: lake.slug, name: lake.name, country_code: lake.country_code,
      lat: lake.lat, lng: lake.lng, area_km2: lake.area_km2 ?? null,
      type: lake.type ?? "reservoir",
    });
    if (error) { console.warn(`X ${lake.slug} - ${error.message}`); fail++; }
    else       { console.log(`OK ${lake.slug}`); ok++; }
  }
  console.log(`Done. inserted=${ok} failed=${fail}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
