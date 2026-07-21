"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { usePrefs, toDisplayTemp, unitSymbol } from "@/lib/prefs";

/**
 * Single data point on the chart.
 * `t` is any label the caller assigns (usually ISO date); we treat
 * it as opaque so the caller can pre-format if needed.
 */
export interface ChartPoint {
  t: string;
  /** Water temperature in °C. Skip the point (undefined) to leave a gap. */
  water?: number | null;
  /** Ambient air temperature in °C for the same time. Same rules. */
  air?: number | null;
}

interface Props {
  points: ChartPoint[];
  /** Height in px. Default 80 — mini sparkline sized for a popover. */
  height?: number;
  /** Show axis labels + min/max. Default false for the smallest look. */
  labels?: boolean;
  className?: string;
  /** Optional legend text (i18n-ready). */
  waterLabel?: string;
  airLabel?: string;
}

/**
 * MiniTempChart — two-series line chart (water + air) for a small
 * space. Renders raw SVG so we avoid a heavyweight chart lib for
 * a use case that just needs one polyline per series.
 *
 * The two series share a Y axis so the visual gap between water
 * and air is meaningful (Lake at 22°, air at 27° => visible offset).
 * X is a uniform step index (0..N-1) — real timestamps would need
 * a variable X but for a 7-day dense series uniform spacing reads
 * better in a 200×80 popover.
 *
 * Reads the user's unit preference to render tooltip / axis labels
 * in their chosen unit (°C or °F).
 */
export function MiniTempChart({
  points,
  height = 80,
  labels = false,
  className,
  waterLabel = "Water",
  airLabel = "Air",
}: Props) {
  const { prefs } = usePrefs();
  const unit = unitSymbol(prefs.unit);

  const geom = useMemo(() => {
    const water = points.map((p) => (p.water == null ? null : p.water));
    const air = points.map((p) => (p.air == null ? null : p.air));

    const flat = [...water, ...air].filter((v): v is number => v != null);
    if (flat.length === 0) return null;

    const min = Math.min(...flat);
    const max = Math.max(...flat);
    const pad = Math.max(1, (max - min) * 0.15);
    const yMin = min - pad;
    const yMax = max + pad;
    const yRange = yMax - yMin || 1;

    const width = 200;
    const n = points.length;
    const xStep = n > 1 ? width / (n - 1) : 0;

    const toPath = (series: (number | null)[]): string => {
      let out = "";
      let started = false;
      for (let i = 0; i < series.length; i++) {
        const v = series[i];
        if (v == null) {
          started = false;
          continue;
        }
        const x = i * xStep;
        const y = height - ((v - yMin) / yRange) * height;
        out += (started ? "L" : "M") + x.toFixed(1) + "," + y.toFixed(1) + " ";
        started = true;
      }
      return out.trim();
    };

    return {
      width,
      waterPath: toPath(water),
      airPath: toPath(air),
      yMin,
      yMax,
      // Convert display bounds; both inputs come from `flat` so
      // they're never null, but toDisplayTemp is typed to allow
      // null — pin the return to number here.
      yMinDisplay: toDisplayTemp(yMin, prefs.unit) ?? yMin,
      yMaxDisplay: toDisplayTemp(yMax, prefs.unit) ?? yMax,
    };
  }, [points, height, prefs.unit]);

  if (!geom) {
    return (
      <div
        className={cn("flex items-center justify-center text-[10px] text-white/70", className)}
        style={{ height: `${height}px` }}
      >
        No trend data yet
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${geom.width} ${height}`}
        preserveAspectRatio="none"
        className="w-full block"
        style={{ height: `${height}px` }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="water-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="rgba(255,255,255,0.35)" />
            <stop offset="1" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        {/* Air (dashed) drawn under water so water lands on top. */}
        {geom.airPath && (
          <path
            d={geom.airPath}
            fill="none"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth={1.5}
            strokeDasharray="3 3"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {/* Water fill area (from path down) — the sparkle. */}
        {geom.waterPath && (
          <>
            <path
              d={`${geom.waterPath} L${geom.width},${height} L0,${height} Z`}
              fill="url(#water-fill)"
            />
            <path
              d={geom.waterPath}
              fill="none"
              stroke="rgba(255,255,255,0.95)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
      </svg>
      {labels && (
        <div className="mt-1 flex justify-between text-[10px] text-white/80 tabular-nums">
          <span>{geom.yMinDisplay.toFixed(0)}{unit}</span>
          <span className="opacity-70">
            {waterLabel} · <span className="opacity-80">{airLabel}</span>
          </span>
          <span>{geom.yMaxDisplay.toFixed(0)}{unit}</span>
        </div>
      )}
    </div>
  );
}
