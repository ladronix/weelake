import Link from "next/link";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { bucketForTemp, formatTemp } from "@/lib/temperature";
import { Flame, Snowflake } from "lucide-react";

export async function HotColdLists() {
  const supabase = createSupabaseServiceClient();

  const [{ data: hottest }, { data: coldest }] = await Promise.all([
    supabase
      .from("lakes_current")
      .select("temp_c, measured_at, lakes:lakes!inner(id, slug, name, country_code)")
      .not("temp_c", "is", null)
      .order("temp_c", { ascending: false })
      .limit(5),
    supabase
      .from("lakes_current")
      .select("temp_c, measured_at, lakes:lakes!inner(id, slug, name, country_code)")
      .not("temp_c", "is", null)
      .order("temp_c", { ascending: true })
      .limit(5),
  ]);

  return (
    <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
      <List title="Warmest right now" icon={<Flame className="h-4 w-4 text-temp-hot" />} rows={hottest ?? []} />
      <List title="Coldest right now" icon={<Snowflake className="h-4 w-4 text-temp-cold" />} rows={coldest ?? []} />
    </div>
  );
}

function List({
  title, icon, rows,
}: {
  title: string;
  icon: React.ReactNode;
  rows: Array<{ temp_c: number | string; lakes: { slug: string; name: string; country_code: string } | { slug: string; name: string; country_code: string }[] }>;
}) {
  return (
    <div className="glass rounded-4xl p-5 sm:p-6">
      <div className="flex items-center gap-2 text-sm font-medium text-deep">
        {icon} {title}
      </div>
      <ul className="mt-3 divide-y divide-white/60">
        {rows.length === 0 && (
          <li className="py-3 text-sm text-slate-500">No data yet — waiting for the first fetch.</li>
        )}
        {rows.map((r, i) => {
          const lake = Array.isArray(r.lakes) ? r.lakes[0] : r.lakes;
          if (!lake) return null;
          const temp = typeof r.temp_c === "string" ? parseFloat(r.temp_c) : r.temp_c;
          const bucket = bucketForTemp(temp);
          return (
            <li key={lake.slug}>
              <Link href={`/lake/${lake.slug}`} className="flex items-center gap-3 py-3 hover:opacity-90 transition">
                <span className="w-5 text-center text-xs text-slate-400 tabular-nums">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-deep truncate">{lake.name}</div>
                  <div className="text-xs text-slate-500">{lake.country_code}</div>
                </div>
                <span className="temp-pill text-sm" style={{ backgroundColor: bucket.color }}>
                  {formatTemp(temp)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
