/**
 * Weelake · seed batch #4 CZ — Czech reservoir completion.
 * See seed-batch-2.ts for the shared dedup semantics.
 */
import {
  createFetcherSupabaseClient,
  makeLogger,
  runSeedBatch,
} from "@weelake/fetcher-lib";
import { LAKES_BATCH_4_CZ } from "../data/lakes-batch-4-cz";

const log = makeLogger("seed-batch-4-cz");
const supabase = createFetcherSupabaseClient();
const DRY = process.argv.includes("--dry");

await runSeedBatch(supabase, "batch-4-cz", LAKES_BATCH_4_CZ, { dry: DRY, log });
