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
 * Localised plural lookup — appends `_<CLDR category>` to `baseKey`
 * and falls back to `_other`.
 *
 * Example:
 *   translatePlural("cs", "countries.countLake", 2)
 *   → looks up "countries.countLake_few" (Czech "2 jezera")
 *   → falls back to "countries.countLake_other" if missing.
 */
export function translatePlural(
  locale: Locale,
  baseKey: string,
  count: number,
  vars?: Record<string, string | number>,
): string {
  const pr = new Intl.PluralRules(locale);
  const category = pr.select(count);
  const merged = { ...(vars ?? {}), n: count };
  const specific = translate(locale, `${baseKey}_${category}`, merged);
  if (specific !== `${baseKey}_${category}`) return specific;
  return translate(locale, `${baseKey}_other`, merged);
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

/** React hook — returns a plural-aware `p(baseKey, count, vars?)` helper. */
export function useP() {
  const { prefs } = usePrefs();
  return (baseKey: string, count: number, vars?: Record<string, string | number>) =>
    translatePlural(prefs.lang, baseKey, count, vars);
}

export { DEFAULT_LOCALE, SUPPORTED_LOCALES, detectSystemLocale } from "./config";
export type { Locale } from "./config";
