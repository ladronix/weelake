"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useT } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { relativeTime } from "@/lib/temperature";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

interface Stats {
  total_lakes: number;
  countries_count: number;
  last_sync_at: string | null;
  sources: Record<string, number>;
}

/**
 * Small "data freshness" badge showing how long ago the daily worker
 * last wrote temperatures into Supabase (the newest `updated_at` across
 * `lakes_current`).
 *
 * Fetches `/api/stats` on mount and refreshes every 5 minutes while the
 * tab is visible. Tap the badge → tooltip with per-source counts.
 *
 * Colour rules (freshness heuristic):
 *   < 6h  → green   (fresh, on-schedule)
 *   < 24h → water   (normal daily cadence)
 *   < 72h → amber   (a run was missed)
 *   older → red     (something's off)
 *   none  → slate   (no data yet)
 */
export function SyncBadge({ className, compact }: { className?: string; compact?: boolean }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const t = useT();
  const { prefs, mounted } = usePrefs();
  const locale = mounted ? prefs.lang : DEFAULT_LOCALE;

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch("/api/stats")
        .then((r) => (r.ok ? r.json() : null))
        .then((data: Stats | null) => {
          if (!cancelled && data) setStats(data);
        })
        .catch(() => { /* ignore transient errors */ });
    };
    load();
    const iv = setInterval(load, 5 * 60_000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      clearInterval(iv);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  if (!stats || !stats.last_sync_at) return null;

  const ageHours = (Date.now() - new Date(stats.last_sync_at).getTime()) / 3_600_000;
  const dotClass =
    ageHours < 6   ? "bg-emerald-500"
    : ageHours < 24  ? "bg-water-500"
    : ageHours < 72  ? "bg-amber-500"
    :                  "bg-red-500";
  const isFresh = ageHours < 24;

  return (
    <div className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={() => setShowTooltip((v) => !v)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-white/60 backdrop-blur bg-white/70 hover:bg-white transition text-xs font-medium text-slate-700 shadow-sm",
          compact ? "px-2 py-1" : "px-3 py-1.5",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-water-500 focus-visible:ring-offset-2",
        )}
        aria-label={t("sync.lastUpdatedLong", { ago: relativeTime(stats.last_sync_at, locale) })}
      >
        <span className="relative flex h-2 w-2" aria-hidden="true">
          {isFresh && (
            <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", dotClass)} />
          )}
          <span className={cn("relative inline-flex rounded-full h-2 w-2", dotClass)} />
        </span>
        {!compact && <RefreshCw className="h-3 w-3 text-slate-400" aria-hidden="true" />}
        <span className="tabular-nums">{relativeTime(stats.last_sync_at, locale)}</span>
      </button>

      {showTooltip && (
        <div
          role="tooltip"
          className="absolute top-full right-0 mt-2 w-64 rounded-2xl bg-white/95 backdrop-blur-xl border border-white/60 shadow-[0_10px_40px_rgba(14,165,233,0.20)] p-3 z-50 text-left"
        >
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
            {t("sync.title")}
          </div>
          <div className="text-sm text-deep">
            {t("sync.lastUpdated", { ago: relativeTime(stats.last_sync_at, locale) })}
          </div>
          {Object.keys(stats.sources).length > 0 && (
            <>
              <div className="mt-3 text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                {t("sync.sources")}
              </div>
              <ul className="space-y-0.5 text-xs text-slate-600">
                {Object.entries(stats.sources)
                  .sort((a, b) => b[1] - a[1])
                  .map(([source, count]) => (
                    <li key={source} className="flex items-center justify-between gap-2">
                      <span className="truncate">{sourceLabel(source, t)}</span>
                      <span className="tabular-nums text-slate-500">{count}</span>
                    </li>
                  ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Map an internal source key to a friendly display label. */
function sourceLabel(source: string, t: (k: string) => string): string {
  switch (source) {
    case "openmeteo_forecast": return "Open-Meteo Forecast";
    case "openmeteo_marine":   return "Open-Meteo Marine";
    case "copernicus_cds":     return "Copernicus CDS";
    case "copernicus":         return "Copernicus";
    default:                   return t(`sync.source.${source}`) === `sync.source.${source}` ? source : t(`sync.source.${source}`);
  }
}
