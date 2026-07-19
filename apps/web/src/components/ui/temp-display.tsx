"use client";

import { usePrefs, toDisplayTemp, unitSymbol } from "@/lib/prefs";

interface Props {
  /** Temperature in °C. Always supplied in celsius; conversion happens here. */
  celsius: number | null | undefined;
  precision?: number;
  className?: string;
  fallback?: string;
  /** If true, do not show the unit suffix. */
  hideUnit?: boolean;
}

/**
 * Client-only display of a temperature value that respects the user's
 * unit preference. Use for large hero numbers, forecast entries, etc.
 * TempPill has the same conversion for its coloured chip variant.
 */
export function TempDisplay({ celsius, precision = 1, className, fallback = "—", hideUnit }: Props) {
  const { prefs } = usePrefs();
  const c = celsius;
  if (c == null || Number.isNaN(c)) return <span className={className}>{fallback}</span>;
  const v = toDisplayTemp(c, prefs.unit);
  return (
    <span className={className}>
      {v!.toFixed(precision)}
      {!hideUnit && unitSymbol(prefs.unit)}
    </span>
  );
}
