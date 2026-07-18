import { createSupabaseServiceClient } from "@/lib/supabase";
import { formatTemp } from "@/lib/temperature";
import { Droplet, Globe2, Flame, Snowflake } from "lucide-react";

export async function LiveStats() {
  const supabase = createSupabaseServiceClient();

  const [{ count: totalLakes }, { data: countries }, { data: extremes }] = await Promise.all([
    supabase.from("lakes").select("*", { count: "exact", head: true }),
    supabase.from("lakes").select("country_code").limit(1000),
    supabase
      .from("lakes_current")
      .select("temp_c, lake_id, lakes:lakes(name, slug, country_code)")
      .order("temp_c", { ascending: false })
      .limit(1),
  ]);

  const uniqueCountries = new Set((countries ?? []).map((c) => c.country_code)).size;

  const { data: max } = await supabase
    .from("lakes_current")
    .select("temp_c")
    .order("temp_c", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: min } = await supabase
    .from("lakes_current")
    .select("temp_c")
    .order("temp_c", { ascending: true })
    .limit(1)
    .maybeSingle();

  const cards = [
    { icon: Droplet, label: "Lakes tracked", value: (totalLakes ?? 0).toLocaleString(), tint: "text-water-600" },
    { icon: Globe2, label: "Countries", value: uniqueCountries.toString(), tint: "text-water-600" },
    { icon: Flame, label: "Warmest now", value: max?.temp_c != null ? formatTemp(Number(max.temp_c)) : "—", tint: "text-temp-hot" },
    { icon: Snowflake, label: "Coldest now", value: min?.temp_c != null ? formatTemp(Number(min.temp_c)) : "—", tint: "text-temp-cold" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((c) => (
        <div key={c.label} className="glass rounded-3xl p-4 sm:p-5">
          <div className={`flex items-center gap-2 ${c.tint}`}>
            <c.icon className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">{c.label}</span>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-semibold text-deep tabular-nums">
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}
