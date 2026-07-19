"use client";

import { usePrefs } from "@/lib/prefs";
import { DEFAULT_LOCALE, type Locale } from "./config";
import en from "./locales/en.json";
import cs from "./locales/cs.json";
import de from "./locales/de.json";

/**
 * V-Lake · lightweight i18n
 *
 * Dictionary lookup with `{placeholder}` substitution and English fallback.
 * Uses JSON files per locale — smaller diffs, easier for translators, still
 * bundled statically (no dynamic import cost on first paint).
 */

type Dict = Record<string, string>;

const DICTS: Record<Locale, Dict> = {
  en: en as Dict,
  cs: cs as Dict,
  de: de as Dict,
};

/** Look up `key` in the target dictionary, falling back to English then the key itself. */
export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const dict = DICTS[locale] ?? DICTS[DEFAULT_LOCALE];
  const raw = dict[key] ?? DICTS[DEFAULT_LOCALE][key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

/**
 * React hook — returns a `t(key, vars?)` function bound to the user's
 * current locale (via `usePrefs`).
 */
export function useT() {
  const { prefs } = usePrefs();
  return (key: string, vars?: Record<string, string | number>) =>
    translate(prefs.lang, key, vars);
}

export { DEFAULT_LOCALE, SUPPORTED_LOCALES, detectSystemLocale } from "./config";
export type { Locale } from "./config";
