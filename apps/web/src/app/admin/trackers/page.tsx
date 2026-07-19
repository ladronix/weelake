import Link from "next/link";
import { ArrowLeft, Database, Camera, RefreshCw, Waves, Satellite } from "lucide-react";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { Nav } from "@/components/layout/nav";
import { Footer } from "@/components/layout/footer";

/**
 * Weelake · Admin: workers + data freshness overview
 *
 * Read-only. Intentionally unlisted from the navigation and marked
 * `noindex` — this is not a public feature yet, just a diagnostic view
 * for the operator. When we ship real auth this route will move behind
 * it; for now the URL is guessable but the data it shows is already
 * public (which lake has data + how fresh it is) so no harm done.
 */
export const metadata = {
  title: "Admin · Trackers",
  robots: { index: false, follow: false },
};

// Do not statically prerender — always read live from Supabase.
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Row {
  source: string | null;
  measured_at: string | null;
  quality: string | null;
  photo_url: string | null;
  updated_at: string | null;
}

function formatAgo(iso: string | null): string {
  if (!iso) return "—";
  const ago = Date.now() - new Date(iso).getTime();
  if (ago < 60_000) return "just now";
  if (ago < 3600_000) return `${Math.round(ago / 60_000)} min ago`;
  if (ago < 86_400_000) return `${Math.round(ago / 3_600_000)} h ago`;
  return `${Math.round(ago / 86_400_000)} d ago`;
}

