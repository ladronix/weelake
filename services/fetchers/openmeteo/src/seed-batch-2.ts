/**
 * Weelake · seed batch #2 — East Asia / Africa / S.America / Oceania.
 *
 * Uses the shared runSeedBatch helper from @weelake/fetcher-lib
 * which enforces:
 *   - slug dedupe (existing slug → skip)
 *   - name dedupe (same normalised name in same country → skip + warn)
 *   - spatial dedupe (< 500 m in same country → skip + warn)
 *
 * Adding a new lake that already exists under a different slug will
 * be caught here rather than after the fact by dedupe-cz.ts.
 */
import {
  createFetcherSupabaseClient,
  makeLogger,
  runSeedBatch,
} from "@weelake/fetcher-lib";
import { LAKES_BATCH_2 } from "../data/lakes-batch-2";

const log = makeLogger("seed-batch-2");
const supabase = createFetcherSupabaseClient();
const DRY = process.argv.includes("--dry");

await runSeedBatch(supabase, "batch-2", LAKES_BATCH_2, { dry: DRY, log });
