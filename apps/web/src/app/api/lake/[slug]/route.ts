import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { fetchWeather, fetchMarineWaterTemp, conditionFromCode } from "@/lib/openmeteo";

/**
 * GET /api/lake/[slug]
 * Returns lake meta + current temp + weather + 7-day history.
 * Weather is fetched live from Open-Meteo (cached at HTTP layer).
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const supabase = createSupabaseServiceClient();

  const { data: lake, error } = await supabase
    .from("lakes")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!lake)   return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [{ data: current }, { data: history }] = await Promise.all([
    supabase.from("lakes_current").select("*").eq("lake_id", lake.id).maybeSingle(),
    supabase
      .from("lakes_history")
      .select("temp_c, measured_at, source")
      .eq("lake_id", lake.id)
      .gte("measured_at", new Date(Date.now() - 8 * 24 * 3600e3).toISOString())
      .order("measured_at", { ascending: true }),
  ]);

  // Weather live (Open-Meteo) — non-fatal on failure.
  let weather: Awaited<ReturnType<typeof fetchWeather>> = null;
  let marineTemp: Awaited<ReturnType<typeof fetchMarineWaterTemp>> = null;
  try {
    [weather, marineTemp] = await Promise.all([
      fetchWeather(lake.lat, lake.lng),
      // Fallback if no cached temp:
      !current ? fetchMarineWaterTemp(lake.lat, lake.lng) : Promise.resolve(null),
    ]);
  } catch (e) {
    console.warn("[api/lake] weather fetch failed", e);
  }

  const forecast = weather?.daily
    ? weather.daily.time.map((date, i) => ({
        date,
        air_temp_max_c: weather!.daily.temperature_2m_max[i],
        air_temp_min_c: weather!.daily.temperature_2m_min[i],
        wind_speed_max_kmh: weather!.daily.wind_speed_10m_max[i],
        uv_index_max: weather!.daily.uv_index_max[i],
        precipitation_mm: weather!.daily.precipitation_sum[i],
        condition: conditionFromCode(weather!.daily.weather_code[i]),
      }))
    : [];

  return NextResponse.json(
    {
      lake,
      current: current ?? (marineTemp ? {
        lake_id: lake.id,
        temp_c: marineTemp.temp_c,
        measured_at: marineTemp.measured_at,
        source: "openmeteo_marine",
        quality: "medium",
      } : null),
      history: history ?? [],
      weather: weather?.current
        ? {
            air_temp_c: weather.current.temperature_2m,
            wind_speed_kmh: weather.current.wind_speed_10m,
            wind_direction_deg: weather.current.wind_direction_10m,
            uv_index: weather.uv_index,
            cloud_cover_pct: weather.current.cloud_cover,
            precipitation_mm: weather.current.precipitation,
            condition: conditionFromCode(weather.current.weather_code),
            measured_at: weather.current.time,
          }
        : null,
      forecast,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
      },
    },
  );
}
