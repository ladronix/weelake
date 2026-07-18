"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import maplibregl, { Map, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Filter, Layers, Locate, X } from "lucide-react";
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

const DEFAULT_STYLE =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"; // free, water-friendly

export function MapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [lakes, setLakes] = useState<LakeMarker[]>([]);
  const [selected, setSelected] = useState<LakeMarker | null>(null);
  const [showList, setShowList] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [tempRange, setTempRange] = useState<[number, number]>([-5, 35]);
  const [countryFilter, setCountryFilter] = useState<string>("all");

  // Fetch lakes once.
  useEffect(() => {
    fetch("/api/lakes?limit=5000")
      .then((r) => r.json())
      .then((d) => setLakes(d.lakes ?? []));
  }, []);

  const filtered = useMemo(() => {
    return lakes.filter((l) => {
      if (countryFilter !== "all" && l.country_code !== countryFilter) return false;
      if (l.temp_c != null) {
        if (l.temp_c < tempRange[0] || l.temp_c > tempRange[1]) return false;
      }
      return true;
    });
  }, [lakes, countryFilter, tempRange]);

  const countries = useMemo(
    () => Array.from(new Set(lakes.map((l) => l.country_code))).sort(),
    [lakes],
  );

  // Init map.
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: DEFAULT_STYLE,
      center: [14, 49], // Central Europe
      zoom: 4.2,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: false } }), "top-right");

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Add / update markers + heatmap layer.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const doUpdate = () => {
      // clean existing markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      // Heatmap source
      const featureCollection = {
        type: "FeatureCollection" as const,
        features: filtered
          .filter((l) => l.temp_c != null)
          .map((l) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [l.lng, l.lat] },
            properties: { temp: l.temp_c as number, id: l.id },
          })),
      };

      if (map.getSource("lake-temps")) {
        (map.getSource("lake-temps") as maplibregl.GeoJSONSource).setData(featureCollection);
      } else {
        map.addSource("lake-temps", { type: "geojson", data: featureCollection });

        map.addLayer({
          id: "lake-heatmap",
          type: "heatmap",
          source: "lake-temps",
          maxzoom: 9,
          paint: {
            "heatmap-weight": [
              "interpolate", ["linear"], ["get", "temp"],
              0, 0.2, 15, 0.4, 22, 0.8, 30, 1,
            ],
            "heatmap-intensity": [
              "interpolate", ["linear"], ["zoom"], 0, 0.6, 9, 3,
            ],
            "heatmap-color": [
              "interpolate", ["linear"], ["heatmap-density"],
              0,   "rgba(30, 58, 138, 0)",
              0.2, "rgba(59, 130, 246, 0.5)",
              0.4, "rgba(34, 211, 238, 0.6)",
              0.6, "rgba(250, 204, 21, 0.7)",
              0.8, "rgba(239, 68, 68, 0.85)",
              1,   "rgba(124, 45, 18, 0.9)",
            ],
            "heatmap-radius": [
              "interpolate", ["linear"], ["zoom"], 0, 10, 9, 40,
            ],
            "heatmap-opacity": [
              "interpolate", ["linear"], ["zoom"], 7, 1, 9, 0.4,
            ],
          },
        });
      }
      map.setLayoutProperty("lake-heatmap", "visibility", showHeatmap ? "visible" : "none");

      // Individual markers on top
      filtered.forEach((l) => {
        const bucket = bucketForTemp(l.temp_c);
        const el = document.createElement("button");
        el.type = "button";
        el.setAttribute("aria-label", `${l.name} · ${formatTemp(l.temp_c)}`);
        el.style.background = bucket.color;
        el.className =
          "flex items-center justify-center min-w-[36px] h-[26px] px-2 rounded-full text-white text-[11px] font-semibold shadow-md ring-2 ring-white/70 hover:scale-110 transition tabular-nums";
        el.textContent = l.temp_c != null ? `${l.temp_c.toFixed(0)}°` : "?";
        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          setSelected(l);
          map.easeTo({ center: [l.lng, l.lat], duration: 600, padding: { bottom: 300 } });
        });

        const marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([l.lng, l.lat])
          .addTo(map);
        markersRef.current.push(marker);
      });
    };

    if (map.isStyleLoaded()) doUpdate();
    else map.once("load", doUpdate);
  }, [filtered, showHeatmap]);

  const handleLocate = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((p) => {
      mapRef.current?.easeTo({
        center: [p.coords.longitude, p.coords.latitude],
        zoom: 8,
        duration: 800,
      });
    });
  };

  return (
    <div className="relative h-full w-full flex">
      {/* Side list (desktop) */}
      <aside
        className={cn(
          "hidden md:flex flex-col w-[320px] lg:w-[380px] border-r border-water-100/60 bg-white/80 backdrop-blur-lg",
          !showList && "md:hidden",
        )}
      >
        <div className="p-3 border-b border-water-100/60 space-y-2">
          <div className="text-sm font-semibold text-deep">
            {filtered.length} lakes
          </div>
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="w-full rounded-full border border-water-200 bg-white/80 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-water-400"
          >
            <option value="all">All countries</option>
            {countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="text-xs text-slate-600">
            Water temperature: <b className="tabular-nums">{tempRange[0]}°C</b> — <b className="tabular-nums">{tempRange[1]}°C</b>
          </div>
          <div className="flex gap-2">
            <input
              type="range" min={-5} max={35} step={1}
              value={tempRange[0]}
              onChange={(e) => setTempRange([parseInt(e.target.value), tempRange[1]])}
              className="flex-1"
            />
            <input
              type="range" min={-5} max={35} step={1}
              value={tempRange[1]}
              onChange={(e) => setTempRange([tempRange[0], parseInt(e.target.value)])}
              className="flex-1"
            />
          </div>
        </div>
        <ul className="flex-1 overflow-y-auto divide-y divide-water-100/60 no-scrollbar">
          {filtered.slice(0, 500).map((l) => {
            const bucket = bucketForTemp(l.temp_c);
            return (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(l);
                    mapRef.current?.easeTo({ center: [l.lng, l.lat], zoom: 9, duration: 600 });
                  }}
                  className="w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-water-50/70 transition"
                >
                  <span
                    className="w-9 h-9 rounded-2xl flex items-center justify-center text-white text-xs font-semibold shadow tabular-nums"
                    style={{ backgroundColor: bucket.color }}
                  >
                    {l.temp_c != null ? `${l.temp_c.toFixed(0)}°` : "?"}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium text-deep truncate">{l.name}</span>
                    <span className="block text-xs text-slate-500 truncate">{l.country_code} · {l.type}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Map canvas */}
      <div className="relative flex-1">
        <div ref={mapContainer} className="absolute inset-0" />

        {/* Floating actions */}
        <div className="absolute top-3 left-3 right-3 flex items-start gap-2 pointer-events-none">
          <button
            onClick={() => setShowList((v) => !v)}
            className="hidden md:inline-flex glass rounded-full px-3 py-2 text-sm font-medium text-deep pointer-events-auto"
          >
            <Filter className="h-4 w-4 mr-1" /> {showList ? "Hide list" : "Show list"}
          </button>
          <div className="ml-auto flex gap-2 pointer-events-auto">
            <button
              onClick={() => setShowHeatmap((v) => !v)}
              className="glass rounded-full px-3 py-2 text-sm font-medium text-deep"
              title="Toggle heatmap"
            >
              <Layers className="h-4 w-4 mr-1 inline" />
              {showHeatmap ? "Heatmap on" : "Heatmap off"}
            </button>
            <button
              onClick={handleLocate}
              className="btn-water py-2 px-3 text-sm"
              title="Locate me"
            >
              <Locate className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Temperature legend */}
        <div className="absolute bottom-4 left-4 glass rounded-full px-3 py-1.5 text-[11px] flex items-center gap-2">
          <span>Cold</span>
          <span className="h-2 w-32 rounded-full"
            style={{
              background: "linear-gradient(90deg, #1E3A8A, #3B82F6, #22D3EE, #10B981, #FACC15, #F59E0B, #EF4444, #7C2D12)",
            }}
          />
          <span>Hot</span>
        </div>

        {/* Bottom sheet for selected lake (mobile-first) */}
        {selected && <SelectedSheet lake={selected} onClose={() => setSelected(null)} />}
      </div>
    </div>
  );
}

