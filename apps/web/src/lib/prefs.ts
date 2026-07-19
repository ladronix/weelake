"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  detectSystemLocale,
  readBrowserLocales,
  type Locale,
} from "./i18n/config";

/**
 * V-Lake · preferences (cookie-free, SSR-safe)
 *
 * SSR contract:
 *  - On the server we render defaults (°C, en) — no navigator, no storage.
 *  - After mount we hydrate from localStorage. If no lang was ever set by
 *    the user, we auto-detect from `navigator.languages` and remember that
 *    with `langSource: "auto"`. An explicit user choice sets
 *    `langSource: "user"` so future system-locale changes won't overwrite it.
 *
 * This module intentionally has no React Context: prefs are a small
 * cross-tree concern and a module-level cache + listener set gives us
 * simpler mental model, cheaper re-renders, and no provider wrapper cost.
 */

export type TempUnit = "C" | "F";
export type Language = Locale;
export type LangSource = "user" | "auto";

interface Prefs {
  unit: TempUnit;
  lang: Language;
  langSource: LangSource;
}

const DEFAULTS: Prefs = { unit: "C", lang: DEFAULT_LOCALE, langSource: "auto" };
const STORAGE_KEY = "vlake-prefs";
const SUPPORTED_SET: ReadonlySet<string> = new Set(SUPPORTED_LOCALES);

let cachedPrefs: Prefs | null = null;
const listeners = new Set<(p: Prefs) => void>();

function coerceLang(value: unknown): Language | null {
  return typeof value === "string" && SUPPORTED_SET.has(value)
    ? (value as Language)
    : null;
}

function readStorage(): Partial<Prefs> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    const out: Partial<Prefs> = {};
    if (parsed.unit === "F" || parsed.unit === "C") out.unit = parsed.unit;
    const lang = coerceLang(parsed.lang);
    if (lang) out.lang = lang;
    if (parsed.langSource === "user" || parsed.langSource === "auto") {
      out.langSource = parsed.langSource;
    }
    return out;
  } catch {
    return {};
  }
}

function writeStorage(p: Prefs) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

/**
 * Resolve initial client-side prefs by merging stored values with
 * system-detected defaults. Pure w.r.t. the two inputs (used by tests).
 */
export function resolveInitialPrefs(
  stored: Partial<Prefs>,
  systemTags: readonly string[],
): Prefs {
  const unit: TempUnit = stored.unit ?? DEFAULTS.unit;
  if (stored.langSource === "user" && stored.lang) {
    return { unit, lang: stored.lang, langSource: "user" };
  }
  const detected = detectSystemLocale(systemTags);
  return { unit, lang: detected, langSource: "auto" };
}

export function usePrefs() {
  // Always start with defaults so SSR + first client render match.
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (cachedPrefs === null) {
      cachedPrefs = resolveInitialPrefs(readStorage(), readBrowserLocales());
      // Persist the auto-detected value so we don't re-detect every session
      // (also gives DevTools a visible record of the state).
      writeStorage(cachedPrefs);
    }
    setPrefs(cachedPrefs);
    setMounted(true);

    const l = (p: Prefs) => setPrefs(p);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const update = useCallback((patch: Partial<Omit<Prefs, "langSource">>) => {
    const current = cachedPrefs ?? DEFAULTS;
    const next: Prefs = {
      ...current,
      ...patch,
      // Any explicit language change marks the source as user-chosen.
      langSource: patch.lang !== undefined ? "user" : current.langSource,
    };
    cachedPrefs = next;
    writeStorage(next);
    listeners.forEach((l) => l(next));
  }, []);

  /** Revert to system-detected language (e.g. Settings → "Use system language"). */
  const resetLangToSystem = useCallback(() => {
    const detected = detectSystemLocale(readBrowserLocales());
    const current = cachedPrefs ?? DEFAULTS;
    const next: Prefs = { ...current, lang: detected, langSource: "auto" };
    cachedPrefs = next;
    writeStorage(next);
    listeners.forEach((l) => l(next));
  }, []);

  return { prefs, update, resetLangToSystem, mounted };
}

/** Convert C to preferred unit for display. */
export function toDisplayTemp(
  celsius: number | null | undefined,
  unit: TempUnit,
): number | null {
  if (celsius === null || celsius === undefined || Number.isNaN(celsius)) return null;
  return unit === "F" ? (celsius * 9) / 5 + 32 : celsius;
}

export function unitSymbol(unit: TempUnit): string {
  return unit === "F" ? "°F" : "°C";
}
