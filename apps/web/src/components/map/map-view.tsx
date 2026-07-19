"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import maplibregl, { Map, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Layers, Locate, Minus, Plus, X, Search,
  Thermometer, Waves, Filter, ChevronRight, ChevronLeft,
  Sparkles, Navigation2, Share2,
} from "lucide-react";
import { bucketForTemp, formatTemp, relativeTime } from "@/lib/temperature";
import { cn } from "@/lib/utils";

interface LakeMarker {
  id: string;
  slug: string;
  name: string;
  name_local: string | null;
  country_code: string;
  lat: number;
  lng: number;
  area_km2: number | null;
  type: string;
  importance: number;
  temp_c: number | null;
  measured_at: string | null;
  source: string | null;
}

type BasemapKey = "positron" | "voyager" | "dark" | "satellite";

const BASEMAPS: Record<BasemapKey, { label: string; style: string; short: string }> = {
  positron:  { label: "Light",     short: "Light",  style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json" },
  voyager:   { label: "Voyager",   short: "Std",    style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json" },
  dark:      { label: "Dark",      short: "Dark",   style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json" },
  satellite: { label: "Satellite", short: "Sat",    style: {
    version: 8,
    sources: {
      esri: {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        attribution:
          "Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
      },
    },
    layers: [{ id: "esri", type: "raster", source: "esri" }],
  } as unknown as string },
};

export function MapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [lakes, setLakes] = useState<LakeMarker[]>([]);
  const [selected, setSelected] = useState<LakeMarker | null>(null);
  const [showList, setShowList] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [basemap, setBasemap] = useState<BasemapKey>("positron");
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [tempRange, setTempRange] = useState<[number, number]>([-5, 35]);
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"warmest" | "coldest" | "name" | "importance">("importance");
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);

  // Fetch lakes once.
  useEffect(() => {
    fetch("/api/lakes?limit=5000")
      .then((r) => r.json())
      .then((d) => setLakes(d.lakes ?? []));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = lakes.filter((l) => {
      if (countryFilter !== "all" && l.country_code !== countryFilter) return false;
      if (typeFilter !== "all" && l.type !== typeFilter) return false;
      if (l.temp_c != null) {
        if (l.temp_c < tempRange[0] || l.temp_c > tempRange[1]) return false;
      }
      if (q) {
        const hay = `${l.name} ${l.name_local ?? ""} ${l.country_code}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    switch (sortBy) {
      case "warmest": arr = arr.slice().sort((a, b) => (b.temp_c ?? -999) - (a.temp_c ?? -999)); break;
      case "coldest": arr = arr.slice().sort((a, b) => (a.temp_c ??  999) - (b.temp_c ??  999)); break;
      case "name":    arr = arr.slice().sort((a, b) => a.name.localeCompare(b.name)); break;
      case "importance":
      default:        arr = arr.slice().sort((a, b) => b.importance - a.importance); break;
    }
    return arr;
  }, [lakes, countryFilter, typeFilter, tempRange, query, sortBy]);

  const countries = useMemo(
    () => Array.from(new Set(lakes.map((l) => l.country_code))).sort(),
    [lakes],
  );

  // Init map.
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: BASEMAPS[basemap].style,
      center: [14, 49],
      zoom: 4.2,
      attributionControl: false,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch basemap while preserving camera + layers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const style = BASEMAPS[basemap].style;
    map.setStyle(style as never);
  }, [basemap]);

  // Add / update markers + heatmap layer.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let cancelled = false;

    const doUpdate = () => {
      if (cancelled) return;
      // clean existing markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const features = filtered
        .filter((l) => l.temp_c != null)
        .map((l) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [l.lng, l.lat] },
          properties: { temp: l.temp_c as number, id: l.id },
        }));

      const fc = { type: "FeatureCollection" as const, features };

      const src = map.getSource("lake-temps") as maplibregl.GeoJSONSource | undefined;
      if (src) {
        src.setData(fc);
      } else {
        map.addSource("lake-temps", { type: "geojson", data: fc });

        map.addLayer({
          id: "lake-heatmap",
          type: "heatmap",
          source: "lake-temps",
          maxzoom: 9,
          paint: {
            "heatmap-weight": ["interpolate", ["linear"], ["get", "temp"], 0, 0.2, 15, 0.4, 22, 0.8, 30, 1],
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 0.6, 9, 3],
            "heatmap-color": [
              "interpolate", ["linear"], ["heatmap-density"],
              0,   "rgba(30, 58, 138, 0)",
              0.2, "rgba(59, 130, 246, 0.5)",
              0.4, "rgba(34, 211, 238, 0.6)",
              0.6, "rgba(250, 204, 21, 0.7)",
              0.8, "rgba(239, 68, 68, 0.85)",
              1,   "rgba(124, 45, 18, 0.9)",
            ],
            "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 12, 4, 30, 9, 60],
            "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 7, 0.9, 9, 0.35],
          },
        });
      }
      if (map.getLayer("lake-heatmap")) {
        map.setLayoutProperty("lake-heatmap", "visibility", showHeatmap ? "visible" : "none");
      }

      filtered.forEach((l) => {
        const bucket = bucketForTemp(l.temp_c);
        const el = document.createElement("button");
        el.type = "button";
        el.setAttribute("aria-label", `${l.name} · ${formatTemp(l.temp_c)}`);
        el.style.background = bucket.color;
        el.className =
          "flex items-center justify-center min-w-[38px] h-[28px] px-2.5 rounded-full text-white text-[11.5px] font-bold shadow-[0_2px_8px_rgba(0,0,0,0.25)] ring-2 ring-white hover:scale-125 hover:z-10 transition-transform duration-150 tabular-nums cursor-pointer";
        el.textContent = l.temp_c != null ? `${l.temp_c.toFixed(0)}°` : "?";
        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          setSelected(l);
          map.easeTo({ center: [l.lng, l.lat], zoom: Math.max(map.getZoom(), 7), duration: 700 });
        });

        const marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([l.lng, l.lat])
          .addTo(map);
        markersRef.current.push(marker);
      });
    };

    if (map.isStyleLoaded()) {
      doUpdate();
    } else {
      map.once("load", doUpdate);
    }
    // React to future style reloads (basemap swap).
    const onStyleData = () => { if (map.isStyleLoaded()) doUpdate(); };
    map.on("styledata", onStyleData);

    return () => {
      cancelled = true;
      map.off("styledata", onStyleData);
    };
  }, [filtered, showHeatmap, basemap]);

  const doLocate = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const c = { lat: p.coords.latitude, lng: p.coords.longitude };
        setUserLoc(c);
        mapRef.current?.easeTo({ center: [c.lng, c.lat], zoom: 8, duration: 900 });
      },
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }, []);

  // Draw / update user location dot.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLoc) return;
    const src = map.getSource("user-loc") as maplibregl.GeoJSONSource | undefined;
    const data = {
      type: "FeatureCollection" as const,
      features: [{ type: "Feature" as const, geometry: { type: "Point" as const, coordinates: [userLoc.lng, userLoc.lat] }, properties: {} }],
    };
    if (src) src.setData(data);
    else if (map.isStyleLoaded()) {
      map.addSource("user-loc", { type: "geojson", data });
      map.addLayer({
        id: "user-loc-halo",
        type: "circle",
        source: "user-loc",
        paint: {
          "circle-radius": 22,
          "circle-color": "#0EA5E9",
          "circle-opacity": 0.15,
        },
      });
      map.addLayer({
        id: "user-loc-dot",
        type: "circle",
        source: "user-loc",
        paint: {
          "circle-radius": 6,
          "circle-color": "#0EA5E9",
          "circle-stroke-color": "#FFFFFF",
          "circle-stroke-width": 2,
        },
      });
    }
  }, [userLoc, basemap]);

  const zoom = (delta: number) => {
    const m = mapRef.current;
    if (!m) return;
    m.easeTo({ zoom: m.getZoom() + delta, duration: 200 });
  };

  const centerWorld = () => {
    mapRef.current?.easeTo({ center: [14, 49], zoom: 4.2, duration: 800 });
  };

  const types = useMemo(
    () => Array.from(new Set(lakes.map((l) => l.type))).sort(),
    [lakes],
  );

  return (
    <div className="relative h-full w-full flex overflow-hidden bg-water-50 min-h-0">
      {/* Side list (desktop) */}
      <aside
        className={cn(
          "hidden md:flex flex-col w-[340px] lg:w-[380px] h-full bg-white/80 backdrop-blur-xl border-r border-white/60 shadow-[0_0_40px_rgba(14,165,233,0.08)] z-20",
          !showList && "md:hidden",
        )}
      >
        <div className="p-4 border-b border-water-100/70 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-water-500 pointer-events-none" />
            <input
              type="search"
              inputMode="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search lakes…"
              className="w-full rounded-full border border-water-200/70 bg-white/90 pl-9 pr-9 py-2.5 text-sm outline-none focus:ring-2 focus:ring-water-400 focus:border-water-400 transition"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Counters row */}
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full bg-water-100 text-water-700 px-2.5 py-1 font-medium">
              {filtered.length} lakes
            </span>
            {countryFilter !== "all" && (
              <button
                onClick={() => setCountryFilter("all")}
                className="rounded-full bg-slate-100 text-slate-700 px-2.5 py-1 font-medium hover:bg-slate-200 transition"
              >
                {countryFilter} ×
              </button>
            )}
            {typeFilter !== "all" && (
              <button
                onClick={() => setTypeFilter("all")}
                className="rounded-full bg-slate-100 text-slate-700 px-2.5 py-1 font-medium hover:bg-slate-200 transition"
              >
                {typeFilter} ×
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="block">
              <span className="text-slate-500">Country</span>
              <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                className="mt-1 w-full rounded-full border border-water-200/70 bg-white/90 px-3 py-1.5 outline-none focus:ring-2 focus:ring-water-400"
              >
                <option value="all">All</option>
                {countries.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-slate-500">Type</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="mt-1 w-full rounded-full border border-water-200/70 bg-white/90 px-3 py-1.5 outline-none focus:ring-2 focus:ring-water-400"
              >
                <option value="all">All</option>
                {types.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>

          <label className="block text-xs">
            <span className="text-slate-500">
              Temperature: <b className="tabular-nums text-slate-700">{tempRange[0]}°C</b> to <b className="tabular-nums text-slate-700">{tempRange[1]}°C</b>
            </span>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="range" min={-5} max={35} step={1}
                value={tempRange[0]}
                onChange={(e) => setTempRange([Math.min(parseInt(e.target.value), tempRange[1] - 1), tempRange[1]])}
                className="flex-1 accent-water-500"
              />
              <input
                type="range" min={-5} max={35} step={1}
                value={tempRange[1]}
                onChange={(e) => setTempRange([tempRange[0], Math.max(parseInt(e.target.value), tempRange[0] + 1)])}
                className="flex-1 accent-water-500"
              />
            </div>
          </label>

          {/* Sort */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500">Sort:</span>
            {(["importance", "warmest", "coldest", "name"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={cn(
                  "rounded-full px-2.5 py-1 font-medium transition",
                  sortBy === s
                    ? "bg-water-500 text-white shadow"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                )}
              >
                {s === "importance" ? "Top" : s[0].toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <ul className="flex-1 overflow-y-auto divide-y divide-water-100/50 no-scrollbar">
          {filtered.length === 0 && (
            <li className="p-6 text-sm text-slate-500 text-center">
              No lakes match your filters.
            </li>
          )}
          {filtered.slice(0, 500).map((l) => {
            const bucket = bucketForTemp(l.temp_c);
            return (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(l);
                    mapRef.current?.easeTo({ center: [l.lng, l.lat], zoom: 9, duration: 700 });
                  }}
                  className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-water-50/80 transition"
                >
                  <span
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-white text-sm font-bold shadow-[0_2px_8px_rgba(0,0,0,0.15)] tabular-nums shrink-0"
                    style={{ backgroundColor: bucket.color }}
                  >
                    {l.temp_c != null ? `${l.temp_c.toFixed(0)}°` : "?"}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium text-deep truncate">{l.name}</span>
                    <span className="block text-xs text-slate-500 truncate">
                      {l.country_code} · {l.type}
                      {l.area_km2 && ` · ${Number(l.area_km2).toFixed(1)} km²`}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Map canvas + overlays */}
      <div className="relative flex-1 h-full min-h-0">
        <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

        {/* Toggle side list */}
        <button
          onClick={() => setShowList((v) => !v)}
          className={cn(
            "hidden md:flex absolute top-4 z-30 items-center justify-center h-10 w-10 rounded-full bg-white/95 backdrop-blur shadow-lg text-water-700 hover:bg-white transition",
            showList ? "left-4" : "left-4",
          )}
          aria-label={showList ? "Hide list" : "Show list"}
          title={showList ? "Hide list" : "Show list"}
        >
          {showList ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </button>

        {/* Mobile search + filter */}
        <div className="md:hidden absolute top-3 left-3 right-3 z-30 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-water-500 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-full bg-white/95 backdrop-blur pl-9 pr-3 py-2.5 text-sm outline-none shadow-lg border border-white/60"
            />
          </div>
          <button
            onClick={() => setShowList(true)}
            className="h-10 w-10 rounded-full bg-white/95 backdrop-blur shadow-lg flex items-center justify-center text-water-700"
            aria-label="Open list"
          >
            <Filter className="h-4 w-4" />
          </button>
        </div>

        {/* Right-side controls stack */}
        <div className="absolute top-4 right-4 z-30 flex flex-col gap-2 items-end">
          {/* Layer picker */}
          <div className="relative">
            <button
              onClick={() => setShowLayerMenu((v) => !v)}
              className="h-10 w-10 rounded-full bg-white/95 backdrop-blur shadow-lg text-water-700 hover:bg-white transition flex items-center justify-center"
              aria-label="Layers"
              title="Map style & layers"
            >
              <Layers className="h-5 w-5" />
            </button>
            {showLayerMenu && (
              <div className="absolute right-0 top-12 w-56 rounded-3xl bg-white/95 backdrop-blur-xl shadow-[0_10px_40px_rgba(14,165,233,0.20)] border border-white/60 p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 px-1">Basemap</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(Object.keys(BASEMAPS) as BasemapKey[]).map((k) => (
                    <button
                      key={k}
                      onClick={() => { setBasemap(k); }}
                      className={cn(
                        "rounded-2xl px-3 py-2 text-xs font-medium transition text-left",
                        basemap === k
                          ? "bg-water-500 text-white shadow"
                          : "bg-water-50 text-slate-700 hover:bg-water-100",
                      )}
                    >
                      {BASEMAPS[k].label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 text-[10px] uppercase tracking-wider text-slate-500 mb-2 px-1">Layers</div>
                <label className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-2xl hover:bg-water-50 cursor-pointer">
                  <span className="flex items-center gap-2 text-sm text-slate-700">
                    <Thermometer className="h-4 w-4 text-temp-hot" /> Heatmap
                  </span>
                  <span className={cn(
                    "relative inline-flex h-5 w-9 items-center rounded-full transition",
                    showHeatmap ? "bg-water-500" : "bg-slate-300",
                  )}>
                    <span className={cn(
                      "inline-block h-4 w-4 rounded-full bg-white shadow transform transition",
                      showHeatmap ? "translate-x-4" : "translate-x-0.5",
                    )} />
                  </span>
                  <input type="checkbox" checked={showHeatmap} onChange={() => setShowHeatmap((v) => !v)} className="sr-only" />
                </label>
              </div>
            )}
          </div>

          {/* Zoom buttons */}
          <div className="flex flex-col rounded-full bg-white/95 backdrop-blur shadow-lg overflow-hidden">
            <button
              onClick={() => zoom(1)}
              className="h-10 w-10 flex items-center justify-center text-water-700 hover:bg-water-50 transition border-b border-water-100"
              aria-label="Zoom in"
            >
              <Plus className="h-5 w-5" />
            </button>
            <button
              onClick={() => zoom(-1)}
              className="h-10 w-10 flex items-center justify-center text-water-700 hover:bg-water-50 transition"
              aria-label="Zoom out"
            >
              <Minus className="h-5 w-5" />
            </button>
          </div>

          {/* Locate */}
          <button
            onClick={doLocate}
            className="h-10 w-10 rounded-full bg-water-500 hover:bg-water-600 text-white shadow-[0_4px_16px_rgba(14,165,233,0.35)] transition flex items-center justify-center"
            aria-label="Find my location"
            title="Find my location"
          >
            <Locate className="h-5 w-5" />
          </button>

          {/* World */}
          <button
            onClick={centerWorld}
            className="h-10 w-10 rounded-full bg-white/95 backdrop-blur shadow-lg text-water-700 hover:bg-white transition flex items-center justify-center"
            aria-label="Reset view"
            title="Reset view"
          >
            <Navigation2 className="h-4 w-4" />
          </button>
        </div>

        {/* Bottom-center temperature legend */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 rounded-full bg-white/95 backdrop-blur shadow-lg pl-3 pr-4 py-2 flex items-center gap-2 text-[11px] font-medium text-slate-700">
          <Waves className="h-3.5 w-3.5 text-water-600" />
          <span className="tabular-nums">-5°</span>
          <span
            className="h-2 w-40 rounded-full"
            style={{
              background: "linear-gradient(90deg, #1E3A8A, #3B82F6, #22D3EE, #10B981, #FACC15, #F59E0B, #EF4444, #7C2D12)",
            }}
          />
          <span className="tabular-nums">35°</span>
        </div>

        {/* Bottom sheet / side card for selected lake */}
        {selected && <SelectedSheet lake={selected} onClose={() => setSelected(null)} />}
      </div>
    </div>
  );
}

function SelectedSheet({ lake, onClose }: { lake: LakeMarker; onClose: () => void }) {
  const bucket = bucketForTemp(lake.temp_c);
  return (
    <div className="absolute left-3 right-3 bottom-3 sm:left-auto sm:right-4 sm:bottom-4 sm:w-[380px] z-40 rounded-4xl overflow-hidden bg-white/95 backdrop-blur-xl shadow-[0_20px_60px_rgba(14,165,233,0.25)] border border-white/60 safe-b">
      <div
        className="relative px-5 pt-5 pb-4 text-white"
        style={{ background: `linear-gradient(135deg, ${bucket.color}, #0369A1)` }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 rounded-full p-1.5 bg-white/20 hover:bg-white/30 text-white transition"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="text-[10px] uppercase tracking-wider opacity-90">
          {lake.country_code} · {lake.type}
        </div>
        <div className="mt-1 text-xl font-semibold leading-tight">{lake.name}</div>
        {lake.name_local && lake.name_local !== lake.name && (
          <div className="text-xs opacity-90">{lake.name_local}</div>
        )}
        <div className="mt-4 flex items-end gap-4">
          <div className="text-5xl font-semibold tabular-nums leading-none">{formatTemp(lake.temp_c, 1)}</div>
          <div className="text-xs opacity-90 pb-1">
            <div className="font-semibold">{bucket.label}</div>
            <div>{lake.measured_at ? `Updated ${relativeTime(lake.measured_at)}` : "No recent data"}</div>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 grid grid-cols-2 gap-2">
        <Link
          href={`/lake/${lake.slug}`}
          className="rounded-full bg-water-500 hover:bg-water-600 text-white font-medium py-2.5 text-sm flex items-center justify-center gap-1.5 shadow-[0_4px_16px_rgba(14,165,233,0.35)] transition"
        >
          <Sparkles className="h-4 w-4" /> Details
        </Link>
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${lake.lat},${lake.lng}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-water-50 hover:bg-water-100 text-water-800 font-medium py-2.5 text-sm flex items-center justify-center gap-1.5 transition"
        >
          <Navigation2 className="h-4 w-4" /> Navigate
        </a>
      </div>
    </div>
  );
}
