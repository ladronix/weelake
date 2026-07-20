"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import maplibregl, { Map } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Layers, Locate, Minus, Plus, X, Search,
  Thermometer, Waves, Filter, ChevronRight, ChevronLeft, ChevronUp,
  Sparkles, Navigation2, Map as MapIcon, Moon, Sun, CloudRain,
  Satellite as SatIcon,
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

type BasemapKey = "light" | "dark" | "streets" | "satellite";

// Style URLs — all free, no API key required. Kept intentionally small:
//   - light / dark : CARTO Positron / Dark Matter (OSM data, minimal road
//                    clutter, water-first palette). Default is 'light'.
//   - streets      : CARTO Voyager (OSM data, roads + POIs visible; good
//                    when the user is scouting a drive to a lake).
//   - satellite    : Esri World Imagery (aerial photography, no labels).
const BASEMAPS: Record<BasemapKey, { label: string; icon: typeof MapIcon; style: unknown }> = {
  light: { label: "Light", icon: Sun,  style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json" },
  dark:  { label: "Dark",  icon: Moon, style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json" },
  streets: {
    label: "Streets",
    icon: MapIcon,
    style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  },
  satellite: {
    label: "Satellite",
    icon: SatIcon,
    style: {
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
    },
  },
};

type SortKey = "importance" | "warmest" | "coldest" | "name" | "distance" | "area";

export function MapView() {
  const t = useT();
  const p = useP();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const [lakes, setLakes] = useState<LakeMarker[]>([]);
  const [selected, setSelected] = useState<LakeMarker | null>(null);
  const [showList, setShowList] = useState(true);
  const [mobilePanel, setMobilePanel] = useState<"peek" | "half" | "full" | "hidden">("peek");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showRadar, setShowRadar] = useState(false);
  // Rain-radar tile URL. RainViewer publishes a manifest with the last
  // ~2 hours of radar frames; we pick the newest and turn it into an
  // XYZ tile URL. The manifest is refreshed hourly.
  const [radarTileUrl, setRadarTileUrl] = useState<string | null>(null);
  const [basemap, setBasemap] = useState<BasemapKey>("light");
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

  // Remember the camera position from just BEFORE the user zoomed into
  // a selected lake, so we can smoothly fly back when the sheet closes.
  // A ref (not state) — no rerenders needed, and we clear it as soon
  // as the sheet closes so a subsequent open doesn't restore stale.
  const preZoomCameraRef = useRef<{ center: [number, number]; zoom: number } | null>(null);

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
      // Under React StrictMode / HMR the effect can unmount while the
      // initial style fetch is still in flight; `map.remove()` will
      // then throw an AbortError as MapLibre tries to reject the
      // pending request. Swallow it — the map is going away anyway.
      try {
        map.remove();
      } catch {
        /* aborted style fetch — harmless during dev remounts */
      }
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch basemap.
  //
  // MapLibre's `setStyle()` wipes any runtime-added source/layer by
  // default. Its `transformStyle(previous, next)` callback lets us
  // splice our custom stuff into the new style before it's committed,
  // so the swap is atomic — no flicker, no missing layers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const style = BASEMAPS[basemap].style;

    // transformStyle receives the previous fully-loaded style spec
    // (may be null on the very first call) and the incoming style
    // spec. We return a merged style that carries our lake-points
    // source + lake-* layers over.
    type StyleSpec = {
      sources?: Record<string, unknown>;
      layers?: Array<{ id: string; [k: string]: unknown }>;
      [k: string]: unknown;
    };
    const transformStyle = (previous: StyleSpec | null | undefined, next: StyleSpec): StyleSpec => {
      if (!previous) return next;
      const keepSources: Record<string, unknown> = {};
      const keepLayers: Array<{ id: string; [k: string]: unknown }> = [];
      const KEEP_PREFIXES = ["lake-", "user-loc"];
      for (const [id, src] of Object.entries(previous.sources ?? {})) {
        if (KEEP_PREFIXES.some((p) => id.startsWith(p))) keepSources[id] = src;
      }
      for (const layer of previous.layers ?? []) {
        if (KEEP_PREFIXES.some((p) => layer.id.startsWith(p))) keepLayers.push(layer);
      }
      return {
        ...next,
        sources: { ...(next.sources ?? {}), ...keepSources },
        layers: [...(next.layers ?? []), ...keepLayers],
      };
    };

    map.setStyle(style as never, { diff: false, transformStyle } as never);
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
  // --------------------------------------------------------------------
  // Install the lake source + layers.
  //
  // MapLibre's `setStyle()` wipes any source/layer we added at runtime
  // (they're not part of the style spec MapLibre knows about). The only
  // event that fires reliably ONCE per new style, after glyphs + tiles
  // are ready, is `style.load`. So we install here every time that
  // fires — first mount + every basemap switch — and rely on the
  // separate data effect to keep the source up to date without a
  // reinstall.
  //
  // Interactions (click on cluster / dot / label) are bound once here
  // per style. `filteredRef.current` is used inside the click closure
  // so it always sees the newest array (see also the useRef mirror).
  // --------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const installLayers = () => {
      // Guard: don't re-install if source is already present (e.g. HMR).
      if (map.getSource("lake-points")) return;

      const emptyFc = { type: "FeatureCollection" as const, features: [] as never[] };

      map.addSource("lake-points", {
        type: "geojson",
        data: emptyFc,
        cluster: true,
        clusterRadius: 55,
        clusterMaxZoom: 8,
        clusterProperties: {
          tempSum: ["+", ["get", "temp"]],
          tempCount: ["+", 1],
          maxImportance: ["max", ["get", "importance"]],
        },
      });

      map.addLayer({
        id: "lake-heatmap",
        type: "heatmap",
        source: "lake-points",
        maxzoom: 9,
        // Skip cluster features — they don't carry a `temp` property
        // (only tempSum + tempCount aggregates), which triggers a null
        // warning inside the heatmap-weight interpolate expression.
        filter: ["!", ["has", "point_count"]],
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
            18,
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
            3, 11,
            6, 13,
            9, 14,
          ],
          "text-allow-overlap": false,
          "text-ignore-placement": false,
          "symbol-sort-key": ["-", 10, ["get", "importance"]],
          "text-padding": 4,
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": TEMP_COLOR_RAMP as never,
          // Fatter halo makes the pill background bigger and gives more
          // contrast against dark basemaps, where the white number would
          // otherwise blend into the light-yellow / light-cyan temperature
          // tint. The blur softens the outer edge into a pill shape.
          "text-halo-width": 10,
          "text-halo-blur": 1.2,
        },
      });

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
        "lake-labels",
      );

      // Interactions.
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

      const openFeature = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
        const f = e.features?.[0];
        if (!f) return;
        const props = f.properties as { id: string };
        const target = filteredRef.current.find((l) => l.id === props.id);
        if (!target || f.geometry.type !== "Point") return;
        const [lng, lat] = f.geometry.coordinates;
        // Remember where the user was before we zoom in, so closing the
        // sheet can smoothly fly them back. Only capture on the FIRST
        // open — a second click without closing shouldn't overwrite.
        if (!preZoomCameraRef.current) {
          const c = map.getCenter();
          preZoomCameraRef.current = { center: [c.lng, c.lat], zoom: map.getZoom() };
        }
        setSelected(target);
        map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 7), duration: 700 });
      };
      map.on("click", "lake-labels", openFeature);
      map.on("click", "lake-dots", openFeature);

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
      map.on("mouseenter", "lake-clusters", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "lake-clusters", () => { map.getCanvas().style.cursor = ""; });

      // Immediately seed the source with whatever `filteredRef.current` is —
      // otherwise we'd wait for the next `filtered` change to push data,
      // which never happens on a plain style-swap.
      const src = map.getSource("lake-points") as maplibregl.GeoJSONSource | undefined;
      if (src) {
        const features = filteredRef.current
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
        src.setData({ type: "FeatureCollection", features });
      }
    };

    // MapLibre fires `style.load` once per style — first mount + every
    // setStyle() call. If the style is already loaded at mount time
    // (unlikely but possible under HMR) we call it directly.
    if (map.isStyleLoaded()) installLayers();
    map.on("styledata", installLayers);
    // Also install once initial `load` fires — MapLibre only fires
    // `style.load` on setStyle(), not on the very first init. Belt and
    // braces: `map.once("load", installLayers)` catches the first paint.
    map.once("load", installLayers);

    return () => {
      map.off("styledata", installLayers);
    };
    // Deliberately empty deps: register the install listener ONCE. It
    // will re-fire on every subsequent `setStyle()` (which triggers a
    // fresh `style.load`), keeping our sources+layers alive across
    // basemap swaps without any React-side re-registration race.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------------------------------------------------------------------
  // Push data into the lake-points source whenever `filtered` changes.
  // This effect does NOT touch layers; it only calls `setData` on an
  // existing source. If the source isn't installed yet (style still
  // loading) the effect no-ops and will pick up the next filtered
  // update — or the style.load install effect will already have
  // seeded it via setData below.
  // --------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const pushData = () => {
      const src = map.getSource("lake-points") as maplibregl.GeoJSONSource | undefined;
      if (!src) return;
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
      src.setData({ type: "FeatureCollection", features });
    };

    pushData();
    // If we mount right after basemap switch, the source may not yet
    // exist — retry once on the next style.load.
    map.on("styledata", pushData);
    return () => { map.off("styledata", pushData); };
  }, [filtered]);

  // Toggle heatmap visibility separately from data + install.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (map.getLayer("lake-heatmap")) {
        map.setLayoutProperty("lake-heatmap", "visibility", showHeatmap ? "visible" : "none");
      }
    };
    apply();
    map.on("styledata", apply);
    return () => { map.off("styledata", apply); };
  }, [showHeatmap]);

  // Fetch the latest RainViewer manifest once the user asks to see rain.
  // Cached on the module scope in-memory for the lifetime of the tab
  // (the manifest updates every 10 minutes upstream; refetching on
  // every toggle would be wasteful).
  useEffect(() => {
    if (!showRadar || radarTileUrl) return;
    let cancelled = false;
    fetch("https://api.rainviewer.com/public/weather-maps.json")
      .then((r) => r.json())
      .then((data: {
        host: string;
        radar?: { past?: Array<{ path: string; time: number }> };
      }) => {
        if (cancelled) return;
        const frames = data.radar?.past ?? [];
        const latest = frames[frames.length - 1];
        if (!latest) return;
        // 512-px tiles, colour scheme 2 (rainbow), smoothing on, snow off.
        setRadarTileUrl(`${data.host}${latest.path}/512/{z}/{x}/{y}/2/1_0.png`);
      })
      .catch(() => { /* radar remains unavailable — silent */ });
    return () => { cancelled = true; };
  }, [showRadar, radarTileUrl]);

  // Install / remove the rain-radar raster layer as showRadar toggles.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const install = () => {
      if (!showRadar || !radarTileUrl) return;
      if (map.getSource("rain-radar")) return;
      map.addSource("rain-radar", {
        type: "raster",
        tiles: [radarTileUrl],
        tileSize: 512,
        attribution: '<a href="https://www.rainviewer.com/" target="_blank" rel="noreferrer">RainViewer</a>',
      });
      // Insert below lake-heatmap so lake pills stay on top of the rain.
      const beforeId = map.getLayer("lake-heatmap") ? "lake-heatmap" : undefined;
      map.addLayer(
        {
          id: "rain-radar",
          type: "raster",
          source: "rain-radar",
          paint: { "raster-opacity": 0.7 },
        },
        beforeId,
      );
    };

    const remove = () => {
      if (map.getLayer("rain-radar")) map.removeLayer("rain-radar");
      if (map.getSource("rain-radar")) map.removeSource("rain-radar");
    };

    if (showRadar && radarTileUrl) {
      if (map.isStyleLoaded()) install();
      map.on("styledata", install);
      return () => { map.off("styledata", install); };
    } else {
      remove();
    }
  }, [showRadar, radarTileUrl]);

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
    const map = mapRef.current;
    // Same pre-zoom capture as the layer-click path (see openFeature)
    // so a list-driven open + close cycle also flies the user back.
    if (map && !preZoomCameraRef.current) {
      const c = map.getCenter();
      preZoomCameraRef.current = { center: [c.lng, c.lat], zoom: map.getZoom() };
    }
    setSelected(l);
    map?.easeTo({ center: [l.lng, l.lat], zoom: 9, duration: 700 });
    setMobilePanel("peek");
  };

  /**
   * Close the selected-lake sheet and smoothly fly the camera back to
   * the position + zoom the user was at before they clicked into the
   * lake. If there was no pre-zoom capture (e.g. user opened via a
   * deep link with ?focus=slug) we just clear the selection and leave
   * the camera where it is.
   */
  const closeSelected = () => {
    const map = mapRef.current;
    const restore = preZoomCameraRef.current;
    preZoomCameraRef.current = null;
    setSelected(null);
    if (map && restore) {
      map.easeTo({ center: restore.center, zoom: restore.zoom, duration: 700 });
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-water-50 min-h-0">
      {/* Desktop floating side panel — an overlay on top of the map, not
          a flex column that pushes the map aside. Anchored to the top-
          left, sized to leave room for the floating nav above and the
          temperature legend below. */}
      <aside
        className={cn(
          "hidden md:flex flex-col",
          "absolute left-3 top-[112px] bottom-24 w-[340px] lg:w-[380px] z-30",
          "rounded-3xl bg-white/95 backdrop-blur-xl border border-white/60",
          "shadow-[0_10px_40px_rgba(14,165,233,0.20)] overflow-hidden",
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
          onCollapse={() => setShowList(false)}
        />
      </aside>

      {/* Map canvas + overlays */}
      <div className="relative h-full w-full min-h-0">
        <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

        {/* Desktop: pulsing search icon when the panel is collapsed.
            Click expands the panel back. */}
        {!showList && (
          <button
            type="button"
            onClick={() => setShowList(true)}
            className={cn(
              "hidden md:inline-flex absolute top-[112px] left-3 z-30",
              "h-11 w-11 items-center justify-center",
              "rounded-full bg-white/95 backdrop-blur-xl border border-white/60",
              "shadow-[0_8px_30px_rgba(14,165,233,0.20)] text-water-700",
              "hover:bg-white hover:scale-105 transition",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-water-500 focus-visible:ring-offset-2",
              "before:content-[''] before:absolute before:inset-0 before:rounded-full",
              "before:bg-water-400/50 before:animate-ping before:-z-10",
            )}
            aria-label={t("map.showList")}
            title={t("map.showList")}
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </button>
        )}

        {/* Mobile: top search + filter — sits below the floating nav */}
        <div className="md:hidden absolute top-[100px] left-3 right-3 z-30 flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-water-500 pointer-events-none" />
            <input
              type="text"
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

        {/* Top-center status bubble — shows how many lakes match the
            active filters and lets the user toggle whether the count
            reflects the whole world or just what's inside the current
            map bounds. Replaces the old separate '{n} lakes' pill that
            lived inside the sidebar and the standalone 'Search this
            area' pill floating above. */}
        <div className="hidden md:flex absolute top-[112px] left-1/2 -translate-x-1/2 z-20 items-center gap-2 rounded-full bg-white/95 backdrop-blur border border-white/60 shadow-lg pl-4 pr-1 py-1">
          <span className="text-sm font-semibold text-deep tabular-nums">
            {p("map.lakesShown", filtered.length)}
          </span>
          <button
            onClick={() => setVisibleOnly((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition border",
              visibleOnly
                ? "bg-water-500 text-white border-water-600"
                : "bg-water-50 text-water-800 border-transparent hover:bg-water-100",
            )}
            title={visibleOnly ? t("map.showAll") : t("map.onlyInView")}
          >
            <MapIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {visibleOnly ? t("map.showingArea") : t("map.searchArea")}
          </button>
        </div>

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

        {/* Right controls stack — Layers menu on top, then zoom /
            locate / reset. Extra top offset (top-[112px]) gives a
            clear vertical gap between the floating nav pill and the
            first map control, per user feedback. */}
        <div className="absolute top-[112px] right-4 z-20 flex flex-col gap-2 items-end pt-[52px] md:pt-0">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowLayerMenu((v) => !v)}
              className={cn(
                "h-11 w-11 rounded-full flex items-center justify-center transition border shadow-lg",
                showLayerMenu
                  ? "bg-water-500 text-white border-water-600"
                  : "bg-white/95 backdrop-blur text-water-700 border-white/60 hover:bg-white",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-water-500 focus-visible:ring-offset-2",
              )}
              aria-label={t("map.mapLayers")}
              aria-expanded={showLayerMenu}
              title={t("map.mapLayers")}
            >
              <Layers className="h-5 w-5" aria-hidden="true" />
            </button>
            {showLayerMenu && (
              <GlassCard variant="light" className="absolute right-0 top-14 w-64 p-3 z-50">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 px-1 font-semibold">{t("map.basemap")}</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["light", "dark", "streets", "satellite"] as BasemapKey[]).map((k) => {
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
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        {B.label}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 text-[10px] uppercase tracking-wider text-slate-500 mb-2 px-1 font-semibold">{t("map.layers")}</div>
                <label className="flex items-center justify-between gap-2 px-2 py-2 rounded-2xl hover:bg-water-50 cursor-pointer">
                  <span className="flex items-center gap-2 text-sm text-slate-700">
                    <Thermometer className="h-4 w-4 text-temp-hot" aria-hidden="true" /> {t("map.heatmap")}
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
                <label className="flex items-center justify-between gap-2 px-2 py-2 rounded-2xl hover:bg-water-50 cursor-pointer">
                  <span className="flex items-center gap-2 text-sm text-slate-700">
                    <CloudRain className="h-4 w-4 text-water-600" aria-hidden="true" /> {t("map.rainRadar")}
                  </span>
                  <span
                    role="switch"
                    aria-checked={showRadar}
                    onClick={() => setShowRadar((v) => !v)}
                    className={cn(
                      "relative inline-flex h-5 w-9 items-center rounded-full transition cursor-pointer",
                      showRadar ? "bg-water-500" : "bg-slate-300",
                    )}
                  >
                    <span className={cn(
                      "inline-block h-4 w-4 rounded-full bg-white shadow transform transition",
                      showRadar ? "translate-x-4" : "translate-x-0.5",
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

        {/* Temperature legend — pinned bottom-right, always visible.
            Independent of the side panel state, but slides horizontally
            to the LEFT of the SelectedSheet (380px + gap) when a lake
            is selected so the two don't overlap. */}
        <div
          className={cn(
            "hidden md:flex absolute bottom-4 z-10 items-center gap-2 rounded-full bg-white/95 backdrop-blur shadow-lg pl-3 pr-4 py-2 text-[11px] font-medium text-slate-700 border border-white/60 transition-[right] duration-200",
            selected ? "right-[calc(380px+1.5rem)]" : "right-4",
          )}
        >
          <Waves className="h-3.5 w-3.5 text-water-600" aria-hidden="true" />
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
            onClose={closeSelected}
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
  onCollapse?: () => void;
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
    onCollapse,
  } = props;
  const t = useT();
  const p = useP();
  // Filters section is collapsed by default so the panel opens as just
  // "search + list"; users tap the funnel icon to open the drawer.
  const [showFilters, setShowFilters] = useState(false);

  return (
    <>
      <div className="p-4 border-b border-water-100/70 space-y-3 shrink-0">
        {/* Search bar + collapse + filter-toggle */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-water-500 pointer-events-none" aria-hidden="true" />
            <input
              type="text"
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
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center transition shrink-0",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-water-500",
              showFilters
                ? "bg-water-500 text-white shadow"
                : "bg-water-50 text-water-700 hover:bg-water-100",
            )}
            aria-label={t("filter.title")}
            aria-expanded={showFilters}
          >
            <Filter className="h-4 w-4" aria-hidden="true" />
          </button>
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              className={cn(
                "hidden md:inline-flex h-10 w-10 rounded-full items-center justify-center shrink-0 transition",
                "bg-water-50 text-water-700 hover:bg-water-100",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-water-500",
              )}
              aria-label={t("map.hideList")}
              title={t("map.hideList")}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
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
      </div>

      {/* Filters drawer inside the panel — collapsed by default. Same
          controls as before, wrapped so the panel stays compact when
          the user just wants to browse the list. */}
      {showFilters && (
        <div className="p-4 border-b border-water-100/70 space-y-3 shrink-0 max-h-[45%] overflow-y-auto">
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
      )}

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
