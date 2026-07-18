import Link from "next/link";
import { createSupabaseServiceClient } from "@/lib/supabase";

export async function CountryGrid() {
  const supabase = createSupabaseServiceClient();
  const { data: rows } = await supabase
    .from("countries")
    .select("code, name, emoji, featured")
    .eq("featured", true)
    .order("name");

  // Fetch per-country lake counts in a single query.
  const { data: perCountry } = await supabase
    .from("lakes")
    .select("country_code");
  const counts = new Map<string, number>();
  (perCountry ?? []).forEach((r) => counts.set(r.country_code, (counts.get(r.country_code) ?? 0) + 1));

  const countries = (rows ?? []).map((c) => ({ ...c, count: counts.get(c.code) ?? 0 }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <div id="countries" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {countries.map((c) => (
        <Link
          key={c.code}
          href={`/country/${c.code.toLowerCase()}`}
          className="group glass rounded-3xl p-4 sm:p-5 hover:shadow-lg hover:-translate-y-0.5 transition"
        >
          <div className="text-3xl">{c.emoji}</div>
          <div className="mt-2 text-sm text-slate-500">{c.count} lakes</div>
          <div className="mt-1 text-base font-semibold text-deep group-hover:text-water-700 transition">
            {c.name}
          </div>
        </Link>
      ))}
    </div>
  );
}