function SelectedSheet({ lake, onClose }: { lake: LakeMarker; onClose: () => void }) {
  const bucket = bucketForTemp(lake.temp_c);
  return (
    <div className="absolute left-2 right-2 bottom-2 sm:left-auto sm:right-4 sm:bottom-4 sm:w-96 glass rounded-4xl p-4 shadow-xl safe-b">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 rounded-full p-1.5 hover:bg-white/60 transition"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="text-xs uppercase tracking-wide text-slate-500">{lake.country_code} · {lake.type}</div>
      <div className="mt-1 text-xl font-semibold text-deep">{lake.name}</div>
      {lake.name_local && lake.name_local !== lake.name && (
        <div className="text-sm text-slate-500">{lake.name_local}</div>
      )}
      <div className="mt-4 flex items-center gap-4">
        <div
          className="rounded-3xl px-4 py-3 text-white shadow-md"
          style={{ backgroundColor: bucket.color }}
        >
          <div className="text-3xl font-semibold tabular-nums">{formatTemp(lake.temp_c)}</div>
          <div className="text-xs opacity-90">{bucket.label}</div>
        </div>
        <div className="flex-1 text-xs text-slate-500">
          {lake.measured_at ? `Updated ${relativeTime(lake.measured_at)}` : "No recent data"}
          {lake.source && <div className="text-slate-400">Source: {lake.source.replace("_", " ")}</div>}
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Link href={`/lake/${lake.slug}`} className="btn-water flex-1 justify-center text-sm py-2">
          Details
        </Link>
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${lake.lat},${lake.lng}`}
          target="_blank"
          rel="noreferrer"
          className="btn-ghost flex-1 justify-center text-sm py-2"
        >
          Navigate
        </a>
      </div>
    </div>
  );
}
