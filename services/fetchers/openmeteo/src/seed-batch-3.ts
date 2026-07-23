/**
 * Weelake · seed batch #3 — European recreation lakes.
 * See seed-batch-2.ts for the shared dedup semantics.
 */
import {
  createFetcherSupabaseClient,
  makeLogger,
  runSeedBatch,
} from "@weelake/fetcher-lib";
import { LAKES_BATCH_3 } from "../data/lakes-batch-3";

const log = makeLogger("seed-batch-3");
const supabase = createFetcherSupabaseClient();
const DRY = process.argv.includes("--dry");

await runSeedBatch(supabase, "batch-3", LAKES_BATCH_3, { dry: DRY, log });
