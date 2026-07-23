import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";

/**
 * GET /api/monitor
 *
 * Health snapshot for every fetcher in the last 7 days. Powers the
 * admin dashboard + the SyncBadge extended view. Public read (RLS
 * allows), cached at edge for 60s so refreshing the dashboard
 * doesn't hammer the DB.
 *
 * Payload shape:
 *   {
 *     fetchers: [{
 *       name: "openmeteo",
 *       last_run: {
 *         started_at, finished_at, status, ok, fail, skip,
 *         duration_ms, message
 *       },
 *       success_rate_7d: 0.98,        // ok+partial / total, past 7 days
 *       runs_7d: 7,
 *       avg_duration_ms_7d: 41230,
 *     }, ...],
 *     generated_at: iso
 *   }
 */
type FetcherRun = {
  fetcher: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "ok" | "partial" | "failed";
  ok_count: number;
  fail_count: number;
  skip_count: number;
  message: string | null;
  duration_ms: number | null;
};

export async function GET() {
  const supabase = createSupabaseServiceClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600e3).toISOString();

  const { data: runsRaw, error } = await supabase
    .from("fetcher_runs")
    .select("fetcher, started_at, finished_at, status, ok_count, fail_count, skip_count, message, duration_ms")
    .gte("started_at", sevenDaysAgo)
    .order("started_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const runs = (runsRaw ?? []) as FetcherRun[];
  const grouped = new Map<string, FetcherRun[]>();
  for (const r of runs) {
    const list = grouped.get(r.fetcher) ?? [];
    list.push(r);
    grouped.set(r.fetcher, list);
  }

  const fetchers = Array.from(grouped.entries())
    .map(([name, list]) => {
      const [last] = list;
      const finished = list.filter((r) => r.status !== "running");
      const successes = finished.filter((r) => r.status === "ok" || r.status === "partial").length;
      const durations = finished
        .map((r) => r.duration_ms ?? 0)
        .filter((n) => n > 0);
      const avgDuration =
        durations.length > 0
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : null;

      return {
        name,
        last_run: {
          started_at: last.started_at,
          finished_at: last.finished_at,
          status: last.status,
          ok: last.ok_count,
          fail: last.fail_count,
          skip: last.skip_count,
          duration_ms: last.duration_ms,
          message: last.message,
        },
        success_rate_7d: finished.length > 0 ? successes / finished.length : null,
        runs_7d: list.length,
        avg_duration_ms_7d: avgDuration,
      };
    })
    // Sort so unhealthy fetchers surface first.
    .sort((a, b) => {
      const rankStatus = (s: string) => (s === "failed" ? 0 : s === "partial" ? 1 : s === "running" ? 2 : 3);
      return rankStatus(a.last_run.status) - rankStatus(b.last_run.status);
    });

  return NextResponse.json(
    {
      fetchers,
      generated_at: new Date().toISOString(),
    },
    {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    },
  );
}
