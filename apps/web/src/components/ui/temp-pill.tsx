import { cn } from "@/lib/utils";
import { bucketForTemp, formatTemp } from "@/lib/temperature";

interface Props {
  temp: number | null | undefined;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showUnit?: boolean;
  className?: string;
  precision?: number;
}

const SIZE = {
  xs: "h-6 min-w-[26px] px-1.5 text-[10px]",
  sm: "h-7 min-w-[32px] px-2 text-[11px]",
  md: "h-9 min-w-[42px] px-2.5 text-sm",
  lg: "h-11 min-w-[52px] px-3 text-base",
  xl: "h-14 min-w-[64px] px-4 text-xl",
};

/**
 * Temperature pill — the atom used everywhere:
 * markers, list rows, hero badges, extremes ranking.
 * Uses windy-inspired color bucket.
 */
export function TempPill({ temp, size = "md", showUnit = false, className, precision = 0 }: Props) {
  const bucket = bucketForTemp(temp);
  const t = temp == null || Number.isNaN(temp) ? null : temp;
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
      {t == null ? "?" : showUnit ? formatTemp(t, precision) : `${t.toFixed(precision)}°`}
    </span>
  );
}
