"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Locate, MapPin, Loader2, ChevronRight } from "lucide-react";
import { bucketForTemp } from "@/lib/temperature";
import { track } from "@/lib/analytics";
import { useT } from "@/lib/i18n";

interface NearbyLake {
  id: string;
  slug: string;
  name: string;
  country_code: string;
  lat: number;
  lng: number;
  temp_c: number | null;
  distance_km: number;
}

export function NearYou() {
  const [state, setState] = useState<"idle" | "asking" | "loading" | "loaded" | "denied" | "unsupported">("idle");
  const [lakes, setLakes] = useState<NearbyLake[]>([]);
  const [locName, setLocName] = useState<string | null>(null);
  const t = useT();

  const findNearby = () => {
    if (!("geolocation" in navigator)) {
      setState("unsupported");
      return;
    }
    track("landing.nearby");
    setState("asking");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setState("loading");
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(`/api/search?lat=${latitude}&lng=${longitude}&limit=6`);
          const data = await res.json();
          setLakes(data.results ?? []);
          // Best-effort reverse geocode via Open-Meteo geocoding (free, no key).
          try {
            const rev = await fetch(
              `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&count=1&language=en&format=json`,
            );
            const revJson = await rev.json();
            const place = revJson?.results?.[0];
            if (place) setLocName(`${place.name}${place.admin1 ? ", " + place.admin1 : ""}`);
          } catch { /* ignore */ }
          setState("loaded");
        } catch {
          setState("loaded");
        }
      },
      () => setState("denied"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  };

  // Auto-attempt only if the URL has ?locate=1 (deep-link from PWA shortcut).
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("locate") === "1") {
      findNearby();
    }
  }, []);

  return (
    <div className="rounded-4xl bg-white/70 backdrop-blur-md border border-white/60 shadow-[0_8px_30px_rgba(14,165,233,0.08)] overflow-hidden">
      <div className="px-5 sm:px-7 pt-5 pb-4 flex items-start gap-3">
        <div className="inline-flex items-center justify-center h-10 w-10 rounded-2xl bg-gradient-to-br from-water-400 to-water-600 shadow-md">
          <MapPin className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-base font-semibold text-deep">{t("near.title")}</div>
          <div className="text-xs text-slate-500">
            {state === "loaded" && locName
              ? t("near.around", { place: locName })
              : t("near.subtitle")}
          </div>
        </div>
        {state !== "loaded" && (
          <button
            onClick={findNearby}
            disabled={state === "asking" || state === "loading"}
            className="inline-flex items-center gap-1.5 rounded-full bg-water-500 hover:bg-water-600 disabled:opacity-70 text-white text-sm font-medium py-2 px-3.5 shadow-[0_4px_16px_rgba(14,165,233,0.35)] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-water-500 focus-visible:ring-offset-2"
          >
            {state === "asking" || state === "loading"
              ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              : <Locate className="h-4 w-4" aria-hidden="true" />}
            {t("near.find")}
          </button>
        )}
      </div>

      {(state === "loaded") && lakes.length === 0 && (
        <div className="px-6 py-6 text-sm text-slate-500 text-center border-t border-water-100/50">
          {t("near.empty")}
        </div>
      )}

      {(state === "loaded") && lakes.length > 0 && (
        <ul className="divide-y divide-water-100/50 border-t border-water-100/50">
          {lakes.map((l) => {
            const b = bucketForTemp(l.temp_c);
            return (
              <li key={l.id}>
                <Link
                  href={`/lake/${l.slug}`}
                  className="group flex items-center gap-3 px-5 sm:px-7 py-3 hover:bg-water-50/70 transition"
                >
                  <span
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-white text-sm font-bold shadow-sm tabular-nums shrink-0"
                    style={{ backgroundColor: b.color }}
                  >
                    {l.temp_c != null ? `${l.temp_c.toFixed(0)}°` : "?"}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium text-deep truncate group-hover:text-water-700 transition">
                      {l.name}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {l.country_code} · {t("near.kmAway", { km: l.distance_km.toFixed(0) })}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-water-500 transition shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {state === "denied" && (
        <div className="px-5 sm:px-7 pb-5 text-xs text-slate-500 border-t border-water-100/50 pt-4">
          {t("near.denied")}
        </div>
      )}
      {state === "unsupported" && (
        <div className="px-5 sm:px-7 pb-5 text-xs text-slate-500 border-t border-water-100/50 pt-4">
          {t("near.unsupported")}
        </div>
      )}
    </div>
  );
}
