"use client";

import { usePrefs } from "@/lib/prefs";
import { relativeTime } from "@/lib/temperature";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";

/**
 * Client-only wrapper around `relativeTime()` that binds the format to
 * the user's current locale from `usePrefs`. On the server + first render
 * we fall back to DEFAULT_LOCALE ('en') so the SSR output is stable; after
 * hydration the value re-renders in the user's language via Intl.
 */
export function RelativeTime({
  iso,
  format = "raw",
}: {
  iso: string | null | undefined;
  /**
   * - "raw": just the relative-time string ("5 minutes ago").
   * - "prefixUpdated": wrapped with the localised "Updated {ago}" template.
   */
  format?: "raw" | "prefixUpdated";
}) {
  const { prefs, mounted } = usePrefs();
  const locale = mounted ? prefs.lang : DEFAULT_LOCALE;
  const text = relativeTime(iso, locale);
  if (!iso) return null;
  return <>{text}</>;
}
