"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import maplibregl, { Map } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Layers, Locate, Minus, Plus, X, Search,
  Thermometer, Waves, Filter, ChevronRight, ChevronLeft, ChevronUp,
  Sparkles, Navigation2, Map as MapIcon, Mountain, Satellite as SatIcon, Moon, Sun,
} from "lucide-react";
import { bucketForTemp, formatTemp, assessSwim } from "@/lib/temperature";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { useT, useP } from "@/lib/i18n";
import { IconButton, TempPill, GlassCard, RelativeTime } from "@/components/ui";

/**
 * MapLibre `interpolate` colour ramp for water temperature. Steps mirror
 * `TEMP_BUCKETS` in `lib/temperature.ts` so the same colour law drives the
 * TempPill component, the heatmap layer, and the cluster/dot layers on the
 * map. Adding a bucket → update both places.
 */
const TEMP_COLOR_RAMP: unknown[] = [
  "interpolate", ["linear"], ["get", "temp"],
  0,  "#1E3A8A",
  5,  "#3B82F6",
  10, "#22D3EE",
  15, "#10B981",
  18, "#FACC15",
  22, "#F59E0B",
  26, "#EF4444",
  30, "#7C2D12",
];

/**
 * Same ramp but keyed on a cluster-average temp property. Cluster properties
 * are aggregated via `clusterProperties` (see the source definition below).
 */
const CLUSTER_COLOR_RAMP: unknown[] = [
  "interpolate", ["linear"], ["/", ["get", "tempSum"], ["get", "tempCount"]],
  0,  "#1E3A8A",
  5,  "#3B82F6",
  10, "#22D3EE",
  15, "#10B981",
  18, "#FACC15",
  22, "#F59E0B",
  26, "#EF4444",
  30, "#7C2D12",
];

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
  photo_url?: string | null;
}

type BasemapKey = "positron" | "voyager" | "terrain" | "dark" | "satellite";