export default async function AdminTrackersPage() {
  const supabase = createSupabaseServiceClient();

  // Fetch counts + freshness from the joined view `lakes` × `lakes_current`.
  const { data: joinedRaw } = await supabase
    .from("lakes")
    .select("photo_url, lakes_current(source, measured_at, quality, updated_at)")
    .limit(5000);

  const joined = (joinedRaw ?? []).map((r) => {
    const cur = Array.isArray(r.lakes_current) ? r.lakes_current[0] : r.lakes_current;
    return {
      photo_url: r.photo_url,
      source: cur?.source ?? null,
      measured_at: cur?.measured_at ?? null,
      quality: cur?.quality ?? null,
      updated_at: cur?.updated_at ?? null,
    } as Row;
  });

  const totalLakes = joined.length;
  const withPhoto = joined.filter((r) => !!r.photo_url).length;

  // Per-source breakdown.
  const bySource = new Map<string, Row[]>();
  for (const r of joined) {
    const key = r.source ?? "no data";
    if (!bySource.has(key)) bySource.set(key, []);
    bySource.get(key)!.push(r);
  }

  // Freshness buckets: how old is the last measurement for each row.
  const now = Date.now();
  const bucketOf = (r: Row) => {
    if (!r.measured_at) return "none";
    const hours = (now - new Date(r.measured_at).getTime()) / 3_600_000;
    if (hours < 1) return "<1h";
    if (hours < 6) return "<6h";
    if (hours < 24) return "<24h";
    if (hours < 24 * 7) return "<7d";
    return "older";
  };
  const bucketOrder = ["<1h", "<6h", "<24h", "<7d", "older", "none"] as const;
  const freshness: Record<string, number> = { "<1h": 0, "<6h": 0, "<24h": 0, "<7d": 0, older: 0, none: 0 };
  for (const r of joined) freshness[bucketOf(r)]++;

  const lastRefresh = joined
    .map((r) => r.updated_at)
    .filter((x): x is string => !!x)
    .sort()
    .at(-1);

  const sourceMeta: Record<string, { label: string; icon: React.ReactNode; homepage: string }> = {
    openmeteo_forecast: {
      label: "Open-Meteo Forecast",
      icon: <Waves className="h-4 w-4 text-water-700" aria-hidden="true" />,
      homepage: "https://open-meteo.com/",
    },
    openmeteo_marine: {
      label: "Open-Meteo Marine",
      icon: <Waves className="h-4 w-4 text-cyan-700" aria-hidden="true" />,
      homepage: "https://open-meteo.com/en/docs/marine-weather-api",
    },
    copernicus: {
      label: "Copernicus Marine",
      icon: <Satellite className="h-4 w-4 text-emerald-700" aria-hidden="true" />,
      homepage: "https://marine.copernicus.eu/",
    },
  };

  return (
    <>
      <Nav />
      <main className="section py-8 space-y-8">
        <div>
          <Link href="/" className="text-sm text-water-700 hover:text-water-900 inline-flex items-center gap-1.5">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
          </Link>
          <h1 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-deep">
            Trackers &amp; freshness
          </h1>
          <p className="mt-2 text-slate-600 max-w-2xl">
            Live snapshot of what data source is powering each lake and how fresh the numbers are.
            Refreshed on every page load — nothing is cached.
          </p>
        </div>

        {/* Top-level stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={<Database className="h-4 w-4 text-water-700" aria-hidden="true" />} label="Lakes tracked" value={totalLakes.toString()} />
          <Stat icon={<Camera className="h-4 w-4 text-water-700" aria-hidden="true" />} label="With a photo" value={`${withPhoto} · ${Math.round((withPhoto / Math.max(1, totalLakes)) * 100)}%`} />
          <Stat
            icon={<RefreshCw className="h-4 w-4 text-water-700" aria-hidden="true" />}
            label="Latest refresh"
            value={lastRefresh ? formatAgo(lastRefresh) : "—"}
          />
          <Stat
            icon={<Satellite className="h-4 w-4 text-water-700" aria-hidden="true" />}
            label="Sources active"
            value={bySource.size.toString()}
          />
        </div>

        {/* Freshness histogram */}
        <section>
          <h2 className="text-xl font-semibold text-deep tracking-tight">Freshness distribution</h2>
          <p className="mt-1 text-sm text-slate-500">How old is the most recent temperature measurement per lake.</p>
          <div className="mt-4 space-y-2">
            {bucketOrder.map((b) => {
              const n = freshness[b];
              const pct = totalLakes > 0 ? Math.round((n / totalLakes) * 100) : 0;
              const barColor =
                b === "<1h"  ? "bg-emerald-500"
                : b === "<6h"  ? "bg-emerald-400"
                : b === "<24h" ? "bg-water-500"
                : b === "<7d"  ? "bg-amber-400"
                : b === "older"? "bg-red-500"
                :               "bg-slate-300";
              return (
                <div key={b} className="grid grid-cols-[64px_1fr_100px] items-center gap-3 text-sm">
                  <div className="text-slate-600 font-medium tabular-nums text-right">{b}</div>
                  <div className="h-6 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-right text-slate-700 tabular-nums">
                    <b>{n}</b> <span className="text-slate-400">({pct}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Per-source breakdown */}
        <section>
          <h2 className="text-xl font-semibold text-deep tracking-tight">Sources</h2>
          <p className="mt-1 text-sm text-slate-500">Which upstream provided the latest reading for each lake.</p>

          <div className="mt-4 rounded-3xl border border-water-100/70 bg-white/70 backdrop-blur overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-water-50/60 text-slate-500 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold">Source</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Lakes</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Share</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Latest reading</th>
                </tr>
              </thead>
              <tbody>
                {[...bySource.entries()]
                  .sort((a, b) => b[1].length - a[1].length)
                  .map(([source, rows]) => {
                    const latest = rows
                      .map((r) => r.measured_at)
                      .filter((x): x is string => !!x)
                      .sort()
                      .at(-1);
                    const share = Math.round((rows.length / totalLakes) * 100);
                    const meta = sourceMeta[source];
                    return (
                      <tr key={source} className="border-t border-water-100/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {meta?.icon ?? <Database className="h-4 w-4 text-slate-400" aria-hidden="true" />}
                            <div>
                              <div className="font-medium text-deep">{meta?.label ?? source}</div>
                              {meta && (
                                <a
                                  href={meta.homepage}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[11px] text-slate-500 hover:text-water-700"
                                >
                                  {meta.homepage.replace(/^https?:\/\//, "")}
                                </a>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-deep tabular-nums">{rows.length}</td>
                        <td className="px-4 py-3 text-right text-slate-500 tabular-nums">{share}%</td>
                        <td className="px-4 py-3 text-right text-slate-500 tabular-nums">{formatAgo(latest ?? null)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Runbook */}
        <section>
          <h2 className="text-xl font-semibold text-deep tracking-tight">Manual refresh</h2>
          <p className="mt-1 text-sm text-slate-500">Run these from your machine when data looks stale.</p>
          <div className="mt-4 rounded-3xl border border-water-100/70 bg-white/60 p-5 text-sm space-y-3 font-mono">
            <div><span className="text-slate-500"># fill 15-day history for every lake</span></div>
            <div>pnpm --filter openmeteo-refresh backfill</div>
            <div><span className="text-slate-500"># backfill Wikimedia photos for lakes that don&apos;t have one</span></div>
            <div>pnpm --filter openmeteo-refresh photos</div>
            <div><span className="text-slate-500"># add new curated lakes from data/lakes-seed.json</span></div>
            <div>pnpm --filter openmeteo-refresh seed:more</div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white/70 backdrop-blur-md border border-white/60 p-4 shadow-[0_8px_30px_rgba(14,165,233,0.06)]">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-deep tabular-nums">{value}</div>
    </div>
  );
}
