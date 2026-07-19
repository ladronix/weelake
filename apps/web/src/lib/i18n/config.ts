/**
 * Weelake · i18n locale config
 * Single source of truth for supported locales, default locale,
 * and the pure `detectSystemLocale()` helper (testable, no side-effects).
 */

export const SUPPORTED_LOCALES = ["en", "cs", "de"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

const SUPPORTED_SET: ReadonlySet<string> = new Set(SUPPORTED_LOCALES);

function isSupported(code: string): code is Locale {
  return SUPPORTED_SET.has(code);
}

/**
 * Given an ordered list of BCP-47 tags (e.g. from `navigator.languages`),
 * return the first supported locale, or DEFAULT_LOCALE if none match.
 *
 * Matching strategy:
 *  1. Exact match against the primary subtag (case-insensitive), e.g.
 *     "cs-CZ" -> "cs", "de-AT" -> "de".
 *  2. Falls back to DEFAULT_LOCALE.
 *
 * Pure function — no navigator/window access here so it stays testable
 * in a Node/Vitest environment.
 */
export function detectSystemLocale(tags: readonly string[] | undefined | null): Locale {
  if (!tags || tags.length === 0) return DEFAULT_LOCALE;
  for (const tag of tags) {
    if (!tag || typeof tag !== "string") continue;
    const primary = tag.toLowerCase().split(/[-_]/)[0];
    if (isSupported(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}

/**
 * Read the browser's preferred locales in order.
 * Returns `[]` on the server so callers can decide what to do.
 */
export function readBrowserLocales(): readonly string[] {
  if (typeof navigator === "undefined") return [];
  const list = navigator.languages;
  if (list && list.length > 0) return list;
  return navigator.language ? [navigator.language] : [];
}
