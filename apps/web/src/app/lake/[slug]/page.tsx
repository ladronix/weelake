import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, MapPin, Wind, Sun, CloudRain, Thermometer,
  Waves, Info, Navigation2, Share2, ExternalLink, Map as MapIcon,
} from "lucide-react";
import { Nav } from "@/components/layout/nav";
import { Footer } from "@/components/layout/footer";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { fetchWeather, fetchMarineWaterTemp, conditionFromCode } from "@/lib/openmeteo";
import { bucketForTemp, formatTemp, assessSwim, relativeTime } from "@/lib/temperature";
import { HistoryChart } from "@/components/detail/history-chart";
import { NearbyLakes } from "@/components/detail/nearby-lakes";
import { ShareButton } from "@/components/detail/share-button";
import { WaterQualityCard } from "@/components/detail/water-quality-card";
import { TLabel, PLabel } from "@/components/ui";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createSupabaseServiceClient();
  const { data: lake } = await supabase
    .from("lakes")
    .select("name, country_code, name_local")
    .eq("slug", slug)
    .maybeSingle();

  if (!lake) return { title: "Lake" };
  return {
    title: `${lake.name} water temperature`,
    description: `Live water temperature and 7-day history for ${lake.name} (${lake.country_code}). Weather forecast and swim-safety verdict.`,
    alternates: { canonical: `/lake/${slug}` },
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

  const [{ data: current }, { data: history }, { data: nearbyRaw }] = await Promise.all([
    supabase.from("lakes_current").select("*").eq("lake_id", lake.id).maybeSingle(),
    supabase
      .from("lakes_history")
      .select("temp_c, measured_at, source")
      .eq("lake_id", lake.id)
      .gte("measured_at", new Date(Date.now() - 15 * 24 * 3600e3).toISOString())
      .order("measured_at", { ascending: true }),
    supabase.rpc("nearest_lakes", {
      in_lat: lake.lat, in_lng: lake.lng, radius_km: 800, max_results: 8,
    }),
  ]);

  let temp_c: number | null = current?.temp_c ? Number(current.temp_c) : null;
  let measured_at = current?.measured_at ?? null;
  let source = current?.source ?? null;

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
    date: h.measured_at,
    temp: Number(h.temp_c),
  }));

  const nearby = (nearbyRaw ?? []).filter((n: { slug: string }) => n.slug !== lake.slug).slice(0, 6);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: lake.name,
    description: `Live water temperature and swimming conditions for ${lake.name}.`,
    geo: {
      "@type": "GeoCoordinates",
      latitude: lake.lat,
      longitude: lake.lng,
    },
    address: { "@type": "PostalAddress", addressCountry: lake.country_code, addressRegion: lake.region },
  };

  return (
    <>
      <Nav />
      <main className="section pt-4 sm:pt-6 pb-16">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/map?focus=${lake.slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-water-800 hover:text-water-900 transition font-semibold rounded-full py-2 px-3.5 bg-white/70 backdrop-blur border border-white/60 hover:bg-white shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-water-500 focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> <TLabel tKey="detail.backToMap" />
          </Link>
          <ShareButton title={lake.name} />
        </div>

        <div className="mt-4 grid gap-5 lg:grid-cols-3">
          {/* LEFT · big hero card */}
          <div className="lg:col-span-2 space-y-5 min-w-0">
            <div
              className="relative rounded-4xl p-4 sm:p-8 text-white shadow-[0_20px_60px_rgba(14,165,233,0.20)] overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${bucket.color}, #0369A1)` }}
            >
              {/* Lake photo as a soft backdrop behind the temperature gradient.
                  Using next/image would be nicer but the photo_url points at
                  arbitrary Wikimedia hosts — keep it as a plain <img> under a
                  strong tint so we still get the temperature-coded feel. */}
              {lake.photo_url && (
                <img
                  src={lake.photo_url}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover opacity-40 mix-blend-luminosity"
                />
              )}
              <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(135deg, ${bucket.color}CC 0%, #0369A1E6 100%)`,
                }}
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage: `
                    radial-gradient(circle at 20% 20%, rgba(255,255,255,0.15), transparent 40%),
                    radial-gradient(circle at 80% 60%, rgba(255,255,255,0.10), transparent 40%)
                  `,
                }}
              />
              <div className="relative">
                <div className="text-[10px] uppercase tracking-wider opacity-90 flex items-center gap-2 flex-wrap">
                  <span className="rounded-full bg-white/20 px-2 py-0.5">{lake.country_code}</span>
                  <span>{lake.type}</span>
                  {lake.region && <span className="truncate">· {lake.region}</span>}
                </div>
                <h1 className="mt-2 text-2xl sm:text-5xl font-semibold tracking-tight break-words">
                  {lake.name}
                </h1>
                {lake.name_local && lake.name_local !== lake.name && (
                  <div className="opacity-90 text-base sm:text-lg break-words">{lake.name_local}</div>
                )}
                <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 sm:gap-x-8 sm:gap-y-4">
                  <div>
                    <div className="text-5xl sm:text-7xl font-semibold tabular-nums leading-none">
                      {formatTemp(temp_c, 1)}
                    </div>
                    <div className="mt-2 text-sm sm:text-lg opacity-95 font-medium">
                      {assessment.headline}
                    </div>
                  </div>
                  <div className="text-[11px] sm:text-xs opacity-85 space-y-0.5">
                    {measured_at && (
                      <div>
                        <TLabel tKey="detail.updated" vars={{ ago: relativeTime(measured_at) }} />
                      </div>
                    )}
                    {source && (
                      <div className="break-words">
                        <TLabel tKey="detail.source" vars={{ source: source.replace(/_/g, " ") }} />
                      </div>
                    )}
                    <div className="opacity-75">
                      <TLabel tKey="detail.quality" vars={{ q: current?.quality ?? "medium" }} />
                    </div>
                  </div>
                </div>

                {(assessment.warnings.length > 0 || assessment.reasons.length > 0) && (
                  <div className="mt-6 space-y-1.5 text-sm">
                    {assessment.warnings.map((w, i) => (
                      <div key={`w${i}`} className="flex items-start gap-2 bg-white/10 rounded-2xl px-3 py-1.5">
                        <span className="mt-0.5">⚠</span><span>{w}</span>
                      </div>
                    ))}
                    {assessment.reasons.map((r, i) => (
                      <div key={`r${i}`} className="flex items-start gap-2 opacity-90 px-3">
                        <span className="mt-0.5">·</span><span>{r}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* History chart */}
            <div className="rounded-4xl bg-white/80 backdrop-blur-md border border-white/60 p-5 sm:p-6 shadow-[0_8px_30px_rgba(14,165,233,0.08)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-2xl bg-water-100 flex items-center justify-center">
                    <Thermometer className="h-4 w-4 text-water-700" />
                  </div>
                  <div>
                    <div className="font-semibold text-deep"><TLabel tKey="detail.historyTitle" /></div>
                    <div className="text-xs text-slate-500">
                      <PLabel baseKey="detail.historyLastDays" count={chartData.length} />
                    </div>
                  </div>
                </div>
                {chartData.length > 0 && (
                  <div className="text-right">
                    <div className="text-xs text-slate-500"><TLabel tKey="detail.historyAvg" /></div>
                    <div className="text-sm font-semibold text-deep tabular-nums">
                      {formatTemp(chartData.reduce((a, b) => a + b.temp, 0) / chartData.length, 1)}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4 h-64 -ml-2">
                {chartData.length > 1
                  ? <HistoryChart data={chartData} color={bucket.color} />
                  : (
                    <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                      <TLabel tKey="detail.historyBuilding" />
                    </div>
                  )}
              </div>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
                <Info className="h-3 w-3" aria-hidden="true" />
                <span><TLabel tKey="detail.historyNote" /></span>
              </div>
            </div>

            {/* 7-day forecast */}
            {forecast.length > 0 && (
              <div className="rounded-4xl bg-white/80 backdrop-blur-md border border-white/60 p-5 sm:p-6 shadow-[0_8px_30px_rgba(14,165,233,0.08)]">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-2xl bg-water-100 flex items-center justify-center">
                    <Sun className="h-4 w-4 text-water-700" />
                  </div>
                  <div>
                    <div className="font-semibold text-deep"><TLabel tKey="detail.forecastTitle" /></div>
                    <div className="text-xs text-slate-500"><TLabel tKey="detail.forecastSubtitle" /></div>
                  </div>
                </div>
                <div className="mt-4 flex overflow-x-auto no-scrollbar gap-2 -mx-1 px-1">
                  {forecast.map((f) => (
                    <div key={f.date} className="min-w-[96px] rounded-3xl bg-water-50/60 border border-water-100/70 p-3 text-center flex-shrink-0">
                      <div className="text-xs font-semibold text-slate-600">
                        {new Date(f.date).toLocaleDateString(undefined, { weekday: "short" })}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">{f.cond}</div>
                      <div className="mt-1.5 text-base font-semibold text-deep tabular-nums">
                        {f.air_max.toFixed(0)}° <span className="text-slate-400 text-xs font-normal">{f.air_min.toFixed(0)}°</span>
                      </div>
                      <div className="mt-1 text-[10px] text-slate-500 flex items-center justify-center gap-1">
                        <Wind className="h-3 w-3" /> {f.wind_max.toFixed(0)}
                      </div>
                      {f.precip > 0 && (
                        <div className="mt-0.5 text-[10px] text-water-600 flex items-center justify-center gap-1">
                          <CloudRain className="h-3 w-3" /> {f.precip.toFixed(1)}mm
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT · sidebar */}
          <div className="space-y-4 min-w-0">
            {weather?.current && (
              <div className="rounded-4xl bg-white/80 backdrop-blur-md border border-white/60 p-5 shadow-[0_8px_30px_rgba(14,165,233,0.08)]">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-2xl bg-water-100 flex items-center justify-center">
                    <Waves className="h-4 w-4 text-water-700" />
                  </div>
                  <div>
                    <div className="font-semibold text-deep"><TLabel tKey="detail.conditionsTitle" /></div>
                    <div className="text-xs text-slate-500">{conditionFromCode(weather.current.weather_code)}</div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <MetaCell icon={<Thermometer className="h-3.5 w-3.5" />} labelKey="detail.condAir" value={`${weather.current.temperature_2m.toFixed(1)}°C`} />
                  <MetaCell icon={<Wind className="h-3.5 w-3.5" />} labelKey="detail.condWind" value={`${weather.current.wind_speed_10m.toFixed(0)} km/h`} />
                  <MetaCell icon={<Sun className="h-3.5 w-3.5" />} labelKey="detail.condUv" value={weather.uv_index != null ? weather.uv_index.toFixed(0) : "—"} />
                  <MetaCell icon={<CloudRain className="h-3.5 w-3.5" />} labelKey="detail.condRain" value={`${weather.current.precipitation.toFixed(1)} mm`} />
                </div>
              </div>
            )}

            <WaterQualityCard
              quality_index={current?.quality_index ?? null}
              algae_risk={current?.algae_risk ?? null}
              turbidity_ntu={current?.turbidity_ntu != null ? Number(current.turbidity_ntu) : null}
            />

            <div className="rounded-4xl bg-white/80 backdrop-blur-md border border-white/60 p-5 shadow-[0_8px_30px_rgba(14,165,233,0.08)]">
              <div className="font-semibold text-deep"><TLabel tKey="detail.aboutTitle" /></div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                {lake.area_km2 && (
                  <>
                    <dt className="text-slate-500"><TLabel tKey="detail.area" /></dt>
                    <dd className="font-medium text-deep tabular-nums text-right">{Number(lake.area_km2).toFixed(1)} km²</dd>
                  </>
                )}
                {lake.max_depth_m && (
                  <>
                    <dt className="text-slate-500"><TLabel tKey="detail.maxDepth" /></dt>
                    <dd className="font-medium text-deep tabular-nums text-right">{Number(lake.max_depth_m).toFixed(0)} m</dd>
                  </>
                )}
                {lake.mean_depth_m && (
                  <>
                    <dt className="text-slate-500"><TLabel tKey="detail.meanDepth" /></dt>
                    <dd className="font-medium text-deep tabular-nums text-right">{Number(lake.mean_depth_m).toFixed(0)} m</dd>
                  </>
                )}
                {lake.elevation_m != null && (
                  <>
                    <dt className="text-slate-500"><TLabel tKey="detail.elevation" /></dt>
                    <dd className="font-medium text-deep tabular-nums text-right">{Number(lake.elevation_m).toFixed(0)} m</dd>
                  </>
                )}
                <dt className="text-slate-500"><TLabel tKey="detail.type" /></dt>
                <dd className="font-medium text-deep text-right capitalize">{lake.type}</dd>
                <dt className="text-slate-500"><TLabel tKey="detail.coordinates" /></dt>
                <dd className="font-medium text-deep tabular-nums text-right text-xs">{lake.lat.toFixed(3)}, {lake.lng.toFixed(3)}</dd>
              </dl>
            </div>

            <div className="flex flex-col gap-2">
              <Link
                href={`/map?focus=${lake.slug}`}
                className="rounded-full bg-water-500 hover:bg-water-600 text-white font-semibold py-3 px-5 shadow-[0_4px_16px_rgba(14,165,233,0.35)] transition flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-water-500 focus-visible:ring-offset-2"
              >
                <MapIcon className="h-4 w-4" aria-hidden="true" /> <TLabel tKey="detail.showOnMap" />
              </Link>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${lake.lat},${lake.lng}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-white/80 hover:bg-white border border-water-200 text-water-800 font-medium py-2.5 px-5 transition flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-water-500 focus-visible:ring-offset-2"
              >
                <Navigation2 className="h-4 w-4" aria-hidden="true" /> <TLabel tKey="detail.navigate" />
              </a>
              {lake.wiki_url && (
                <a
                  href={lake.wiki_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-water-50 hover:bg-water-100 text-water-800 font-medium py-2.5 px-5 transition flex items-center justify-center gap-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-water-500 focus-visible:ring-offset-2"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" /> <TLabel tKey="detail.wikipedia" />
                </a>
              )}
            </div>

            <NearbyLakes lakes={nearby} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function MetaCell({ icon, labelKey, value }: { icon: React.ReactNode; labelKey: string; value: string }) {
  return (
    <div className="rounded-2xl bg-water-50/60 border border-water-100/60 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1">{icon} <TLabel tKey={labelKey} /></div>
      <div className="mt-0.5 text-base font-semibold text-deep tabular-nums">{value}</div>
    </div>
  );
}
