import Link from "next/link";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { bucketForTemp } from "@/lib/temperature";
import { TempPill } from "@/components/ui";
import { ChevronRight } from "lucide-react";

const REGION_ORDER = ["Europe", "Americas", "Oceania", "Asia", "Africa"];

export async function CountryGrid() {
  const supabase = createSupabaseServiceClient();

  const [{ data: countries }, { data: lakes }] = await Promise.all([
    supabase.from("countries").select("code, name, emoji, region, featured"),
    supabase.from("lakes").select("country_code, lakes_current:lakes_current(temp_c)"),
  ]);

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
    .filter((c) => c.count > 0);

  // Group by region
  const groups = new Map<string, typeof rows>();
  rows.forEach((r) => {
    const region = r.region ?? "Other";
    const arr = groups.get(region) ?? [];
    arr.push(r);
    groups.set(region, arr);
  });
  // Sort within each region by lake count desc
  groups.forEach((arr) => arr.sort((a, b) => b.count - a.count));

  const orderedRegions = REGION_ORDER.filter((r) => groups.has(r))
    .concat(Array.from(groups.keys()).filter((r) => !REGION_ORDER.includes(r)));

  return (
    <div id="countries" className="space-y-10">
      {orderedRegions.map((region) => {
        const list = groups.get(region)!;
        const totalLakes = list.reduce((a, c) => a + c.count, 0);
        return (
          <section key={region}>
            <div className="flex items-baseline justify-between gap-4 mb-4">
              <h3 className="text-lg sm:text-xl font-semibold text-deep tracking-tight">{region}</h3>
              <div className="text-xs text-slate-500 tabular-nums">
                {list.length} {list.length === 1 ? "country" : "countries"} · {totalLakes} lakes
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {list.map((c) => {
                return (
                  <Link
                    key={c.code}
                    href={`/country/${c.code.toLowerCase()}`}
                    className="group relative rounded-3xl bg-white/70 backdrop-blur-md border border-white/60 p-4 sm:p-5 shadow-[0_8px_30px_rgba(14,165,233,0.08)] hover:shadow-[0_12px_40px_rgba(14,165,233,0.16)] hover:-translate-y-0.5 transition-all overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-3xl leading-none">{c.emoji}</div>
                      {c.avg != null && (
                        <TempPill temp={c.avg} size="xs" precision={0} className="!rounded-full" />
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
          </section>
        );
      })}
    </div>
  );
}
