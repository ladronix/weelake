import Link from "next/link";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { TempPill } from "@/components/ui";
import { Flame, Snowflake, ChevronRight } from "lucide-react";

export async function HotColdLists() {
  const supabase = createSupabaseServiceClient();

  const [{ data: hottest }, { data: coldest }] = await Promise.all([
    supabase
      .from("lakes_current")
      .select("temp_c, measured_at, lakes:lakes!inner(id, slug, name, country_code, type)")
      .not("temp_c", "is", null)
      .order("temp_c", { ascending: false })
      .limit(6),
    supabase
      .from("lakes_current")
      .select("temp_c, measured_at, lakes:lakes!inner(id, slug, name, country_code, type)")
      .not("temp_c", "is", null)
      .order("temp_c", { ascending: true })
      .limit(6),
  ]);

  return (
    <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
      <List
        title="Warmest right now"
        subtitle="Best for a long swim"
        gradient="from-amber-400 to-red-500"
        icon={<Flame className="h-4 w-4 text-white" />}
        rows={hottest ?? []}
      />
      <List
        title="Coldest right now"
        subtitle="For the brave dippers"
        gradient="from-sky-400 to-indigo-600"
        icon={<Snowflake className="h-4 w-4 text-white" />}
        rows={coldest ?? []}
      />
    </div>
  );
}

function List({
  title, subtitle, gradient, icon, rows,
}: {
  title: string;
  subtitle: string;
  gradient: string;
  icon: React.ReactNode;
  rows: Array<{
    temp_c: number | string;
    lakes:
      | { slug: string; name: string; country_code: string; type: string }
      | { slug: string; name: string; country_code: string; type: string }[];
  }>;
}) {
  return (
    <div className="rounded-4xl bg-white/70 backdrop-blur-md border border-white/60 shadow-[0_8px_30px_rgba(14,165,233,0.08)] overflow-hidden">
      <div className="px-5 sm:px-6 pt-5 pb-4 flex items-center gap-3">
        <div className={`inline-flex items-center justify-center h-10 w-10 rounded-2xl bg-gradient-to-br ${gradient} shadow-md`}>
          {icon}
        </div>
        <div>
          <div className="text-base font-semibold text-deep">{title}</div>
          <div className="text-xs text-slate-500">{subtitle}</div>
        </div>
      </div>
      <ul className="divide-y divide-water-100/50">
        {rows.length === 0 && (
          <li className="px-6 py-6 text-sm text-slate-500 text-center">
            No data yet — the daily fetch is running.
          </li>
        )}
        {rows.map((r, i) => {
          const lake = Array.isArray(r.lakes) ? r.lakes[0] : r.lakes;
          if (!lake) return null;
          const temp = typeof r.temp_c === "string" ? parseFloat(r.temp_c) : r.temp_c;
          return (
            <li key={lake.slug}>
              <Link
                href={`/lake/${lake.slug}`}
                className="group flex items-center gap-3 px-5 sm:px-6 py-3 hover:bg-water-50/70 transition"
              >
                <span className="w-5 text-center text-xs font-semibold text-slate-400 tabular-nums shrink-0">
                  {i + 1}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-medium text-deep truncate group-hover:text-water-700 transition">
                    {lake.name}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {lake.country_code} · {lake.type}
                  </span>
                </span>
                <TempPill temp={temp} size="sm" precision={1} className="!rounded-full" />
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-water-500 transition shrink-0" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
