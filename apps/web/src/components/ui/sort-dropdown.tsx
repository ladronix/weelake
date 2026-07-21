"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpDown, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortKey =
  | "importance"
  | "warmest"
  | "coldest"
  | "name"
  | "distance"
  | "area";

export interface SortOption {
  value: SortKey;
  label: string;
  /** Emoji or single char shown before the label. */
  glyph?: string;
}

interface Props {
  value: SortKey;
  onChange: (next: SortKey) => void;
  options: SortOption[];
  /** Compact ("chip"), default ("field") — chip is for the list-header context. */
  variant?: "chip" | "field";
  /** Optional label prefix e.g. "Sort:" — omitted in chip mode by default. */
  labelPrefix?: string;
  className?: string;
}

/**
 * SortDropdown — glass-styled dropdown for choosing a sort order.
 *
 * Two visual variants:
 * - `chip`   — pill-shaped, meant to sit next to a count in a list
 *              header. This is the layout Weelake uses on the map
 *              list panel: "N lakes  |  ⭣ Top".
 * - `field`  — full-width form field, meant for use inside a filter
 *              drawer or settings panel.
 *
 * The component owns its open/close state and closes on outside
 * click. It is a pure controlled component otherwise — pass `value`
 * and `onChange` from the parent.
 *
 * Reuses the same options object shape as the previous inline
 * `<select>` so a caller only needs to hand the list in once,
 * defined near the parent's own `SortKey` type.
 */
export function SortDropdown({
  value, onChange, options, variant = "field", labelPrefix, className,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  const current = options.find((o) => o.value === value) ?? options[0];

  if (variant === "chip") {
    return (
      <div ref={rootRef} className={cn("relative inline-flex", className)}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-water-200/70 bg-white/90 px-2.5 py-1 text-xs font-medium text-deep",
            "hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-water-400",
            open && "ring-2 ring-water-400",
          )}
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          <ArrowUpDown className="h-3.5 w-3.5 text-water-500" aria-hidden="true" />
          {labelPrefix && <span className="text-slate-500">{labelPrefix}</span>}
          {current.glyph && <span aria-hidden="true">{current.glyph}</span>}
          <span>{current.label}</span>
          <ChevronDown className={cn("h-3.5 w-3.5 text-slate-400 transition", open && "rotate-180")} aria-hidden="true" />
        </button>
        {open && (
          <ul
            role="listbox"
            className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-2xl bg-white/95 backdrop-blur-xl shadow-lg border border-white/60 p-1"
          >
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => { onChange(opt.value); setOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs font-medium transition",
                      active ? "bg-water-500 text-white" : "text-slate-700 hover:bg-water-50",
                    )}
                  >
                    {opt.glyph && <span aria-hidden="true">{opt.glyph}</span>}
                    <span className="flex-1">{opt.label}</span>
                    {active && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  // "field" variant — full-width, used inside filter drawers etc.
  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center justify-between gap-2 rounded-full border border-water-200/70 bg-white/90 px-3 py-2 text-sm font-medium text-deep",
          "hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-water-400",
          open && "ring-2 ring-water-400",
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="inline-flex items-center gap-2">
          {current.glyph && <span aria-hidden="true">{current.glyph}</span>}
          {current.label}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-slate-400 transition", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-full mt-1 z-50 w-full rounded-2xl bg-white/95 backdrop-blur-xl shadow-lg border border-white/60 p-1"
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition",
                    active ? "bg-water-500 text-white" : "text-slate-700 hover:bg-water-50",
                  )}
                >
                  {opt.glyph && <span aria-hidden="true">{opt.glyph}</span>}
                  <span className="flex-1">{opt.label}</span>
                  {active && <Check className="h-4 w-4" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
