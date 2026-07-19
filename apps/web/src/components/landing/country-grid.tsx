import Link from "next/link";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { bucketForTemp, formatTemp } from "@/lib/temperature";
import { ChevronRight } from "lucide-react";

export async function CountryGrid() {
  const supabase = createSupabaseServiceClient();

  // Fetch featured countries with lakes.
  const [{ data: countries }, { data: lakes }] = await Promise.all([
    supabase.from("countries").select("code, name, emoji, featured").eq("featured", true),
    supabase
      .from("lakes")
      .select("country_code, lakes_current:lakes_current(temp_c)"),
  ]);

  // Aggregate by country.
  const stats = new Map<string, { count: number; sum: number; withTemp: number }>();
  (lakes ?? []).forEach((l) => {
    const cur = Array.isArray(l.lakes_current) ? l.lakes_current[0] : l.lakes_current;
    const t = cur?.temp_c != null ? Number(cur.temp_c) : null;
    const s = stats.get(l.country_code) ?? { count: 0, sum: 0, withTemp: 0 };
    s.count += 1;
    if (t != null) { s.sum += t; s.withTemp += 1; }
    stats.set(l.country_code, s);
  });

  const rows = (countries ?? [])
    .map((c) => {
      const s = stats.get(c.code);
      const avg = s && s.withTemp > 0 ? s.sum / s.withTemp : null;
      return { ...c, count: s?.count ?? 0, avg };
    })
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <div id="countries" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {rows.map((c) => {
        const b = bucketForTemp(c.avg);
        return (
          <Link
            key={c.code}
            href={`/country/${c.code.toLowerCase()}`}
            className="group relative rounded-3xl bg-white/70 backdrop-blur-md border border-white/60 p-4 sm:p-5 shadow-[0_8px_30px_rgba(14,165,233,0.08)] hover:shadow-[0_12px_40px_rgba(14,165,233,0.16)] hover:-translate-y-0.5 transition-all overflow-hidden"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-3xl leading-none">{c.emoji}</div>
              {c.avg != null && (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow-sm tabular-nums"
                  style={{ backgroundColor: b.color }}
                >
                  {formatTemp(c.avg, 0)}
                </span>
              )}
            </div>
            <div className="mt-3 text-base font-semibold text-deep group-hover:text-water-700 transition truncate">
              {c.name}
            </div>
            <div className="mt-0.5 flex items-center justify-between text-xs text-slate-500">
              <span>{c.count} {c.count === 1 ? "lake" : "lakes"}</span>
              <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
