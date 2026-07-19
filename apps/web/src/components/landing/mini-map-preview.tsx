import Link from "next/link";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { bucketForTemp, formatTemp } from "@/lib/temperature";
import { ArrowUpRight, Map as MapIcon } from "lucide-react";

/**
 * Non-interactive teaser of the map:
 * an SVG-driven equirectangular projection of Europe with real temperature
 * pills placed at real lat/lng. Server-rendered for SEO & OG previews.
 */
export async function MiniMapPreview() {
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase
    .from("lakes")
    .select("id, slug, name, country_code, lat, lng, importance, lakes_current:lakes_current(temp_c)")
    .order("importance", { ascending: false })
    .limit(50);

  const lakes = (data ?? []).map((l) => {
    const cur = Array.isArray(l.lakes_current) ? l.lakes_current[0] : l.lakes_current;
    return { ...l, temp_c: cur?.temp_c != null ? Number(cur.temp_c) : null };
  });

  // Frame around Europe + mid-Atlantic for aesthetic composition.
  const BBOX = { minLng: -14, maxLng: 44, minLat: 33, maxLat: 66 };
  const inFrame = lakes.filter(
    (l) => l.lng >= BBOX.minLng && l.lng <= BBOX.maxLng && l.lat >= BBOX.minLat && l.lat <= BBOX.maxLat,
  );

  const proj = (lat: number, lng: number) => ({
    x: ((lng - BBOX.minLng) / (BBOX.maxLng - BBOX.minLng)) * 100,
    y: ((BBOX.maxLat - lat) / (BBOX.maxLat - BBOX.minLat)) * 100,
  });

  return (
    <Link
      href="/map"
      className="group block relative rounded-4xl overflow-hidden bg-gradient-to-br from-water-500 via-water-600 to-water-800 shadow-[0_20px_60px_rgba(14,165,233,0.30)] h-[380px] sm:h-[460px] border border-water-300/40"
    >
      {/* Soft blobs */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 30%, rgba(255,255,255,0.14), transparent 45%),
            radial-gradient(circle at 78% 65%, rgba(56, 189, 248, 0.35), transparent 50%)
          `,
        }}
      />
      {/* Grid */}
      <svg className="absolute inset-0 h-full w-full opacity-15" aria-hidden>
        <defs>
          <pattern id="mm-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M 48 0 L 0 0 0 48" fill="none" stroke="white" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mm-grid)" />
      </svg>

      {/* Markers */}
      {inFrame.map((l) => {
        const { x, y } = proj(l.lat, l.lng);
        const bucket = bucketForTemp(l.temp_c);
        const isImportant = (l.importance ?? 0) >= 9;
        return (
          <div
            key={l.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform duration-500 group-hover:scale-110"
            style={{ left: `${x}%`, top: `${y}%` }}
            title={`${l.name} · ${formatTemp(l.temp_c)}`}
          >
            {isImportant && l.temp_c != null ? (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow-lg ring-2 ring-white/70 tabular-nums whitespace-nowrap block"
                style={{ backgroundColor: bucket.color }}
              >
                {l.temp_c.toFixed(0)}°
              </span>
            ) : (
              <span
                className="block h-2.5 w-2.5 rounded-full border-2 border-white/80 shadow-md"
                style={{ backgroundColor: bucket.color }}
              />
            )}
          </div>
        );
      })}

      {/* Foreground labels */}
      <div className="relative z-10 h-full flex flex-col justify-between p-6 sm:p-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-md border border-white/25 px-3 py-1 text-[11px] font-medium text-white">
            <MapIcon className="h-3 w-3" />
            Live temperature map
          </div>
          <div className="mt-3 text-white text-2xl sm:text-3xl font-semibold tracking-tight">
            {inFrame.length} lakes across Europe
          </div>
          <div className="text-white/80 text-sm mt-1">
            Live water temperatures. Tap any pin for full details.
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="rounded-full bg-white/20 backdrop-blur-md border border-white/25 text-white text-xs px-3 py-1.5">
            {lakes.length} lakes total worldwide
          </div>
          <div className="rounded-full bg-white text-water-700 font-semibold text-sm px-4 py-2 flex items-center gap-1.5 shadow-lg group-hover:scale-105 transition-transform">
            Open the map <ArrowUpRight className="h-4 w-4" />
          </div>
        </div>
      </div>
    </Link>
  );
}
