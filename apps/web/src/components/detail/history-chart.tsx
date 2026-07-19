"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { useMemo } from "react";

interface Point { time: string; date?: string; temp: number }

interface Props {
  data: Point[];
  color: string;
}

/**
 * Water temperature chart.
 * - Solid area = historical measurements.
 * - Dashed area = 5-day forward estimate (simple linear regression of last 7 pts).
 */
export function HistoryChart({ data, color }: Props) {
  const combined = useMemo(() => {
    if (data.length < 3) return data.map((d) => ({ ...d, kind: "past" as const }));
    // Linear regression on last 7 measurements to project trend.
    const last = data.slice(-7);
    const n = last.length;
    const xs = last.map((_, i) => i);
    const ys = last.map((p) => p.temp);
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
    const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
    const slope = den === 0 ? 0 : num / den;
    const intercept = my - slope * mx;

    // Dampen the slope so extrapolation is conservative.
    const dampSlope = slope * 0.6;

    const start = data[data.length - 1];
    const startDate = start.date ? new Date(start.date) : new Date();
    const forecast: (Point & { kind: "forecast" })[] = [];
    for (let i = 1; i <= 5; i++) {
      const t = intercept + dampSlope * (n - 1 + i);
      const d = new Date(startDate.getTime() + i * 86400_000);
      forecast.push({
        time: d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" }),
        date: d.toISOString(),
        temp: Number(Math.max(0, Math.min(32, t)).toFixed(1)),
        kind: "forecast",
      });
    }

    return [
      ...data.map((d) => ({ ...d, kind: "past" as const })),
      // Slight overlap so both series render nicely.
      { ...start, kind: "forecast" as const },
      ...forecast,
    ];
  }, [data]);

  const past     = combined.filter((p: any) => p.kind === "past").map((p: any) => ({ time: p.time, temp: p.temp }));
  const forecast = combined.filter((p: any) => p.kind === "forecast").map((p: any) => ({ time: p.time, temp: p.temp }));

  // Domain / merged axis: build a single joined data array where past & forecast
  // are two columns so we can render both areas.
  const merged = useMemo(() => {
    const map = new Map<string, { time: string; past: number | null; forecast: number | null }>();
    past.forEach((p) => map.set(p.time, { time: p.time, past: p.temp, forecast: null }));
    forecast.forEach((p) => {
      const existing = map.get(p.time);
      if (existing) existing.forecast = p.temp;
      else map.set(p.time, { time: p.time, past: null, forecast: p.temp });
    });
    return Array.from(map.values());
  }, [past, forecast]);

  const forecastStartIdx = merged.findIndex((m) => m.forecast != null);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={merged} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="pastFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.55} />
            <stop offset="100%" stopColor={color} stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="futureFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" />
        <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#64748B" }} stroke="rgba(15,23,42,0.10)" interval="preserveStartEnd" />
        <YAxis unit="°" tick={{ fontSize: 11, fill: "#64748B" }} stroke="rgba(15,23,42,0.10)" domain={["dataMin - 1", "dataMax + 1"]} width={40} />
        <Tooltip
          contentStyle={{
            background: "rgba(255,255,255,0.95)",
            border: "1px solid rgba(14,165,233,0.20)",
            borderRadius: 16,
            boxShadow: "0 8px 32px rgba(14,165,233,0.15)",
            fontSize: 12,
          }}
          formatter={(v: number, name: string) => [`${v.toFixed(1)}°C`, name === "past" ? "Measured" : "Forecast"]}
        />
        {forecastStartIdx > 0 && (
          <ReferenceLine
            x={merged[forecastStartIdx].time}
            stroke="rgba(15,23,42,0.20)"
            strokeDasharray="2 4"
            label={{ value: "now", position: "insideTopRight", fontSize: 10, fill: "#64748B" }}
          />
        )}
        <Area type="monotone" dataKey="past" stroke={color} fill="url(#pastFill)" strokeWidth={2.5} connectNulls={false} />
        <Area type="monotone" dataKey="forecast" stroke={color} strokeDasharray="4 3" fill="url(#futureFill)" strokeWidth={2} connectNulls={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
