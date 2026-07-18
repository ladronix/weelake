import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/layout/nav";
import { Footer } from "@/components/layout/footer";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { bucketForTemp, formatTemp } from "@/lib/temperature";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = createSupabaseServiceClient();
  const { data: country } = await supabase
    .from("countries")
    .select("name")
    .eq("code", code.toUpperCase())
    .maybeSingle();
  return { title: country ? `${country.name} lakes` : "Country" };
}

export default async function CountryPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const cc = code.toUpperCase();
  const supabase = createSupabaseServiceClient();

  const { data: country } = await supabase
    .from("countries")
    .select("*")
    .eq("code", cc)
    .maybeSingle();
  if (!country) notFound();

  const { data: lakesRaw } = await supabase
    .from("lakes")
    .select("id, slug, name, name_local, type, area_km2, lakes_current:lakes_current(temp_c, measured_at)")
    .eq("country_code", cc)
    .order("importance", { ascending: false });

  const lakes = (lakesRaw ?? []).map((l) => {
    const c = Array.isArray(l.lakes_current) ? l.lakes_current[0] : l.lakes_current;
    return { ...l, temp_c: c?.temp_c != null ? Number(c.temp_c) : null };
  });

  const temps = lakes.map((l) => l.temp_c).filter((t): t is number => t != null);
  const avg = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null;
  const max = temps.length ? Math.max(...temps) : null;
  const min = temps.length ? Math.min(...temps) : null;

  return (
    <>
      <Nav />
      <main className="section py-8">
        <Link href="/" className="text-sm text-water-700 hover:text-water-900">← Back</Link>

        <div className="mt-4 flex items-center gap-4">
          <div className="text-6xl">{country.emoji}</div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-semibold text-deep tracking-tight">{country.name}</h1>
            <div className="text-slate-600">{lakes.length} lakes tracked</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat label="Average" value={avg != null ? formatTemp(avg) : "—"} />
          <Stat label="Warmest" value={max != null ? formatTemp(max) : "—"} />
          <Stat label="Coldest" value={min != null ? formatTemp(min) : "—"} />
        </div>

        <ul className="mt-8 grid gap-2 sm:grid-cols-2">
          {lakes.map((l) => {
            const b = bucketForTemp(l.temp_c);
            return (
              <li key={l.id}>
                <Link href={`/lake/${l.slug}`} className="glass rounded-3xl flex items-center gap-3 p-3 hover:shadow-md transition">
                  <span
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-semibold shadow tabular-nums"
                    style={{ backgroundColor: b.color }}
                  >
                    {l.temp_c != null ? `${l.temp_c.toFixed(0)}°` : "?"}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium text-deep truncate">{l.name}</span>
                    <span className="block text-xs text-slate-500">{l.type}{l.area_km2 && ` · ${Number(l.area_km2).toFixed(1)} km²`}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </main>
      <Footer />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-3xl p-4 text-center">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-2xl font-semibold text-deep tabular-nums">{value}</div>
    </div>
  );
}
