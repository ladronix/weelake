"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface Props {
  data: Array<{ time: string; temp: number }>;
  color: string;
}

export function HistoryChart({ data, color }: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.55} />
            <stop offset="100%" stopColor={color} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" />
        <XAxis dataKey="time" tick={{ fontSize: 12, fill: "#64748B" }} stroke="rgba(15,23,42,0.1)" />
        <YAxis unit="°" tick={{ fontSize: 12, fill: "#64748B" }} stroke="rgba(15,23,42,0.1)" domain={["dataMin - 1", "dataMax + 1"]} />
        <Tooltip
          contentStyle={{
            background: "rgba(255,255,255,0.9)",
            border: "1px solid rgba(14,165,233,0.2)",
            borderRadius: 16,
            boxShadow: "0 8px 32px rgba(14,165,233,0.15)",
          }}
          formatter={(v: number) => [`${v.toFixed(1)}°C`, "Water"]}
        />
        <Area type="monotone" dataKey="temp" stroke={color} fill="url(#tempFill)" strokeWidth={2.5} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
