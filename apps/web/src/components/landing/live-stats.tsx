import { createSupabaseServiceClient } from "@/lib/supabase";
import { formatTemp } from "@/lib/temperature";
import { Droplet, Globe2, Flame, Snowflake } from "lucide-react";

export async function LiveStats() {
  const supabase = createSupabaseServiceClient();

  const [{ count: totalLakes }, { data: countries }, { data: max }, { data: min }] = await Promise.all([
    supabase.from("lakes").select("*", { count: "exact", head: true }),
    supabase.from("lakes").select("country_code").limit(5000),
    supabase.from("lakes_current").select("temp_c").order("temp_c", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("lakes_current").select("temp_c").order("temp_c", { ascending: true }).limit(1).maybeSingle(),
  ]);

  const uniqueCountries = new Set((countries ?? []).map((c) => c.country_code)).size;

  const cards = [
    {
      icon: Droplet,
      label: "Lakes tracked",
      value: (totalLakes ?? 0).toLocaleString(),
      tint: "from-water-400 to-water-600",
      iconTint: "text-white",
    },
    {
      icon: Globe2,
      label: "Countries",
      value: uniqueCountries.toString(),
      tint: "from-cyan-400 to-water-500",
      iconTint: "text-white",
    },
    {
      icon: Flame,
      label: "Warmest now",
      value: max?.temp_c != null ? formatTemp(Number(max.temp_c), 0) : "—",
      tint: "from-amber-400 to-red-500",
      iconTint: "text-white",
    },
    {
      icon: Snowflake,
      label: "Coldest now",
      value: min?.temp_c != null ? formatTemp(Number(min.temp_c), 0) : "—",
      tint: "from-sky-400 to-indigo-600",
      iconTint: "text-white",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-3xl bg-white/70 backdrop-blur-md border border-white/60 p-4 sm:p-5 shadow-[0_8px_30px_rgba(14,165,233,0.08)] hover:shadow-[0_10px_40px_rgba(14,165,233,0.16)] hover:-translate-y-0.5 transition-all"
        >
          <div className={`inline-flex items-center justify-center h-9 w-9 rounded-2xl bg-gradient-to-br ${c.tint} shadow-md`}>
            <c.icon className={`h-4 w-4 ${c.iconTint}`} />
          </div>
          <div className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {c.label}
          </div>
          <div className="mt-1 text-2xl sm:text-3xl font-semibold text-deep tabular-nums leading-tight">
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}
