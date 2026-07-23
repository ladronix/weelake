/**
 * One-off: remove Czech lake duplicates that accumulated across
 * multiple seed passes (lipno + seed-lipno, most + most-lake, ...).
 *
 * We keep the entry that is:
 *   1. NOT prefixed with 'seed-' (temporary seeder slug)
 *   2. otherwise the shorter, cleaner slug
 *
 * All downstream references (lakes_current, lakes_history) cascade
 * via foreign key so deleting the "loser" also removes its cached
 * temperature readings — the surviving entry will be refreshed on
 * the next fetcher run.
 *
 * Usage:
 *   pnpm --filter @weelake/fetcher-openmeteo dedupe-cz -- --dry
 *   pnpm --filter @weelake/fetcher-openmeteo dedupe-cz
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
const DRY = process.argv.includes("--dry");

/**
 * Explicit dedupe pairs — keep the LEFT slug, delete the RIGHT one.
 * Written explicitly rather than auto-detected because we want a
 * human to review each choice: names collide but sometimes for
 * legitimate reasons (two lakes both called 'Kamenice').
 */
const PAIRS: Array<[keep: string, remove: string]> = [
  ["lipno",           "seed-lipno"],
  ["most",            "most-lake"],
  ["sec",             "seec"],
  ["jesenice-cheb",   "jesenice-reservoir"],
  ["svihov-zelivka",  "svihov"],
];

async function main() {
  for (const [keep, remove] of PAIRS) {
    const { data: keepRow } = await supabase.from("lakes").select("id, slug").eq("slug", keep).maybeSingle();
    const { data: rmRow }   = await supabase.from("lakes").select("id, slug").eq("slug", remove).maybeSingle();
    if (!keepRow) { console.log(`  ? keep ${keep} — not found, skipping`); continue; }
    if (!rmRow)   { console.log(`  · rm   ${remove} — not found, nothing to do`); continue; }

    console.log(`  ${DRY ? "[dry]" : "     "}  keep ${keep.padEnd(24)} remove ${remove}`);
    if (DRY) continue;

    // Delete downstream first so no orphan history rows survive.
    // lakes_current has ON DELETE CASCADE; lakes_history does too
    // (see initial schema). But be defensive — a stale FK is worse
    // than a doubly-deleted row.
    await supabase.from("lakes_current").delete().eq("lake_id", rmRow.id);
    await supabase.from("lakes_history").delete().eq("lake_id", rmRow.id);
    const { error } = await supabase.from("lakes").delete().eq("id", rmRow.id);
    if (error) console.warn(`     ERROR ${remove} - ${error.message}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