// Style URLs — all free, no API key required.
const BASEMAPS: Record<BasemapKey, { label: string; icon: typeof MapIcon; style: unknown }> = {
  positron:  { label: "Light",     icon: Sun,       style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json" },
  voyager:   { label: "Streets",   icon: MapIcon,   style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json" },
  terrain:   { label: "Terrain",   icon: Mountain,  style: {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: [
          "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
          "https://b.tile.opentopomap.org/{z}/{x}/{y}.png",
          "https://c.tile.opentopomap.org/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        maxzoom: 17,
        attribution:
          "Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)",
      },
    },
    layers: [{ id: "osm-terrain", type: "raster", source: "osm" }],
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  } },
  dark:      { label: "Dark",      icon: Moon,      style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json" },
  satellite: { label: "Satellite", icon: SatIcon,   style: {
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
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  } },
};

type SortKey = "importance" | "warmest" | "coldest" | "name" | "distance" | "area";

export function MapView() {
  const t = useT();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const [lakes, setLakes] = useState<LakeMarker[]>([]);
  const [selected, setSelected] = useState<LakeMarker | null>(null);
  const [showList, setShowList] = useState(true);
  const [mobilePanel, setMobilePanel] = useState<"peek" | "half" | "full" | "hidden">("peek");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [basemap, setBasemap] = useState<BasemapKey>("positron");
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [tempRange, setTempRange] = useState<[number, number]>([-5, 35]);
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [swimFilter, setSwimFilter] = useState<"all" | "swimmable" | "warm" | "cold">("all");
  const [sizeFilter, setSizeFilter] = useState<"all" | "small" | "medium" | "large">("all");
  const [photoOnly, setPhotoOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("importance");
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [visibleOnly, setVisibleOnly] = useState(false);
  const [bounds, setBounds] = useState<{ n: number; s: number; e: number; w: number } | null>(null);
  const [hovered, setHovered] = useState<{ lake: LakeMarker; x: number; y: number } | null>(null);
  const searchParams = useSearchParams();
  const focusSlug = searchParams?.get("focus") ?? null;
  const focusHandledRef = useRef<string | null>(null);

  // Fetch lakes once.
  useEffect(() => {
    fetch("/api/lakes?limit=5000")
      .then((r) => r.json())
      .then((d) => setLakes(d.lakes ?? []));
  }, []);

  // Focus a lake when arriving via /map?focus=slug.
  useEffect(() => {
    if (!focusSlug || focusHandledRef.current === focusSlug) return;
    if (lakes.length === 0 || !mapRef.current) return;
    const l = lakes.find((x) => x.slug === focusSlug);
    if (!l) return;
    focusHandledRef.current = focusSlug;
    setSelected(l);
    const doFly = () => {
      mapRef.current?.easeTo({
        center: [l.lng, l.lat],
        zoom: Math.max(mapRef.current.getZoom(), 9),
        duration: 900,
        padding: { bottom: 240 },
      });
    };
    if (mapRef.current.isStyleLoaded()) doFly();
    else mapRef.current.once("load", doFly);
  }, [focusSlug, lakes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = lakes.filter((l) => {
      if (countryFilter !== "all" && l.country_code !== countryFilter) return false;
      if (typeFilter !== "all" && l.type !== typeFilter) return false;
      if (l.temp_c != null) {
        if (l.temp_c < tempRange[0] || l.temp_c > tempRange[1]) return false;
      }
      // Swim-safety filter: bucket the numeric temp into an intent tier.
      // - 'swimmable' >= 15°C (fresh, pleasant, warm, hot)
      // - 'warm'      >= 22°C
      // - 'cold'      <  15°C
      if (swimFilter !== "all" && l.temp_c != null) {
        if (swimFilter === "swimmable" && l.temp_c < 15) return false;
        if (swimFilter === "warm"      && l.temp_c < 22) return false;
        if (swimFilter === "cold"      && l.temp_c >= 15) return false;
      }
      // Area size filter — small < 1 km², medium 1-10 km², large > 10 km².
      if (sizeFilter !== "all") {
        const a = l.area_km2 ?? 0;
        if (sizeFilter === "small"  && !(a > 0 && a < 1)) return false;
        if (sizeFilter === "medium" && !(a >= 1 && a <= 10)) return false;
        if (sizeFilter === "large"  && !(a > 10)) return false;
      }
      // Photo-only filter — only lakes with a Wikimedia photo backfilled.
      if (photoOnly && !l.photo_url) return false;
      if (q) {
        const hay = `${l.name} ${l.name_local ?? ""} ${l.country_code}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (visibleOnly && bounds) {
        if (l.lat < bounds.s || l.lat > bounds.n) return false;
        if (l.lng < bounds.w || l.lng > bounds.e) return false;
      }
      return true;
    });
    switch (sortBy) {
      case "warmest": arr = arr.slice().sort((a, b) => (b.temp_c ?? -999) - (a.temp_c ?? -999)); break;
      case "coldest": arr = arr.slice().sort((a, b) => (a.temp_c ??  999) - (b.temp_c ??  999)); break;
      case "name":    arr = arr.slice().sort((a, b) => a.name.localeCompare(b.name)); break;
      case "area":    arr = arr.slice().sort((a, b) => (b.area_km2 ?? 0) - (a.area_km2 ?? 0)); break;
      case "distance": {
        if (userLoc) {
          const dist = (l: LakeMarker) => {
            const dLat = (l.lat - userLoc.lat) * Math.PI / 180;
            const dLng = (l.lng - userLoc.lng) * Math.PI / 180;
            const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(l.lat * Math.PI / 180) * Math.cos(userLoc.lat * Math.PI / 180) *
              Math.sin(dLng / 2) ** 2;
            return 12742 * Math.asin(Math.sqrt(a)); // km
          };
          arr = arr.slice().sort((a, b) => dist(a) - dist(b));
        } else {
          arr = arr.slice().sort((a, b) => b.importance - a.importance);
        }
        break;
      }
      default: arr = arr.slice().sort((a, b) => b.importance - a.importance);
    }
    return arr;
  }, [lakes, countryFilter, typeFilter, tempRange, swimFilter, sizeFilter, photoOnly, query, sortBy, visibleOnly, bounds, userLoc]);

  // Ref mirror of `filtered`. Layer click handlers are registered once on
  // first `map.on(...)` and their closure captures whatever `filtered` was
  // at that moment (usually `[]` before lakes have loaded). Reading through
  // a ref means the click callback always sees the latest array without
  // needing to re-register the handler on every render.
  const filteredRef = useRef<LakeMarker[]>([]);
  useEffect(() => { filteredRef.current = filtered; }, [filtered]);

  const countries = useMemo(
    () => Array.from(new Set(lakes.map((l) => l.country_code))).sort(),
    [lakes],
  );

  const types = useMemo(
    () => Array.from(new Set(lakes.map((l) => l.type))).sort(),
    [lakes],
  );

  const activeFilterCount =
    (countryFilter !== "all" ? 1 : 0) +
    (typeFilter !== "all" ? 1 : 0) +
    (tempRange[0] > -5 || tempRange[1] < 35 ? 1 : 0) +
    (swimFilter !== "all" ? 1 : 0) +
    (sizeFilter !== "all" ? 1 : 0) +
    (photoOnly ? 1 : 0);

  // Init map.
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: BASEMAPS[basemap].style as never,
      center: [14, 49],
      zoom: 4.2,
      attributionControl: false,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    const updateBounds = () => {
      const b = map.getBounds();
      setBounds({
        n: b.getNorth(),
        s: b.getSouth(),
        e: b.getEast(),
        w: b.getWest(),
      });
    };
    map.on("moveend", updateBounds);
    map.once("load", updateBounds);

    mapRef.current = map;
    return () => {
      map.off("moveend", updateBounds);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch basemap.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const style = BASEMAPS[basemap].style;
    map.setStyle(style as never);
  }, [basemap]);

  // --------------------------------------------------------------------
  // Add / update the lake layers.
  //
  // Rendering strategy (2026-07 refactor):
  // - One GeoJSON source with `cluster: true`. When the map is zoomed out,
  //   nearby lakes are aggregated into a single cluster; we style the
  //   cluster circle by the AVG temperature of its members (so the user
  //   sees "orange dot" = warm area, "blue dot" = cold area — no chaos
  //   from N overlapping pills).
  // - A `symbol` layer draws the temperature-pill labels for INDIVIDUAL
  //   lakes only when there's room (thanks to MapLibre's automatic
  //   symbol collision detection: text-allow-overlap defaults to false).
  //   Zoom-aware `min-zoom` per importance tier keeps the world view
  //   readable — big lakes visible always, medium from zoom 4, small
  //   from zoom 6.
  // - The heatmap layer remains as an optional overlay (toggle).
  //
  // Interactivity is bound to the layers via `map.on('click', layerId)`,
  // not per-DOM-element, so it works with WebGL rendering.
  // --------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let cancelled = false;

    const doUpdate = () => {
      if (cancelled) return;

      const features = filtered
        .filter((l) => l.temp_c != null)
        .map((l) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [l.lng, l.lat] },
          properties: {
            id: l.id,
            slug: l.slug,
            name: l.name,
            temp: l.temp_c as number,
            importance: l.importance ?? 0,
            area: l.area_km2 ?? 0,
            country: l.country_code,
          },
        }));

      const fc = { type: "FeatureCollection" as const, features };

      const existing = map.getSource("lake-points") as
        | maplibregl.GeoJSONSource
        | undefined;
      if (existing) {
        existing.setData(fc);
      } else {
        // First-time setup: create source + layers.
        map.addSource("lake-points", {
          type: "geojson",
          data: fc,
          cluster: true,
          clusterRadius: 55,
          clusterMaxZoom: 8, // Below zoom 8 aggregate; above show individuals.
          clusterProperties: {
            // Two accumulators → runtime avg = tempSum / tempCount.
            // We avoid a direct "avg" because MapLibre cluster reducers
            // can't do division across step-by-step accumulation.
            tempSum: ["+", ["get", "temp"]],
            tempCount: ["+", 1],
            maxImportance: ["max", ["get", "importance"]],
          },
        });

        // Heatmap — kept as an optional overlay ("Windy-style" view).
        map.addLayer({
          id: "lake-heatmap",
          type: "heatmap",
          source: "lake-points",
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

        // Cluster bubble — coloured by avg temperature of its members.
        map.addLayer({
          id: "lake-clusters",
          type: "circle",
          source: "lake-points",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": CLUSTER_COLOR_RAMP as never,
            "circle-radius": [
              "step",
              ["get", "point_count"],
              18,   // 1-9 lakes
              10, 22,
              25, 28,
              50, 34,
              100, 40,
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": "rgba(255,255,255,0.9)",
            "circle-opacity": 0.92,
          },
        });

        // Cluster count label.
        map.addLayer({
          id: "lake-cluster-count",
          type: "symbol",
          source: "lake-points",
          filter: ["has", "point_count"],
          layout: {
            "text-field": "{point_count_abbreviated}",
            "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
            "text-size": 13,
            "text-allow-overlap": true,
          },
          paint: {
            "text-color": "#ffffff",
            "text-halo-color": "rgba(0,0,0,0.35)",
            "text-halo-width": 1,
          },
        });

        // Individual lake temperature pill. Collision detection is on by
        // default (text-allow-overlap: false), so labels thin themselves
        // out as you zoom out. `minzoom` per-layer keeps small lakes hidden
        // until they can actually be told apart.
        map.addLayer({
          id: "lake-labels",
          type: "symbol",
          source: "lake-points",
          filter: ["!", ["has", "point_count"]],
          layout: {
            "text-field": [
              "concat",
              ["number-format", ["get", "temp"], { "min-fraction-digits": 0, "max-fraction-digits": 0 }],
              "°",
            ],
            "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
            "text-size": [
              "interpolate", ["linear"], ["zoom"],
              3, 10,
              6, 12,
              9, 13,
            ],
            "text-allow-overlap": false,
            "text-ignore-placement": false,
            // Sort so the highest-importance labels place first — they
            // "win" any collision with a less-important neighbour.
            "symbol-sort-key": ["-", 10, ["get", "importance"]],
            "text-padding": 4,
          },
          paint: {
            "text-color": "#ffffff",
            "text-halo-color": TEMP_COLOR_RAMP as never,
            "text-halo-width": 8, // Halo acts as the pill background.
            "text-halo-blur": 0.3,
          },
        });

        // Small always-visible marker under the label so users can still
        // see something is there even when the label gets collision-hidden.
        map.addLayer(
          {
            id: "lake-dots",
            type: "circle",
            source: "lake-points",
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-color": TEMP_COLOR_RAMP as never,
              "circle-radius": [
                "interpolate", ["linear"], ["zoom"],
                2, 2,
                6, 4,
                10, 6,
              ],
              "circle-stroke-width": 1.5,
              "circle-stroke-color": "rgba(255,255,255,0.9)",
            },
          },
          "lake-labels", // Draw dots *below* labels.
        );

        // Interactions: click on cluster → expand.
        map.on("click", "lake-clusters", async (e) => {
          const feats = map.queryRenderedFeatures(e.point, { layers: ["lake-clusters"] });
          const first = feats[0];
          if (!first?.properties?.cluster_id) return;
          const clusterId = first.properties.cluster_id as number;
          const src = map.getSource("lake-points") as maplibregl.GeoJSONSource;
          const zoom = await src.getClusterExpansionZoom(clusterId);
          if (first.geometry.type !== "Point") return;
          const [lng, lat] = first.geometry.coordinates;
          map.easeTo({ center: [lng, lat], zoom, duration: 700 });
        });

        // Click on individual dot / label → open detail sheet.
        // Reads `filteredRef.current` (not the closed-over `filtered`) so
        // it survives across data refreshes without re-binding.
        const openFeature = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
          const f = e.features?.[0];
          if (!f) return;
          const props = f.properties as { id: string; slug: string };
          const target = filteredRef.current.find((l) => l.id === props.id);
          if (!target || f.geometry.type !== "Point") return;
          const [lng, lat] = f.geometry.coordinates;
          setSelected(target);
          map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 7), duration: 700 });
        };
        map.on("click", "lake-labels", openFeature);
        map.on("click", "lake-dots", openFeature);

        // Hover tooltip (desktop only — mobile taps go straight to select).
        const onEnter = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
          map.getCanvas().style.cursor = "pointer";
          const f = e.features?.[0];
          if (!f) return;
          const props = f.properties as { id: string };
          const target = filteredRef.current.find((l) => l.id === props.id);
          if (target) {
            const p = map.project(e.lngLat);
            setHovered({ lake: target, x: p.x, y: p.y });
          }
        };
        const onLeave = () => {
          map.getCanvas().style.cursor = "";
          setHovered(null);
        };
        map.on("mouseenter", "lake-labels", onEnter);
        map.on("mouseleave", "lake-labels", onLeave);
        map.on("mouseenter", "lake-dots", onEnter);
        map.on("mouseleave", "lake-dots", onLeave);
        map.on("mouseenter", "lake-clusters", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "lake-clusters", () => {
          map.getCanvas().style.cursor = "";
        });
      }

      if (map.getLayer("lake-heatmap")) {
        map.setLayoutProperty("lake-heatmap", "visibility", showHeatmap ? "visible" : "none");
      }
    };

    if (map.isStyleLoaded()) doUpdate();
    else map.once("load", doUpdate);

    const onStyleData = () => {
      if (map.isStyleLoaded()) doUpdate();
    };
    map.on("styledata", onStyleData);

    return () => {
      cancelled = true;
      map.off("styledata", onStyleData);
    };
  }, [filtered, showHeatmap, basemap]);

  const doLocate = useCallback(() => {
    if (!navigator.geolocation) return;
    track("map.locate");
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

    const apply = () => {
      const data = {
        type: "FeatureCollection" as const,
        features: [{
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [userLoc.lng, userLoc.lat] },
          properties: {},
        }],
      };
      const src = map.getSource("user-loc") as maplibregl.GeoJSONSource | undefined;
      if (src) {
        src.setData(data);
        return;
      }
      map.addSource("user-loc", { type: "geojson", data });
      map.addLayer({
        id: "user-loc-halo",
        type: "circle",
        source: "user-loc",
        paint: { "circle-radius": 22, "circle-color": "#0EA5E9", "circle-opacity": 0.15 },
      });
      map.addLayer({
        id: "user-loc-dot",
        type: "circle",
        source: "user-loc",
        paint: {
          "circle-radius": 6, "circle-color": "#0EA5E9",
          "circle-stroke-color": "#FFFFFF", "circle-stroke-width": 2,
        },
      });
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [userLoc, basemap]);

  const zoom = (delta: number) => {
    const m = mapRef.current;
    if (!m) return;
    m.easeTo({ zoom: m.getZoom() + delta, duration: 200 });
  };

  const centerWorld = () => {
    mapRef.current?.easeTo({ center: [14, 49], zoom: 4.2, duration: 800 });
  };

  const clearAllFilters = () => {
    setCountryFilter("all");
    setTypeFilter("all");
    setTempRange([-5, 35]);
    setSwimFilter("all");
    setSizeFilter("all");
    setPhotoOnly(false);
    setQuery("");
    setSortBy("importance");
  };

  const openLake = (l: LakeMarker) => {
    setSelected(l);
    mapRef.current?.easeTo({ center: [l.lng, l.lat], zoom: 9, duration: 700 });
    setMobilePanel("peek");
  };

  return (
    <div className="relative h-full w-full flex overflow-hidden bg-water-50 min-h-0">
      {/* Desktop side list — pt-[76px] leaves room for the floating nav on top. */}
      <aside
        className={cn(
          "hidden md:flex flex-col w-[340px] lg:w-[400px] h-full bg-white/85 backdrop-blur-xl border-r border-white/60 shadow-[0_0_40px_rgba(14,165,233,0.08)] z-20 min-h-0 pt-[76px]",
          !showList && "md:hidden",
        )}
      >
        <SidebarContent
          filtered={filtered}
          countries={countries}
          types={types}
          query={query} setQuery={setQuery}
          countryFilter={countryFilter} setCountryFilter={setCountryFilter}
          typeFilter={typeFilter} setTypeFilter={setTypeFilter}
          tempRange={tempRange} setTempRange={setTempRange}
          swimFilter={swimFilter} setSwimFilter={setSwimFilter}
          sizeFilter={sizeFilter} setSizeFilter={setSizeFilter}
          photoOnly={photoOnly} setPhotoOnly={setPhotoOnly}
          sortBy={sortBy} setSortBy={setSortBy}
          onOpen={openLake}
          hasLocation={!!userLoc}
        />
      </aside>

      {/* Map canvas + overlays */}
      <div className="relative flex-1 h-full min-h-0">
        <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

        {/* Desktop: toggle list */}
        <IconButton
          icon={showList ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          onClick={() => setShowList((v) => !v)}
          className="hidden md:inline-flex absolute top-[76px] left-4 z-30"
          aria-label={showList ? t("map.hideList") : t("map.showList")}
        />

        {/* Mobile: top search + filter — sits below the floating nav */}
        <div className="md:hidden absolute top-[68px] left-3 right-3 z-30 flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-water-500 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("map.searchLakes")}
              className="w-full rounded-full bg-white/95 backdrop-blur pl-10 pr-10 py-2.5 text-sm outline-none shadow-lg border border-white/60 focus:ring-2 focus:ring-water-400"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:text-slate-700"
                aria-label={t("map.clear")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setMobileFilterOpen(true)}
            className="relative h-11 w-11 rounded-full bg-white/95 backdrop-blur shadow-lg flex items-center justify-center text-water-700 hover:bg-white transition border border-white/60"
            aria-label={t("map.openFilters")}
          >
            <Filter className="h-4.5 w-4.5" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 rounded-full bg-water-500 text-white text-[10px] font-bold flex items-center justify-center shadow ring-2 ring-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Search-this-area toggle */}
        <button
          onClick={() => setVisibleOnly((v) => !v)}
          className={cn(
            "absolute top-[76px] left-1/2 -translate-x-1/2 z-20 hidden md:flex items-center gap-1.5 rounded-full shadow-lg px-4 py-2 text-xs font-semibold transition border",
            visibleOnly
              ? "bg-water-500 text-white border-water-600"
              : "bg-white/95 backdrop-blur text-water-800 border-white/60 hover:bg-white",
          )}
          title={visibleOnly ? t("map.showAll") : t("map.onlyInView")}
        >
          <MapIcon className="h-3.5 w-3.5" />
          {visibleOnly ? t("map.showingArea") : t("map.searchArea")}
        </button>

        {/* Hover tooltip */}
        {hovered && !selected && (
          <div
            className="hidden md:block absolute z-40 pointer-events-none transition-opacity"
            style={{ left: hovered.x, top: hovered.y - 12, transform: "translate(-50%, -100%)" }}
          >
            <div className="rounded-2xl bg-white/95 backdrop-blur-md border border-white/60 shadow-[0_8px_30px_rgba(14,165,233,0.20)] px-3 py-2 min-w-[180px]">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                {hovered.lake.country_code} · {hovered.lake.type}
              </div>
              <div className="text-sm font-semibold text-deep truncate">{hovered.lake.name}</div>
              <div className="mt-1 flex items-center gap-2">
                <TempPill temp={hovered.lake.temp_c} size="sm" />
                {hovered.lake.area_km2 && (
                  <span className="text-[11px] text-slate-500 tabular-nums">
                    {Number(hovered.lake.area_km2).toFixed(1)} km²
                  </span>
                )}
              </div>
            </div>
            <div className="mx-auto h-2 w-2 rotate-45 bg-white -mt-1 border-r border-b border-white/60 shadow-[0_2px_4px_rgba(14,165,233,0.10)]" />
          </div>
        )}

        {/* Right controls stack — pushed below the floating nav on desktop, and below the mobile top bar as well. */}
        <div className="absolute top-[76px] right-4 z-20 flex flex-col gap-2 items-end pt-[52px] md:pt-0">
          <div className="relative">
            <IconButton
              icon={<Layers className="h-5 w-5" />}
              onClick={() => setShowLayerMenu((v) => !v)}
              aria-label={t("map.mapLayers")}
              active={showLayerMenu}
            />
            {showLayerMenu && (
              <GlassCard variant="light" className="absolute right-0 top-12 w-64 p-3 z-50">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 px-1 font-semibold">Map style</div>
                {/* Group 1: schematic road maps */}
                <div className="grid grid-cols-3 gap-1.5">
                  {(["positron", "voyager", "dark"] as BasemapKey[]).map((k) => {
                    const B = BASEMAPS[k];
                    const Icon = B.icon;
                    return (
                      <button
                        key={k}
                        onClick={() => { setBasemap(k); track("map.basemap", { basemap: k }); }}
                        className={cn(
                          "rounded-2xl px-2 py-2 text-[11px] font-medium transition flex flex-col items-center gap-1",
                          basemap === k
                            ? "bg-water-500 text-white shadow"
                            : "bg-water-50 text-slate-700 hover:bg-water-100",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {B.label}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-1.5 text-[9px] text-slate-400 px-1">{t("map.roads")}</div>
                {/* Group 2: photo / relief */}
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {(["terrain", "satellite"] as BasemapKey[]).map((k) => {
                    const B = BASEMAPS[k];
                    const Icon = B.icon;
                    return (
                      <button
                        key={k}
                        onClick={() => { setBasemap(k); track("map.basemap", { basemap: k }); }}
                        className={cn(
                          "rounded-2xl px-3 py-2 text-xs font-medium transition flex items-center gap-2",
                          basemap === k
                            ? "bg-water-500 text-white shadow"
                            : "bg-water-50 text-slate-700 hover:bg-water-100",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {B.label}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-1.5 text-[9px] text-slate-400 px-1">{t("map.nature")}</div>
                <div className="mt-3 text-[10px] uppercase tracking-wider text-slate-500 mb-2 px-1 font-semibold">{t("map.layers")}</div>
                <label className="flex items-center justify-between gap-2 px-2 py-2 rounded-2xl hover:bg-water-50 cursor-pointer">
                  <span className="flex items-center gap-2 text-sm text-slate-700">
                    <Thermometer className="h-4 w-4 text-temp-hot" /> Heatmap
                  </span>
                  <span
                    role="switch"
                    aria-checked={showHeatmap}
                    onClick={() => setShowHeatmap((v) => !v)}
                    className={cn(
                      "relative inline-flex h-5 w-9 items-center rounded-full transition cursor-pointer",
                      showHeatmap ? "bg-water-500" : "bg-slate-300",
                    )}
                  >
                    <span className={cn(
                      "inline-block h-4 w-4 rounded-full bg-white shadow transform transition",
                      showHeatmap ? "translate-x-4" : "translate-x-0.5",
                    )} />
                  </span>
                </label>
              </GlassCard>
            )}
          </div>

          <div className="flex flex-col rounded-full bg-white/95 backdrop-blur shadow-lg overflow-hidden border border-white/60">
            <button
              onClick={() => zoom(1)}
              className="h-10 w-10 flex items-center justify-center text-water-700 hover:bg-water-50 transition border-b border-water-100"
              aria-label={t("map.zoomIn")}
            >
              <Plus className="h-5 w-5" />
            </button>
            <button
              onClick={() => zoom(-1)}
              className="h-10 w-10 flex items-center justify-center text-water-700 hover:bg-water-50 transition"
              aria-label={t("map.zoomOut")}
            >
              <Minus className="h-5 w-5" />
            </button>
          </div>

          <IconButton
            icon={<Locate className="h-5 w-5" />}
            variant="primary"
            onClick={doLocate}
            aria-label={t("map.locate")}
          />

          <IconButton
            icon={<Navigation2 className="h-4 w-4" />}
            onClick={centerWorld}
            aria-label={t("map.resetView")}
          />
        </div>

        {/* Temperature legend — bottom-left, hidden when the sheet is up */}
        <div className={cn(
          "absolute bottom-4 left-4 z-10 rounded-full bg-white/95 backdrop-blur shadow-lg pl-3 pr-4 py-2 items-center gap-2 text-[11px] font-medium text-slate-700 border border-white/60",
          "hidden md:flex",
        )}>
          <Waves className="h-3.5 w-3.5 text-water-600" />
          <span className="tabular-nums">-5°</span>
          <span
            className="h-2 w-40 rounded-full"
            style={{ background: "linear-gradient(90deg, #1E3A8A, #3B82F6, #22D3EE, #10B981, #FACC15, #F59E0B, #EF4444, #7C2D12)" }}
          />
          <span className="tabular-nums">35°</span>
        </div>

        {/* Selected sheet — floats top-right on desktop, above bottom sheet on mobile */}
        {selected && (
          <SelectedSheet
            lake={selected}
            onClose={() => setSelected(null)}
          />
        )}

        {/* Mobile bottom sheet */}
        <MobileBottomSheet
          state={mobilePanel}
          setState={setMobilePanel}
          filtered={filtered}
          onOpen={openLake}
          hideForSelection={!!selected}
        />
      </div>

      {/* Mobile filter modal */}
      {mobileFilterOpen && (
        <MobileFilterModal
          onClose={() => setMobileFilterOpen(false)}
          countries={countries}
          types={types}
          countryFilter={countryFilter} setCountryFilter={setCountryFilter}
          typeFilter={typeFilter} setTypeFilter={setTypeFilter}
          tempRange={tempRange} setTempRange={setTempRange}
          swimFilter={swimFilter} setSwimFilter={setSwimFilter}
          sizeFilter={sizeFilter} setSizeFilter={setSizeFilter}
          photoOnly={photoOnly} setPhotoOnly={setPhotoOnly}
          sortBy={sortBy} setSortBy={setSortBy}
          count={filtered.length}
          clearAll={clearAllFilters}
        />
      )}
    </div>
  );
}

// ---------- SIDEBAR CONTENT (desktop) ----------
function SidebarContent(props: {
  filtered: LakeMarker[];
  countries: string[];
  types: string[];
  query: string; setQuery: (v: string) => void;
  countryFilter: string; setCountryFilter: (v: string) => void;
  typeFilter: string; setTypeFilter: (v: string) => void;
  tempRange: [number, number]; setTempRange: (v: [number, number]) => void;
  swimFilter: "all" | "swimmable" | "warm" | "cold"; setSwimFilter: (v: "all" | "swimmable" | "warm" | "cold") => void;
  sizeFilter: "all" | "small" | "medium" | "large"; setSizeFilter: (v: "all" | "small" | "medium" | "large") => void;
  photoOnly: boolean; setPhotoOnly: (v: boolean) => void;
  sortBy: SortKey; setSortBy: (v: SortKey) => void;
  onOpen: (l: LakeMarker) => void;
  hasLocation: boolean;
}) {
  const {
    filtered, countries, types,
    query, setQuery,
    countryFilter, setCountryFilter,
    typeFilter, setTypeFilter,
    tempRange, setTempRange,
    swimFilter, setSwimFilter,
    sizeFilter, setSizeFilter,
    photoOnly, setPhotoOnly,
    sortBy, setSortBy,
    hasLocation,
    onOpen,
  } = props;
  const t = useT();
  const p = useP();

  return (
    <>
      <div className="p-4 border-b border-water-100/70 space-y-3 shrink-0">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-water-500 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("map.searchLakes")}
            className="w-full rounded-full border border-water-200/70 bg-white/90 pl-10 pr-9 py-2.5 text-sm outline-none focus:ring-2 focus:ring-water-400"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:text-slate-700"
              aria-label={t("map.clear")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-water-100 text-water-700 px-2.5 py-1 font-semibold">
            {p("map.lakesShown", filtered.length)}
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

        <div className="grid grid-cols-2 gap-2 text-xs">
          <label>
            <span className="text-slate-500 font-medium">{t("filter.country")}</span>
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="mt-1 w-full rounded-full border border-water-200/70 bg-white/90 px-3 py-1.5 outline-none focus:ring-2 focus:ring-water-400"
            >
              <option value="all">{t("map.allCountries")}</option>
              {countries.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>
            <span className="text-slate-500 font-medium">{t("map.type")}</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="mt-1 w-full rounded-full border border-water-200/70 bg-white/90 px-3 py-1.5 outline-none focus:ring-2 focus:ring-water-400"
            >
              <option value="all">{t("map.allTypes")}</option>
              {types.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
            </select>
          </label>
        </div>

        <label className="block text-xs">
          <span className="text-slate-500 font-medium">
            {t("filter.temperature")}: <b className="tabular-nums text-slate-700">{tempRange[0]}°C</b> — <b className="tabular-nums text-slate-700">{tempRange[1]}°C</b>
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

        <label className="block text-xs">
          <span className="text-slate-500 font-medium">{t("filter.sortBy")}</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="mt-1 w-full rounded-full border border-water-200/70 bg-white/90 px-3 py-2 outline-none focus:ring-2 focus:ring-water-400 text-sm font-medium text-deep"
          >
            <option value="importance">⭐ {t("sort.top")}</option>
            <option value="warmest">🔥 {t("sort.warmest")}</option>
            <option value="coldest">❄ {t("sort.coldest")}</option>
            <option value="area">🌊 {t("sort.area")}</option>
            <option value="name">🔤 {t("sort.nameFull")}</option>
            {hasLocation && <option value="distance">📍 {t("sort.distanceFull")}</option>}
          </select>
        </label>

        {/* Swim-safety filter (segmented control). */}
        <div className="text-xs">
          <div className="text-slate-500 font-medium mb-1.5">{t("filter.swim")}</div>
          <div className="grid grid-cols-4 gap-1 rounded-2xl bg-water-50 p-0.5" role="radiogroup" aria-label={t("filter.swim")}>
            {(
              [
                ["all",       t("filter.swim.all")],
                ["swimmable", t("filter.swim.swimmable")],
                ["warm",      t("filter.swim.warm")],
                ["cold",      t("filter.swim.cold")],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                role="radio"
                aria-checked={swimFilter === v}
                onClick={() => setSwimFilter(v)}
                className={cn(
                  "rounded-xl px-1.5 py-1.5 text-[11px] font-medium transition",
                  swimFilter === v
                    ? "bg-white shadow-sm text-water-800"
                    : "text-slate-600 hover:bg-white/70",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Area-size filter. */}
        <div className="text-xs">
          <div className="text-slate-500 font-medium mb-1.5">{t("filter.size")}</div>
          <div className="grid grid-cols-4 gap-1 rounded-2xl bg-water-50 p-0.5" role="radiogroup" aria-label={t("filter.size")}>
            {(
              [
                ["all",    t("filter.size.all")],
                ["small",  t("filter.size.small")],
                ["medium", t("filter.size.medium")],
                ["large",  t("filter.size.large")],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                role="radio"
                aria-checked={sizeFilter === v}
                onClick={() => setSizeFilter(v)}
                className={cn(
                  "rounded-xl px-1.5 py-1.5 text-[11px] font-medium transition",
                  sizeFilter === v
                    ? "bg-white shadow-sm text-water-800"
                    : "text-slate-600 hover:bg-white/70",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Photo-only toggle. */}
        <label className="flex items-center justify-between text-xs cursor-pointer">
          <span className="text-slate-500 font-medium">{t("filter.hasPhoto")}</span>
          <span
            role="switch"
            aria-checked={photoOnly}
            onClick={() => setPhotoOnly(!photoOnly)}
            className={cn(
              "relative inline-flex h-5 w-9 items-center rounded-full transition",
              photoOnly ? "bg-water-500" : "bg-slate-300",
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 rounded-full bg-white shadow transform transition",
                photoOnly ? "translate-x-4" : "translate-x-0.5",
              )}
            />
          </span>
        </label>
      </div>

      <ul className="flex-1 overflow-y-auto divide-y divide-water-100/50 no-scrollbar">
        {filtered.length === 0 && (
          <li className="p-8 text-sm text-slate-500 text-center">
            {t("map.noMatches")}
          </li>
        )}
        {filtered.slice(0, 500).map((l) => (
          <li key={l.id}>
            <button
              type="button"
              onClick={() => onOpen(l)}
              className="w-full text-left group flex items-center gap-3 px-4 py-3 hover:bg-water-50/70 transition"
            >
              <div className="relative h-14 w-14 rounded-2xl overflow-hidden bg-water-100 shrink-0 shadow-sm">
                {l.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={l.photo_url}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-water-200 to-water-400" />
                )}
                <div className="absolute bottom-1 left-1 right-1 flex justify-start">
                  <TempPill temp={l.temp_c} size="xs" className="!ring-2 !ring-white shadow" />
                </div>
              </div>
              <span className="flex-1 min-w-0">
                <span className="block font-medium text-deep truncate">{l.name}</span>
                <span className="block text-xs text-slate-500 truncate">
                  {l.country_code} · {l.type}
                  {l.area_km2 && ` · ${Number(l.area_km2).toFixed(1)} km²`}
                </span>
                {l.measured_at && (
                  <span className="block text-[10px] text-slate-400 mt-0.5">
                    {t("map.updatedPrefix")} <RelativeTime iso={l.measured_at} />
                  </span>
                )}
              </span>
              <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-water-500 transition shrink-0" />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

// ---------- MOBILE BOTTOM SHEET ----------
function MobileBottomSheet({
  state, setState, filtered, onOpen, hideForSelection,
}: {
  state: "peek" | "half" | "full" | "hidden";
  setState: (s: "peek" | "half" | "full" | "hidden") => void;
  filtered: LakeMarker[];
  onOpen: (l: LakeMarker) => void;
  hideForSelection: boolean;
}) {
  const t = useT();
  const p = useP();
  if (hideForSelection) return null;
  const heights = {
    hidden: "translate-y-full",
    peek:   "translate-y-[calc(100%-92px)]",
    half:   "translate-y-[45%]",
    full:   "translate-y-[64px]",
  };
  return (
    <div
      className={cn(
        "md:hidden absolute inset-x-0 bottom-0 top-0 z-30 flex flex-col pointer-events-none",
      )}
    >
      <div
        className={cn(
          "mt-auto rounded-t-4xl bg-white/95 backdrop-blur-xl border-t border-white/60 shadow-[0_-8px_40px_rgba(14,165,233,0.15)] pointer-events-auto transition-transform duration-300 ease-out h-full flex flex-col",
          heights[state],
        )}
      >
        {/* Grabber */}
        <button
          type="button"
          onClick={() => setState(state === "peek" ? "half" : state === "half" ? "full" : "peek")}
          className="w-full pt-2 pb-1 flex justify-center shrink-0"
          aria-label={t("map.toggleList")}
        >
          <span className="h-1.5 w-10 rounded-full bg-slate-300" />
        </button>

        {/* Header */}
        <div className="px-4 pb-3 flex items-center gap-3 shrink-0 border-b border-water-100/50">
          <div className="flex-1">
            <div className="text-sm font-semibold text-deep">
              {p("map.lakesInView", filtered.length)}
            </div>
            <div className="text-[11px] text-slate-500">{t("map.tapToJump")}</div>
          </div>
          <button
            onClick={() => setState(state === "full" ? "peek" : "full")}
            className="h-9 w-9 rounded-full bg-water-100 text-water-700 flex items-center justify-center"
            aria-label={state === "full" ? t("map.collapse") : t("map.expand")}
          >
            {state === "full"
              ? <ChevronRight className="h-4 w-4 rotate-90" />
              : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>

        {/* Scrollable list */}
        <ul className="flex-1 overflow-y-auto divide-y divide-water-100/40 no-scrollbar overscroll-contain">
          {filtered.length === 0 && (
            <li className="p-8 text-sm text-slate-500 text-center">
              No lakes match your filters.
            </li>
          )}
          {filtered.slice(0, 300).map((l) => (
            <li key={l.id}>
              <button
                onClick={() => onOpen(l)}
                className="w-full text-left group flex items-center gap-3 px-4 py-3 hover:bg-water-50/70 active:bg-water-50 transition"
              >
                <div className="relative h-12 w-12 rounded-2xl overflow-hidden bg-water-100 shrink-0 shadow-sm">
                  {l.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={l.photo_url}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-water-200 to-water-400" />
                  )}
                  <div className="absolute bottom-0.5 left-0.5">
                    <TempPill temp={l.temp_c} size="xs" className="!ring-2 !ring-white shadow-sm" />
                  </div>
                </div>
                <span className="flex-1 min-w-0">
                  <span className="block font-medium text-deep truncate text-sm">{l.name}</span>
                  <span className="block text-[11px] text-slate-500 truncate">
                    {l.country_code} · {l.type}
                    {l.area_km2 && ` · ${Number(l.area_km2).toFixed(1)} km²`}
                  </span>
                  {l.measured_at && (
                    <span className="block text-[10px] text-slate-400">
                      {t("map.updatedPrefix")} <RelativeTime iso={l.measured_at} />
                    </span>
                  )}
                </span>
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-water-500 transition shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------- MOBILE FILTER MODAL ----------
function MobileFilterModal(props: {
  onClose: () => void;
  countries: string[];
  types: string[];
  countryFilter: string; setCountryFilter: (v: string) => void;
  typeFilter: string; setTypeFilter: (v: string) => void;
  tempRange: [number, number]; setTempRange: (v: [number, number]) => void;
  swimFilter: "all" | "swimmable" | "warm" | "cold"; setSwimFilter: (v: "all" | "swimmable" | "warm" | "cold") => void;
  sizeFilter: "all" | "small" | "medium" | "large"; setSizeFilter: (v: "all" | "small" | "medium" | "large") => void;
  photoOnly: boolean; setPhotoOnly: (v: boolean) => void;
  sortBy: SortKey; setSortBy: (v: SortKey) => void;
  count: number;
  clearAll: () => void;
}) {
  const {
    onClose, countries, types,
    countryFilter, setCountryFilter,
    typeFilter, setTypeFilter,
    tempRange, setTempRange,
    swimFilter, setSwimFilter,
    sizeFilter, setSizeFilter,
    photoOnly, setPhotoOnly,
    sortBy, setSortBy,
    count, clearAll,
  } = props;
  const t = useT();

  return (
    <div className="md:hidden fixed inset-0 z-50 flex flex-col bg-white/95 backdrop-blur-xl safe-t">
      <div className="shrink-0 flex items-center justify-between px-5 pt-4 pb-3 border-b border-water-100/70">
        <div>
          <div className="text-lg font-semibold text-deep leading-tight">{t("filter.title")}</div>
          <div className="text-xs text-slate-500">
            {count === 1 ? t("filter.showOne") : t("filter.showN", { n: count })}
          </div>
        </div>
        <button
          onClick={onClose}
          className="h-11 w-11 rounded-full bg-water-50 flex items-center justify-center text-water-700 hover:bg-water-100 transition"
          aria-label={t("map.closeFilters")}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7">
        <section>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center justify-between">
            <span>{t("filter.temperature")}</span>
            <span className="text-deep font-bold tabular-nums normal-case">
              {tempRange[0]}° – {tempRange[1]}°C
            </span>
          </div>
          <div className="rounded-3xl bg-water-50/70 border border-water-100 px-4 py-3">
            <div className="flex items-center justify-between text-[10px] font-medium text-slate-500 mb-1">
              <span>Min</span><span>Max</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range" min={-5} max={35} step={1}
                value={tempRange[0]}
                onChange={(e) => setTempRange([Math.min(parseInt(e.target.value), tempRange[1] - 1), tempRange[1]])}
                className="flex-1 accent-water-500 h-2"
                aria-label={`Minimum temperature ${tempRange[0]}°C`}
              />
              <input
                type="range" min={-5} max={35} step={1}
                value={tempRange[1]}
                onChange={(e) => setTempRange([tempRange[0], Math.max(parseInt(e.target.value), tempRange[0] + 1)])}
                className="flex-1 accent-water-500 h-2"
                aria-label={`Maximum temperature ${tempRange[1]}°C`}
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { label: "❄ Cold-plunge", range: [0, 12] as [number, number] },
              { label: "🌊 Fresh",       range: [12, 18] as [number, number] },
              { label: "☀️ Pleasant",    range: [18, 24] as [number, number] },
              { label: "🔥 Warm",        range: [22, 35] as [number, number] },
            ].map((p) => {
              const active = tempRange[0] === p.range[0] && tempRange[1] === p.range[1];
              return (
                <button
                  key={p.label}
                  onClick={() => setTempRange(p.range)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium border transition",
                    active
                      ? "bg-water-500 text-white border-water-600 shadow"
                      : "bg-white text-slate-700 border-water-200 hover:bg-water-50",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center justify-between">
            <span>{t("filter.country")}</span>
            {countryFilter !== "all" && (
              <button
                onClick={() => setCountryFilter("all")}
                className="text-water-600 font-medium normal-case text-[11px] hover:underline"
              >
                {t("filter.clear")}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCountryFilter("all")}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium border transition",
                countryFilter === "all"
                  ? "bg-water-500 text-white border-water-600 shadow"
                  : "bg-white text-slate-700 border-water-200 hover:bg-water-50",
              )}
            >
              All
            </button>
            {countries.map((c) => (
              <button
                key={c}
                onClick={() => setCountryFilter(c)}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium border transition tabular-nums",
                  countryFilter === c
                    ? "bg-water-500 text-white border-water-600 shadow"
                    : "bg-white text-slate-700 border-water-200 hover:bg-water-50",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center justify-between">
            <span>Type of water</span>
            {typeFilter !== "all" && (
              <button
                onClick={() => setTypeFilter("all")}
                className="text-water-600 font-medium normal-case text-[11px] hover:underline"
              >
                {t("filter.clear")}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setTypeFilter("all")}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium border transition capitalize",
                typeFilter === "all"
                  ? "bg-water-500 text-white border-water-600 shadow"
                  : "bg-white text-slate-700 border-water-200 hover:bg-water-50",
              )}
            >
              All
            </button>
            {types.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium border transition capitalize",
                  typeFilter === t
                    ? "bg-water-500 text-white border-water-600 shadow"
                    : "bg-white text-slate-700 border-water-200 hover:bg-water-50",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{t("filter.sortBy")}</div>
          <div className="flex flex-wrap gap-2">
            {([
              ["importance", `⭐ ${t("sort.top")}`],
              ["warmest",    `🔥 ${t("sort.warmest")}`],
              ["coldest",    `❄ ${t("sort.coldest")}`],
              ["area",       `🌊 ${t("sort.area")}`],
              ["name",       `🔤 ${t("sort.name")}`],
            ] as const).map(([s, label]) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium border transition",
                  sortBy === s
                    ? "bg-water-500 text-white border-water-600 shadow"
                    : "bg-white text-slate-700 border-water-200 hover:bg-water-50",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{t("filter.swim")}</div>
          <div className="grid grid-cols-4 gap-1.5 rounded-2xl bg-water-50 p-1" role="radiogroup" aria-label={t("filter.swim")}>
            {(
              [
                ["all",       t("filter.swim.all")],
                ["swimmable", t("filter.swim.swimmable")],
                ["warm",      t("filter.swim.warm")],
                ["cold",      t("filter.swim.cold")],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                role="radio"
                aria-checked={swimFilter === v}
                onClick={() => setSwimFilter(v)}
                className={cn(
                  "rounded-xl px-2 py-2 text-sm font-medium transition",
                  swimFilter === v
                    ? "bg-white shadow-sm text-water-800"
                    : "text-slate-600 hover:bg-white/70",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{t("filter.size")}</div>
          <div className="grid grid-cols-4 gap-1.5 rounded-2xl bg-water-50 p-1" role="radiogroup" aria-label={t("filter.size")}>
            {(
              [
                ["all",    t("filter.size.all")],
                ["small",  t("filter.size.small")],
                ["medium", t("filter.size.medium")],
                ["large",  t("filter.size.large")],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                role="radio"
                aria-checked={sizeFilter === v}
                onClick={() => setSizeFilter(v)}
                className={cn(
                  "rounded-xl px-2 py-2 text-sm font-medium transition",
                  sizeFilter === v
                    ? "bg-white shadow-sm text-water-800"
                    : "text-slate-600 hover:bg-white/70",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <label className="flex items-center justify-between text-sm cursor-pointer p-3 rounded-2xl bg-water-50/50 border border-water-100/70">
            <span className="font-medium text-slate-700">{t("filter.hasPhoto")}</span>
            <span
              role="switch"
              aria-checked={photoOnly}
              onClick={() => setPhotoOnly(!photoOnly)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition",
                photoOnly ? "bg-water-500" : "bg-slate-300",
              )}
            >
              <span
                className={cn(
                  "inline-block h-5 w-5 rounded-full bg-white shadow transform transition",
                  photoOnly ? "translate-x-5" : "translate-x-0.5",
                )}
              />
            </span>
          </label>
        </section>
      </div>

      <div
        className="shrink-0 border-t border-water-100/70 px-4 pt-3 pb-4 flex gap-2 bg-white"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
      >
        <button
          onClick={clearAll}
          className="rounded-full bg-water-50 hover:bg-water-100 text-water-800 font-semibold py-3.5 px-6 transition"
        >
          {t("filter.reset")}
        </button>
        <button
          onClick={onClose}
          className="flex-1 rounded-full bg-water-500 hover:bg-water-600 text-white font-semibold py-3.5 px-5 shadow-[0_4px_16px_rgba(14,165,233,0.35)] transition flex items-center justify-center gap-2"
        >
          Show {count} {count === 1 ? "lake" : "lakes"} on map
        </button>
      </div>
    </div>
  );
}

// ---------- SELECTED SHEET (bottom card / side card) ----------
function SelectedSheet({ lake, onClose }: { lake: LakeMarker; onClose: () => void }) {
  const t = useT();
  const bucket = bucketForTemp(lake.temp_c);
  const swim = assessSwim({ water_c: lake.temp_c });

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="absolute left-3 right-3 bottom-3 sm:left-auto sm:right-4 sm:bottom-4 sm:w-[380px] z-40 rounded-4xl overflow-hidden bg-white/95 backdrop-blur-xl shadow-[0_20px_60px_rgba(14,165,233,0.25)] border border-white/60 safe-b">
      <div
        className="relative px-5 pt-5 pb-4 text-white"
        style={{ background: `linear-gradient(135deg, ${bucket.color}, #0369A1)` }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 z-10 rounded-full h-9 w-9 flex items-center justify-center bg-white/25 hover:bg-white/40 text-white transition backdrop-blur"
          aria-label={t("map.closeDetails")}
          title={t("map.close")}
        >
          <X className="h-5 w-5" />
        </button>
        <div className="text-[10px] uppercase tracking-wider opacity-90 pr-10">
          {lake.country_code} · {lake.type}
        </div>
        <div className="mt-1 text-xl font-semibold leading-tight pr-10">{lake.name}</div>
        {lake.name_local && lake.name_local !== lake.name && (
          <div className="text-xs opacity-90 pr-10">{lake.name_local}</div>
        )}
        <div className="mt-4 flex items-end gap-4">
          <div className="text-5xl font-semibold tabular-nums leading-none">{formatTemp(lake.temp_c, 1)}</div>
          <div className="text-xs opacity-90 pb-1">
            <div className="font-semibold">{t(swim.headlineKey)}</div>
            <div>{lake.measured_at ? <><span>{t("map.updatedPrefix")}</span> <RelativeTime iso={lake.measured_at} /></> : t("map.noRecent")}</div>
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
