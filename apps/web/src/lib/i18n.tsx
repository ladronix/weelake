/**
 * Compat shim — the real implementation now lives in `./i18n/index.tsx`.
 * Kept as a barrel so existing imports (`@/lib/i18n`) continue to work.
 */
export { useT, translate, DEFAULT_LOCALE, SUPPORTED_LOCALES, detectSystemLocale } from "./i18n/index";
export type { Locale } from "./i18n/index";
