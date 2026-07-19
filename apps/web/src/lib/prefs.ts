"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * V-Lake · preferences
 * Simple localStorage-backed prefs. Cookie-free. SSR-safe.
 *
 * SSR contract: on the server we always render the DEFAULTS (°C, en).
 * After mount we hydrate from localStorage and re-render. Any UI that
 * shows temperatures should therefore first render the celsius value
 * (matching the server) then transition to the user's preference on
 * the second render — no hydration mismatch.
 */

export type TempUnit = "C" | "F";
export type Language = "en" | "cs" | "de";

interface Prefs {
  unit: TempUnit;
  lang: Language;
}

const DEFAULTS: Prefs = { unit: "C", lang: "en" };
const STORAGE_KEY = "vlake-prefs";

let cachedPrefs: Prefs | null = null;
const listeners = new Set<(p: Prefs) => void>();

function readStorage(): Prefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      unit: parsed.unit === "F" ? "F" : "C",
      lang: parsed.lang === "cs" || parsed.lang === "de" ? parsed.lang : "en",
    };
  } catch {
    return DEFAULTS;
  }
}

function writeStorage(p: Prefs) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

export function usePrefs() {
  // Start with defaults on both server AND first client render (mounted=false).
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // After hydration, read from storage and switch to the user's prefs.
    if (cachedPrefs === null) {
      cachedPrefs = readStorage();
    }
    setPrefs(cachedPrefs);
    setMounted(true);

    const l = (p: Prefs) => setPrefs(p);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  const update = useCallback((patch: Partial<Prefs>) => {
    const next = { ...(cachedPrefs ?? DEFAULTS), ...patch };
    cachedPrefs = next;
    writeStorage(next);
    listeners.forEach((l) => l(next));
  }, []);

  return { prefs, update, mounted };
}

/** Convert C to preferred unit for display. */
export function toDisplayTemp(celsius: number | null | undefined, unit: TempUnit): number | null {
  if (celsius === null || celsius === undefined || Number.isNaN(celsius)) return null;
  return unit === "F" ? celsius * 9 / 5 + 32 : celsius;
}

export function unitSymbol(unit: TempUnit): string {
  return unit === "F" ? "°F" : "°C";
}
