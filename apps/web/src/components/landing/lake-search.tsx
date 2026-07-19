"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, MapPin, Locate, X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { TempPill } from "@/components/ui";
import { useT } from "@/lib/i18n";

interface SearchResult {
  id: string;
  slug: string;
  name: string;
  name_local: string | null;
  country_code: string;
  country_emoji?: string;
  lat: number;
  lng: number;
  temp_c: number | null;
  photo_url?: string | null;
  distance_km?: number | null;
}

interface Props {
  autofocus?: boolean;
  onSelect?: (r: SearchResult) => void;
  placeholder?: string;
  compact?: boolean;
}

/**
 * Weelake · fulltext search
 *
 * Keyboard:
 *   ↓ / ↑    move highlight
 *   Enter    open highlighted result (or first result)
 *   Escape   close dropdown / clear query
 *   /        (elsewhere on page) focus this input
 */
export function LakeSearch({ autofocus, onSelect, placeholder, compact }: Props) {
  const router = useRouter();
  const t = useT();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  /** Featured lakes shown when the user focuses the input with an empty
   *  query — gives them a preview of what's in the database without them
   *  having to type. Preloaded once on mount from /api/search?featured=1. */
  const [featured, setFeatured] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (autofocus && inputRef.current && typeof window !== "undefined" && window.innerWidth > 768) {
      inputRef.current.focus();
    }
  }, [autofocus]);

  // Global "/" shortcut to focus search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=8`);
      if (!res.ok) throw new Error("search failed");
      const data = await res.json();
      setResults(data.results ?? []);
      setHighlighted(0);
    } catch (err) {
      console.error(err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 180);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  // Preload a small featured-lakes list once so the suggestion dropdown
  // has something to show on the very first focus (empty query).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/search?featured=1&limit=6")
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((d) => {
        if (!cancelled) setFeatured(d.results ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) return;
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(`/api/search?lat=${latitude}&lng=${longitude}&limit=8`);
          const data = await res.json();
          setResults(data.results ?? []);
          setOpen(true);
          setHighlighted(0);
        } finally {
          setLoading(false);
        }
      },
      () => setLoading(false),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }, []);

  const openResult = useCallback((r: SearchResult) => {
    onSelect?.(r);
    router.push(`/lake/${r.slug}`);
    setOpen(false);
  }, [onSelect, router]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (query) {
        setQuery("");
        setResults([]);
      } else {
        inputRef.current?.blur();
        setOpen(false);
      }
      return;
    }
    if (!open || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = results[highlighted] ?? results[0];
      if (target) openResult(target);
    }
  };

  // Ensure highlighted row is scrolled into view.
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelectorAll<HTMLElement>("[data-search-row]")[highlighted];
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  return (
    <div className="relative">
      <div
        className={cn(
          "flex items-center gap-2 rounded-full transition-all border",
          "bg-white/85 backdrop-blur-xl shadow-[0_8px_30px_rgba(14,165,233,0.10)] border-white/60",
          compact ? "px-3 py-2" : "px-4 py-3 sm:py-3.5",
          focused && "shadow-[0_10px_40px_rgba(14,165,233,0.25)] ring-2 ring-water-400/50 border-water-300/50",
        )}
      >
        <Search className="h-5 w-5 text-water-600 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { setFocused(true); setOpen(true); }}
          onBlur={() => { setFocused(false); setTimeout(() => setOpen(false), 150); }}
          onKeyDown={onKeyDown}
          placeholder={placeholder ?? t("search.placeholder")}
          className="flex-1 bg-transparent outline-none placeholder:text-slate-400 text-deep text-base sm:text-lg min-w-0"
          aria-label={t("search.aria")}
          aria-autocomplete="list"
          aria-controls="search-results"
          role="combobox"
          // eslint-disable-next-line jsx-a11y/role-supports-aria-props
          aria-expanded={open}
        />
        {loading && <Loader2 className="h-4 w-4 text-water-500 animate-spin shrink-0" aria-hidden="true" />}
        {query && !loading && (
          <button
            type="button"
            onClick={() => { setQuery(""); setResults([]); inputRef.current?.focus(); }}
            className="rounded-full p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100/70 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-water-500"
            aria-label={t("search.clear")}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={handleLocate}
          className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-water-500 text-white hover:bg-water-600 transition shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-water-500 focus-visible:ring-offset-2"
          aria-label={t("search.locate")}
          title={t("search.locate")}
        >
          <Locate className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <AnimatePresence>
        {open && (results.length > 0 || (loading && query) || (!query && featured.length > 0)) && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 mt-2 z-40 rounded-3xl overflow-hidden shadow-2xl bg-white/95 backdrop-blur-xl border border-white/60"
            id="search-results"
            role="listbox"
          >
            <ul ref={listRef} className="max-h-[60vh] overflow-y-auto py-2 no-scrollbar">
              {!query && featured.length > 0 && (
                <li className="px-4 pt-1 pb-2 text-[10px] uppercase tracking-wider text-slate-500 font-semibold pointer-events-none">
                  {t("search.suggestedHeading")}
                </li>
              )}
              {loading && results.length === 0 && query && (
                <li className="px-4 py-3 text-sm text-slate-500">{t("search.searching")}</li>
              )}
              {/* Show real results when we have a query, otherwise the featured
                  fallback so the dropdown is never empty on focus. */}
              {(query ? results : featured).map((r, i) => (
                <li key={r.id} role="option" aria-selected={i === highlighted} data-search-row>
                  <Link
                    href={`/lake/${r.slug}`}
                    onClick={() => onSelect?.(r)}
                    onMouseEnter={() => setHighlighted(i)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 transition",
                      i === highlighted ? "bg-water-100/70" : "hover:bg-water-50/60",
                    )}
                  >
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl bg-water-100 flex items-center justify-center">
                      {r.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.photo_url} alt={r.name} className="h-full w-full object-cover" />
                      ) : (
                        <MapPin className="h-5 w-5 text-water-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-deep truncate">{r.name}</span>
                        <span className="text-xs text-slate-500 shrink-0">{r.country_code}</span>
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {r.name_local && r.name_local !== r.name ? r.name_local : `${r.lat.toFixed(2)}, ${r.lng.toFixed(2)}`}
                        {r.distance_km != null && ` · ${r.distance_km.toFixed(0)} km`}
                      </div>
                    </div>
                    <TempPill temp={r.temp_c} size="sm" precision={1} />
                  </Link>
                </li>
              ))}
              {!loading && query && results.length === 0 && (
                <li className="px-4 py-6 text-sm text-slate-500 text-center">
                  No lakes match &quot;{query}&quot;
                </li>
              )}
            </ul>
            <div className="border-t border-water-100/60 px-4 py-2 flex items-center justify-between text-[10px] text-slate-400">
              <span>
                <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">↑↓</kbd>{" "}
                move ·{" "}
                <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">↵</kbd>{" "}
                open ·{" "}
                <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">esc</kbd>{" "}
                close
              </span>
              <span>{results.length} results</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
