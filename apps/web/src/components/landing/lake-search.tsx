"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, MapPin, Locate, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { bucketForTemp, formatTemp } from "@/lib/temperature";
import { cn } from "@/lib/utils";

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

export function LakeSearch({ autofocus, onSelect, placeholder, compact }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (autofocus && inputRef.current && typeof window !== "undefined" && window.innerWidth > 768) {
      // avoid auto-focus on mobile to prevent keyboard pop
      inputRef.current.focus();
    }
  }, [autofocus]);

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
        } finally {
          setLoading(false);
        }
      },
      () => setLoading(false),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }, []);

  return (
    <div className="relative">
      <div
        className={cn(
          "glass flex items-center gap-2 rounded-full transition-shadow",
          compact ? "px-3 py-2" : "px-4 py-3 sm:py-3.5",
          focused && "shadow-[0_10px_40px_rgba(14,165,233,0.20)] ring-2 ring-water-400/40",
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
          onFocus={() => { setFocused(true); if (query || results.length) setOpen(true); }}
          onBlur={() => { setFocused(false); setTimeout(() => setOpen(false), 150); }}
          placeholder={placeholder ?? "Search a lake, or use your location..."}
          className="flex-1 bg-transparent outline-none placeholder:text-slate-400 text-deep text-base sm:text-lg tabular-nums"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); setResults([]); inputRef.current?.focus(); }}
            className="rounded-full p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100/70 transition"
            aria-label="Clear"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={handleLocate}
          className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-water-500 text-white hover:bg-water-600 transition shadow"
          aria-label="Use my location"
          title="Use my location"
        >
          <Locate className="h-4 w-4" />
        </button>
      </div>

      <AnimatePresence>
        {open && (results.length > 0 || loading) && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 mt-2 z-40 glass rounded-3xl overflow-hidden shadow-2xl"
          >
            <ul className="max-h-[60vh] overflow-y-auto py-2 no-scrollbar">
              {loading && results.length === 0 && (
                <li className="px-4 py-3 text-sm text-slate-500">Searching…</li>
              )}
              {results.map((r) => {
                const bucket = bucketForTemp(r.temp_c);
                return (
                  <li key={r.id}>
                    <Link
                      href={`/lake/${r.slug}`}
                      onClick={() => onSelect?.(r)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-water-100/60 transition"
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
                      <span
                        className="temp-pill text-xs shrink-0"
                        style={{ backgroundColor: bucket.color }}
                        title={bucket.label}
                      >
                        {formatTemp(r.temp_c, 1)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
