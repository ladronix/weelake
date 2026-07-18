import Link from "next/link";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { bucketForTemp, formatTemp } from "@/lib/temperature";

/**
 * Non-interactive teaser of the map: a positional gradient of markers
 * scattered over a soft map-like backdrop. Real MapLibre map lives at /map.
 * Server-rendered — so it participates in SEO and OG previews.
 */
export async function MiniMapPreview() {
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase
    .from("lakes")
    .select("id, slug, name, country_code, lat, lng, importance, lakes_current:lakes_current(temp_c)")
    .order("importance", { ascending: false })
    .limit(40);

  const lakes = (data ?? []).map((l) => {
    const cur = Array.isArray(l.lakes_current) ? l.lakes_current[0] : l.lakes_current;
    return { ...l, temp_c: cur?.temp_c ? Number(cur.temp_c) : null };
  });

  return (
    <Link href="/map" className="block relative rounded-4xl overflow-hidden group glass h-[420px] sm:h-[500px]">
      {/* Backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 bg-water-gradient opacity-90"
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(circle at 25% 30%, rgba(255,255,255,0.10), transparent 40%),
            radial-gradient(circle at 75% 60%, rgba(255,255,255,0.08), transparent 45%)
          `,
        }}
      />
      {/* Grid lines */}
      <svg className="absolute inset-0 h-full w-full opacity-20" aria-hidden>
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Markers positioned by lat/lng within a bounded viewport */}
      {lakes.map((l) => {
        // Simple equirectangular projection covering Europe + world extremes.
        const x = ((l.lng + 180) / 360) * 100;
        const y = ((90 - l.lat) / 180) * 100;
        const bucket = bucketForTemp(l.temp_c);
        return (
          <div
            key={l.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform group-hover:scale-110"
            style={{ left: `${x}%`, top: `${y}%` }}
            title={`${l.name} — ${formatTemp(l.temp_c)}`}
          >
            <div
              className="rounded-full h-3 w-3 sm:h-3.5 sm:w-3.5 border-2 border-white shadow-lg animate-wave"
              style={{ backgroundColor: bucket.color, animationDelay: `${(l.importance ?? 5) * 0.1}s` }}
            />
          </div>
        );
      })}

      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
        <div className="glass rounded-full px-4 py-2 text-sm font-medium text-deep">
          {lakes.length} lakes on the map
        </div>
        <div className="glass rounded-full px-4 py-2 text-sm font-medium text-water-700">
          Open the full map →
        </div>
      </div>
    </Link>
  );
}
