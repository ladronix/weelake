import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Wind, Sun, CloudRain, Thermometer } from "lucide-react";
import { Nav } from "@/components/layout/nav";
import { Footer } from "@/components/layout/footer";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { fetchWeather, fetchMarineWaterTemp, conditionFromCode } from "@/lib/openmeteo";
import { bucketForTemp, formatTemp, assessSwim, relativeTime } from "@/lib/temperature";
import { HistoryChart } from "@/components/detail/history-chart";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createSupabaseServiceClient();
  const { data: lake } = await supabase
    .from("lakes")
    .select("name, country_code")
    .eq("slug", slug)
    .maybeSingle();

  if (!lake) return { title: "Lake" };
  return {
    title: `${lake.name} water temperature`,
    description: `Live water temperature and 7-day history for ${lake.name} (${lake.country_code}).`,
  };
}

export default async function LakeDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createSupabaseServiceClient();

  const { data: lake } = await supabase
    .from("lakes")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!lake) notFound();

  const [{ data: current }, { data: history }] = await Promise.all([
    supabase.from("lakes_current").select("*").eq("lake_id", lake.id).maybeSingle(),
    supabase
      .from("lakes_history")
      .select("temp_c, measured_at, source")
      .eq("lake_id", lake.id)
      .gte("measured_at", new Date(Date.now() - 8 * 24 * 3600e3).toISOString())
      .order("measured_at", { ascending: true }),
  ]);

  let temp_c: number | null = current?.temp_c ? Number(current.temp_c) : null;
  let measured_at = current?.measured_at ?? null;
  let source = current?.source ?? null;

  // Live weather + fallback water temp
  const [weather, marine] = await Promise.all([
    fetchWeather(lake.lat, lake.lng).catch(() => null),
    !current ? fetchMarineWaterTemp(lake.lat, lake.lng).catch(() => null) : Promise.resolve(null),
  ]);
  if (temp_c == null && marine) {
    temp_c = marine.temp_c;
    measured_at = marine.measured_at;
    source = "openmeteo_marine";
  }

  const bucket = bucketForTemp(temp_c);
  const assessment = assessSwim({
    water_c: temp_c,
    air_c: weather?.current.temperature_2m ?? null,
    wind_kmh: weather?.current.wind_speed_10m ?? null,
    uv: weather?.uv_index ?? null,
  });

  const forecast = weather?.daily
    ? weather.daily.time.map((date, i) => ({
        date,
        air_max: weather.daily.temperature_2m_max[i],
        air_min: weather.daily.temperature_2m_min[i],
        wind_max: weather.daily.wind_speed_10m_max[i],
        uv_max: weather.daily.uv_index_max[i],
        precip: weather.daily.precipitation_sum[i],
        cond: conditionFromCode(weather.daily.weather_code[i]),
      }))
    : [];

  const chartData = (history ?? []).map((h) => ({
    time: new Date(h.measured_at).toLocaleDateString(undefined, { weekday: "short", day: "numeric" }),
    temp: Number(h.temp_c),
  }));

  return (
    <>
      <Nav />
      <main className="section pt-6 pb-16">
        <Link href="/map" className="inline-flex items-center gap-1 text-sm text-water-700 hover:text-water-900 transition">
          <ArrowLeft className="h-4 w-4" /> Back to map
        </Link>

        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          {/* LEFT · big card */}
          <div className="lg:col-span-2 space-y-6">
            <div
              className="rounded-4xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${bucket.color}, #0369A1)` }}
            >
              <div className="text-xs uppercase tracking-wide opacity-80">
                {lake.country_code} · {lake.type}
              </div>
              <h1 className="mt-1 text-3xl sm:text-5xl font-semibold tracking-tight">
                {lake.name}
              </h1>
              {lake.name_local && lake.name_local !== lake.name && (
                <div className="opacity-90">{lake.name_local}</div>
              )}
              <div className="mt-6 flex flex-wrap items-end gap-6">
                <div>
                  <div className="text-6xl sm:text-7xl font-semibold tabular-nums leading-none">
                    {formatTemp(temp_c, 1)}
                  </div>
                  <div className="mt-2 text-lg opacity-90">{assessment.headline}</div>
                </div>
                <div className="text-xs opacity-80">
                  {measured_at ? `Updated ${relativeTime(measured_at)}` : "No recent reading"}<br />
                  {source && <>Source: {source.replace(/_/g, " ")}</>}
                </div>
              </div>

              {(assessment.warnings.length > 0 || assessment.reasons.length > 0) && (
                <div className="mt-6 space-y-1 text-sm">
                  {assessment.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="mt-0.5">⚠</span><span>{w}</span>
                    </div>
                  ))}
                  {assessment.reasons.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 opacity-85">
                      <span className="mt-0.5">·</span><span>{r}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass rounded-4xl p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-deep flex items-center gap-2">
                <Thermometer className="h-4 w-4 text-water-600" /> 7-day water temperature
              </h2>
              <div className="mt-4 h-64">
                {chartData.length > 1
                  ? <HistoryChart data={chartData} color={bucket.color} />
                  : <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                      Building history — check back tomorrow.
                    </div>
                }
              </div>
            </div>

            {forecast.length > 0 && (
              <div className="glass rounded-4xl p-5 sm:p-6">
                <h2 className="text-lg font-semibold text-deep">Weather forecast</h2>
                <div className="mt-3 flex overflow-x-auto no-scrollbar gap-2 -mx-1 px-1">
                  {forecast.map((f) => (
                    <div key={f.date} className="min-w-[92px] rounded-3xl bg-white/70 p-3 text-center">
                      <div className="text-xs text-slate-500">
                        {new Date(f.date).toLocaleDateString(undefined, { weekday: "short" })}
                      </div>
                      <div className="text-xs text-slate-500">{f.cond}</div>
                      <div className="mt-1 text-base font-semibold text-deep tabular-nums">
                        {f.air_max.toFixed(0)}° <span className="text-slate-400 text-sm">{f.air_min.toFixed(0)}°</span>
                      </div>
                      <div className="mt-1 text-[10px] text-slate-500 flex items-center justify-center gap-1">
                        <Wind className="h-3 w-3" /> {f.wind_max.toFixed(0)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT · meta and weather */}
          <div className="space-y-4">
            {weather?.current && (
              <div className="glass rounded-4xl p-5">
                <h2 className="text-lg font-semibold text-deep">Now</h2>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <MetaCell icon={<Thermometer className="h-3.5 w-3.5" />} label="Air" value={`${weather.current.temperature_2m.toFixed(1)}°C`} />
                  <MetaCell icon={<Wind className="h-3.5 w-3.5" />} label="Wind" value={`${weather.current.wind_speed_10m.toFixed(0)} km/h`} />
                  <MetaCell icon={<Sun className="h-3.5 w-3.5" />} label="UV" value={weather.uv_index != null ? weather.uv_index.toFixed(0) : "—"} />
                  <MetaCell icon={<CloudRain className="h-3.5 w-3.5" />} label="Rain" value={`${weather.current.precipitation.toFixed(1)} mm`} />
                </div>
              </div>
            )}

            <div className="glass rounded-4xl p-5">
              <h2 className="text-lg font-semibold text-deep">About</h2>
              <ul className="mt-3 space-y-1 text-sm text-slate-700">
                {lake.area_km2 && <li>Area: <b className="tabular-nums">{Number(lake.area_km2).toFixed(1)} km²</b></li>}
                {lake.max_depth_m && <li>Max depth: <b className="tabular-nums">{Number(lake.max_depth_m).toFixed(0)} m</b></li>}
                {lake.mean_depth_m && <li>Mean depth: <b className="tabular-nums">{Number(lake.mean_depth_m).toFixed(0)} m</b></li>}
                {lake.elevation_m != null && <li>Elevation: <b className="tabular-nums">{Number(lake.elevation_m).toFixed(0)} m</b></li>}
                {lake.region && <li>Region: <b>{lake.region}</b></li>}
                <li className="text-xs text-slate-500 pt-1">{lake.lat.toFixed(4)}, {lake.lng.toFixed(4)}</li>
              </ul>
            </div>

            <div className="flex flex-col gap-2">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${lake.lat},${lake.lng}`}
                target="_blank"
                rel="noreferrer"
                className="btn-water justify-center"
              >
                <MapPin className="h-4 w-4" /> Navigate
              </a>
              {lake.wiki_url && (
                <a href={lake.wiki_url} target="_blank" rel="noreferrer" className="btn-ghost justify-center">
                  Wikipedia
                </a>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function MetaCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 flex items-center gap-1">{icon} {label}</div>
      <div className="text-base font-semibold text-deep tabular-nums">{value}</div>
    </div>
  );
}
