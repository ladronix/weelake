import type { SupabaseClient } from "@supabase/supabase-js";
import type { Logger } from "./logger";

export type FetcherRole = "live" | "recent" | "anchor";

export interface RunCounts {
  ok?: number;
  fail?: number;
  skip?: number;
}

/**
 * startRun — insert a `fetcher_runs` row with status='running'.
 * Returns the row's UUID; pass it to finishRun() when done.
 *
 * If the DB insert fails (network glitch, RLS misconfig), we log
 * a warning and return null so the fetcher can still complete its
 * data work — monitoring is nice-to-have, correctness is not.
 */
export async function startRun(
  supabase: SupabaseClient,
  fetcher: string,
  role: FetcherRole,
  log: Logger,
): Promise<string | null> {
  const t0 = Date.now();
  log.info({ event: "run.start", fetcher, role });
  const { data, error } = await supabase
    .from("fetcher_runs")
    .insert({ fetcher, role, status: "running" })
    .select("id")
    .single();
  if (error) {
    log.warn({ event: "run.start.db_failed", message: error.message });
    return null;
  }
  (data as { started_at?: string } | undefined)?.started_at; // suppress unused
  return (data as { id: string }).id ?? null;
}

/**
 * finishRun — patch the row with final status + counters + duration.
 *
 * Status is auto-derived:
 *   fail=0 && ok>0                  → "ok"
 *   fail>0 && ok>0                  → "partial"
 *   fail>0 && ok===0                → "failed"
 *   nothing to do (ok=fail=skip=0)  → "ok" (heartbeat)
 * A caller can override with an explicit `status` field.
 */
export async function finishRun(
  supabase: SupabaseClient,
  runId: string | null,
  counts: RunCounts,
  log: Logger,
  opts: { startedAt?: number; message?: string; status?: "ok" | "partial" | "failed" } = {},
): Promise<void> {
  const ok = counts.ok ?? 0;
  const fail = counts.fail ?? 0;
  const skip = counts.skip ?? 0;
  const status: "ok" | "partial" | "failed" =
    opts.status ??
    (fail === 0 ? "ok" : ok === 0 ? "failed" : "partial");
  const duration_ms = opts.startedAt ? Date.now() - opts.startedAt : undefined;

  log.info({ event: "run.finish", status, ok, fail, skip, duration_ms });

  if (!runId) return; // monitoring failed to start; already logged.

  const { error } = await supabase
    .from("fetcher_runs")
    .update({
      finished_at: new Date().toISOString(),
      status,
      ok_count: ok,
      fail_count: fail,
      skip_count: skip,
      message: opts.message ?? null,
      duration_ms,
    })
    .eq("id", runId);
  if (error) log.warn({ event: "run.finish.db_failed", message: error.message });
}

/**
 * Convenience wrapper — most fetchers just want:
 *
 *   await withRun(supabase, "openmeteo", "live", log, async (counts) => {
 *     for (const lake of lakes) {
 *       try { await fetchOne(lake); counts.ok++; }
 *       catch { counts.fail++; }
 *     }
 *   });
 *
 * On uncaught throw the run is marked "failed" with the error
 * message. Counts you mutate along the way land in the DB row.
 */
export async function withRun(
  supabase: SupabaseClient,
  fetcher: string,
  role: FetcherRole,
  log: Logger,
  body: (counts: { ok: number; fail: number; skip: number }) => Promise<void>,
): Promise<void> {
  const startedAt = Date.now();
  const runId = await startRun(supabase, fetcher, role, log);
  const counts = { ok: 0, fail: 0, skip: 0 };
  try {
    await body(counts);
    await finishRun(supabase, runId, counts, log, { startedAt });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log.error({ event: "run.crash", message });
    await finishRun(supabase, runId, counts, log, {
      startedAt,
      status: "failed",
      message,
    });
    throw e;
  }
}
