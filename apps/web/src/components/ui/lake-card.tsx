import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { TempPill } from "./temp-pill";
import { cn } from "@/lib/utils";

interface LakeCardProps {
  slug: string;
  name: string;
  subtitle?: string;
  temp: number | null | undefined;
  extra?: string;
  size?: "sm" | "md" | "lg";
  onSelect?: () => void;
  as?: "link" | "button";
}

const PADDING = {
  sm: "px-3 py-2 gap-2.5",
  md: "px-4 py-3 gap-3",
  lg: "px-5 py-4 gap-3.5",
};

const PILL_SIZE = {
  sm: "sm",
  md: "md",
  lg: "lg",
} as const;

/**
 * A single lake row — used in map side list, near-you, extremes, nearby, etc.
 */
export function LakeCard({ slug, name, subtitle, temp, extra, size = "md", onSelect, as = "link" }: LakeCardProps) {
  const inner = (
    <>
      <TempPill temp={temp} size={PILL_SIZE[size]} className="!rounded-2xl shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block font-medium text-deep truncate group-hover:text-water-700 transition">
          {name}
        </span>
        {subtitle && (
          <span className="block text-xs text-slate-500 truncate">{subtitle}</span>
        )}
      </span>
      {extra && (
        <span className="text-[11px] text-slate-500 tabular-nums shrink-0">{extra}</span>
      )}
      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-water-500 transition shrink-0" />
    </>
  );

  const cls = cn(
    "group w-full flex items-center hover:bg-water-50/70 transition",
    PADDING[size],
  );

  if (as === "button" || onSelect) {
    return (
      <button type="button" onClick={onSelect} className={cn(cls, "text-left")}>
        {inner}
      </button>
    );
  }

  return (
    <Link href={`/lake/${slug}`} className={cls}>
      {inner}
    </Link>
  );
}
