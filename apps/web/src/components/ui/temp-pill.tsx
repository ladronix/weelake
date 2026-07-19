"use client";

import { cn } from "@/lib/utils";
import { bucketForTemp } from "@/lib/temperature";
import { usePrefs, toDisplayTemp, unitSymbol } from "@/lib/prefs";

interface Props {
  temp: number | null | undefined;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showUnit?: boolean;
  className?: string;
  precision?: number;
  /** Skip unit conversion (component used in a context where the number is already unit-adjusted). */
  raw?: boolean;
}

const SIZE = {
  xs: "h-6 min-w-[26px] px-1.5 text-[10px]",
  sm: "h-7 min-w-[32px] px-2 text-[11px]",
  md: "h-9 min-w-[42px] px-2.5 text-sm",
  lg: "h-11 min-w-[52px] px-3 text-base",
  xl: "h-14 min-w-[64px] px-4 text-xl",
};

/**
 * Temperature pill — the atom used everywhere.
 * Reads the user's unit preference and converts input (always in °C) to display.
 * Bucket colour is always computed from the underlying °C value so the
 * visual palette stays stable across units.
 */
export function TempPill({ temp, size = "md", showUnit = false, className, precision = 0, raw }: Props) {
  const { prefs } = usePrefs();
  const c = temp == null || Number.isNaN(temp) ? null : temp;
  const bucket = bucketForTemp(c); // colour by Celsius, always

  const displayValue = raw
    ? c
    : (c != null ? toDisplayTemp(c, prefs.unit) : null);

  const label = displayValue == null
    ? "?"
    : showUnit
      ? `${displayValue.toFixed(precision)}${unitSymbol(prefs.unit)}`
      : `${displayValue.toFixed(precision)}°`;

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-bold text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] tabular-nums",
        SIZE[size],
        className,
      )}
      style={{ backgroundColor: bucket.color }}
      title={bucket.label}
    >
      {label}
    </span>
  );
}
