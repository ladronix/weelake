/**
 * Weelake · one-shot cleanup: remove duplicate lake slugs
 *
 * Some early seeds landed with both a "clean" slug (`vattern`) and a
 * later duplicate (`vaettern`, `vaeternn`, …). This script deletes the
 * duplicate rows (and their history / current rows) so the sidebar
 * doesn't list two entries for the same lake.
 *
 * Run once:
 *   pnpm --filter openmeteo-refresh exec tsx src/dedupe-lakes.ts
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Slugs that are duplicates. Each of these has a canonical counterpart
// (e.g. `muritz` duplicates the older `mueritz`, `seec` duplicates
// `sec`, etc). Deleting them leaves the canonical row untouched.
const DUPLICATE_SLUGS = [
  "muritz",
  "vattern",
  "thunersee",
  "brienzersee",
  "bourget",
  "tisza-lake",
  "orava-dam",
  "vierwaldstattersee",
  "seec",
  "most-lake",
  "seed-lipno",
  "horni-mokrsko",
  "gennargentu", // renamed to `omodeo` in the seed file
];

async function main() {
  console.log("Weelake · dedupe-lakes");
  for (const slug of DUPLICATE_SLUGS) {
    const { data: lake } = await supabase
      .from("lakes")
      .select("id, slug")
      .eq("slug", slug)
      .maybeSingle();
    if (!lake) {
      console.log(`  (skip) ${slug} — not present`);
      continue;
    }
    // Cascade delete: history, current, then lake row itself.
    await supabase.from("lakes_history").delete().eq("lake_id", lake.id);
    await supabase.from("lakes_current").delete().eq("lake_id", lake.id);
    const { error } = await supabase.from("lakes").delete().eq("id", lake.id);
    if (error) {
      console.error(`  FAIL ${slug}: ${error.message}`);
    } else {
      console.log(`  \u2717 ${slug} removed`);
    }
  }
  console.log("done");
}

main().catch((e) => { console.error(e); process.exit(1); });
