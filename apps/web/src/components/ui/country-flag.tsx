"use client";

import { cn } from "@/lib/utils";

interface Props {
  /** ISO 3166-1 alpha-2 country code (e.g. "DE", "CZ", "US"). Case-insensitive. */
  code: string | null | undefined;
  /** Rendered pixel height (width is proportional). Default 16 (matches xs text). */
  height?: number;
  /** Extra Tailwind classes for the wrapping span. */
  className?: string;
  /** Accessible label. Defaults to "flag of {code}". Pass "" for decorative. */
  alt?: string;
}

/**
 * CountryFlag — small SVG flag from flagcdn.com.
 *
 * Source is chosen deliberately: flagcdn ships proper SVGs with
 * permissive CORS + long-lived edge caching. We size the flag with
 * a fixed height (default 16px) so the aspect ratio comes out right
 * without a layout shift.
 *
 * Rendered as a rounded pill with a hairline border so it reads
 * cleanly on both dark (satellite / dark basemap) and light
 * backgrounds — same treatment as our TempPill so they compose
 * visually in a header row.
 */
export function CountryFlag({ code, height = 16, className, alt }: Props) {
  if (!code) return null;
  const cc = code.toLowerCase();
  return (
    <img
      src={`https://flagcdn.com/${cc}.svg`}
      alt={alt ?? `Flag of ${code.toUpperCase()}`}
      role={alt === "" ? "presentation" : "img"}
      className={cn(
        "inline-block rounded-[3px] shadow-sm ring-1 ring-black/10 align-middle",
        className,
      )}
      style={{ height: `${height}px`, width: "auto" }}
      loading="lazy"
      decoding="async"
    />
  );
}
