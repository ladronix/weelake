"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import maplibregl, { Map, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ArrowUpRight, Map as MapIcon } from "lucide-react";
import { bucketForTemp, formatTemp } from "@/lib/temperature";

interface Lake {
  id: string;
  slug: string;
  name: string;
  lat: number;
  lng: number;
  temp_c: number | null;
  importance: number;
}

/**
 * Interactive preview map on the landing.
 * Non-scrollable, no controls — just eye candy that opens the full map on click.
 */
export function MiniMapPreview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [lakes, setLakes] = useState<Lake[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetch("/api/lakes?limit=200")
      .then((r) => r.json())
      .then((d) => {
        const list = (d.lakes ?? []) as Lake[];
        setLakes(list);
        setTotalCount(d.count ?? list.length);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json",
      center: [12, 50],
      zoom: 3.2,
      interactive: false,
      attributionControl: false,
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !lakes.length) return;

    const paint = () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      lakes.forEach((l) => {
        const bucket = bucketForTemp(l.temp_c);
        const isMajor = (l.importance ?? 0) >= 9;
        const el = document.createElement("div");
        el.style.background = bucket.color;
        el.className = isMajor
          ? "flex items-center justify-center min-w-[30px] h-[22px] px-2 rounded-full text-white text-[10px] font-bold shadow ring-2 ring-white/80 tabular-nums pointer-events-none"
          : "w-2 h-2 rounded-full ring-2 ring-white/80 shadow pointer-events-none";
        if (isMajor) el.textContent = l.temp_c != null ? `${l.temp_c.toFixed(0)}°` : "?";
        const marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([l.lng, l.lat])
          .addTo(map);
        markersRef.current.push(marker);
      });
    };

    if (map.isStyleLoaded()) paint();
    else map.once("load", paint);
  }, [lakes]);

  return (
    <Link
      href="/map"
      className="group relative block rounded-4xl overflow-hidden h-[380px] sm:h-[480px] border border-water-200/40 shadow-[0_20px_60px_rgba(14,165,233,0.15)] hover:shadow-[0_28px_80px_rgba(14,165,233,0.22)] transition-shadow"
    >
      <div ref={containerRef} className="absolute inset-0" />

      {/* Colour-boost overlay for the water theme */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(14,165,233,0.12) 0%, rgba(14,165,233,0.0) 25%, rgba(14,165,233,0.0) 60%, rgba(3,105,161,0.30) 100%)",
        }}
      />

      {/* Header pill */}
      <div className="absolute top-4 left-4 right-4 flex items-start justify-between pointer-events-none">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/85 backdrop-blur-md border border-white/60 px-3 py-1 text-[11px] font-semibold text-water-800 shadow-sm">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          Live temperature map
        </div>
        <div className="inline-flex items-center gap-1 rounded-full bg-white/85 backdrop-blur-md border border-white/60 px-3 py-1 text-[11px] font-semibold text-water-800 shadow-sm">
          <MapIcon className="h-3 w-3" /> {totalCount} lakes
        </div>
      </div>

      {/* CTA bottom */}
      <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3 pointer-events-none">
        <div className="rounded-3xl bg-white/85 backdrop-blur-md border border-white/60 px-4 py-2.5 shadow-sm max-w-[240px]">
          <div className="text-xs text-slate-500">Preview</div>
          <div className="text-sm font-semibold text-deep leading-snug">
            Filter, zoom, discover.
            <br />
            Every lake, live.
          </div>
        </div>
        <div className="pointer-events-auto rounded-full bg-water-500 group-hover:bg-water-600 text-white font-semibold text-sm px-5 py-3 flex items-center gap-1.5 shadow-[0_8px_20px_rgba(14,165,233,0.35)] group-hover:scale-105 transition-all">
          Open the map <ArrowUpRight className="h-4 w-4" />
        </div>
      </div>

      {/* Static sample if map fails */}
      {lakes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-water-100 to-water-200">
          <div className="text-water-700 text-sm">Loading map preview…</div>
        </div>
      )}

      {/* Silent legend */}
      <div className="absolute top-16 right-4 pointer-events-none hidden md:flex items-center gap-1 rounded-full bg-white/85 backdrop-blur-md border border-white/60 px-2.5 py-1 text-[9px] text-slate-600">
        <span>Cold</span>
        <span
          className="h-1.5 w-14 rounded-full"
          style={{
            background:
              "linear-gradient(90deg, #1E3A8A, #3B82F6, #22D3EE, #10B981, #FACC15, #F59E0B, #EF4444, #7C2D12)",
          }}
        />
        <span>Hot</span>
      </div>

      <span className="sr-only">{formatTemp(15)} example — click to open full map</span>
    </Link>
  );
}
