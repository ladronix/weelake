/**
 * Weelake · @weelake/fetcher-lib
 * -----------------------------
 * Everything a scheduled data fetcher needs:
 *   - createSupabaseClient()   — service-role client
 *   - startRun / finishRun     — fetcher_runs monitoring rows
 *   - log()                    — structured JSON logger
 *   - retry()                  — exponential backoff with jitter
 *
 * Kept small on purpose — this is a contract, not a framework.
 * If a helper is only used by one fetcher, it belongs in that
 * fetcher's own tree.
 */

export * from "./supabase";
export * from "./logger";
export * from "./run";
export * from "./retry";
