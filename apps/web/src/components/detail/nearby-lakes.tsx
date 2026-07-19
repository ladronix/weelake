import Link from "next/link";
import { bucketForTemp } from "@/lib/temperature";
import { ChevronRight } from "lucide-react";
import { TLabel } from "@/components/ui";

interface Nearby {
  id: string;
  slug: string;
  name: string;
  country_code: string;
  temp_c: number | string | null;
  distance_km: number | string;
}

export function NearbyLakes({ lakes }: { lakes: Nearby[] }) {
  if (!lakes || lakes.length === 0) return null;
  return (
    <div className="rounded-4xl bg-white/80 backdrop-blur-md border border-white/60 p-5 shadow-[0_8px_30px_rgba(14,165,233,0.08)]">
      <div className="font-semibold text-deep"><TLabel tKey="detail.nearbyTitle" /></div>
      <div className="text-xs text-slate-500 mt-0.5"><TLabel tKey="detail.nearbySubtitle" /></div>
      <ul className="mt-3 space-y-1.5">
        {lakes.map((l) => {
          const t = l.temp_c != null ? Number(l.temp_c) : null;
          const b = bucketForTemp(t);
          const d = typeof l.distance_km === "string" ? parseFloat(l.distance_km) : l.distance_km;
          return (
            <li key={l.id}>
              <Link
                href={`/lake/${l.slug}`}
                className="group flex items-center gap-2.5 rounded-2xl px-2 py-1.5 hover:bg-water-50/70 transition focus:outline-none focus-visible:bg-water-50"
              >
                <span
                  className="h-8 w-8 rounded-xl flex items-center justify-center text-white text-[11px] font-bold shadow-sm tabular-nums"
                  style={{ backgroundColor: b.color }}
                >
                  {t != null ? `${t.toFixed(0)}°` : "?"}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-deep truncate group-hover:text-water-700 transition">{l.name}</span>
                  <span className="block text-[11px] text-slate-500">{l.country_code} · {d?.toFixed(0)} km</span>
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-water-500 transition" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
