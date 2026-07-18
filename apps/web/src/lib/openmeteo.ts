/**
 * Weelake · Open-Meteo integration
 *
 * Two APIs used:
 *  1. Forecast API — air temperature, wind, UV, precipitation, cloud cover.
 *  2. Marine API   — sea_surface_temperature (works for coastal + very large lakes).
 *
 * Free, no API key required. Rate limit is generous (~10k requests / day).
 * Docs: https://open-meteo.com/en/docs
 */

const FORECAST_URL = process.env.OPENMETEO_BASE_URL ?? "https://api.open-meteo.com/v1";
const MARINE_URL   = process.env.OPENMETEO_MARINE_URL ?? "https://marine-api.open-meteo.com/v1";

export interface OpenMeteoCurrentWeather {
  temperature_2m: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  precipitation: number;
  cloud_cover: number;
  weather_code: number;
  time: string;
}

export interface OpenMeteoDailyForecast {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  wind_speed_10m_max: number[];
  uv_index_max: number[];
  precipitation_sum: number[];
  weather_code: number[];
}

export interface WeatherPayload {
  current: OpenMeteoCurrentWeather;
  daily: OpenMeteoDailyForecast;
  uv_index: number | null;
}

/**
 * Fetch weather (current + 7-day forecast) for a coordinate.
 * Caches at the caller layer via HTTP `revalidate`.
 */
export async function fetchWeather(lat: number, lng: number): Promise<WeatherPayload | null> {
  const params = new URLSearchParams({
    latitude:  lat.toFixed(4),
    longitude: lng.toFixed(4),
    current:   "temperature_2m,wind_speed_10m,wind_direction_10m,precipitation,cloud_cover,weather_code",
    daily:     "temperature_2m_max,temperature_2m_min,wind_speed_10m_max,uv_index_max,precipitation_sum,weather_code",
    hourly:    "uv_index",
    forecast_days: "7",
    timezone:  "auto",
  });

  const url = `${FORECAST_URL}/forecast?${params.toString()}`;
  const res = await fetch(url, { next: { revalidate: 900 } }); // 15 min cache
  if (!res.ok) {
    console.warn(`[openmeteo] weather fetch failed for ${lat},${lng}: ${res.status}`);
    return null;
  }
  const data = (await res.json()) as {
    current: OpenMeteoCurrentWeather;
    daily: OpenMeteoDailyForecast;
    hourly?: { uv_index?: number[]; time?: string[] };
  };

  // Approximate current UV: pick the value for the current hour.
  let uv: number | null = null;
  if (data.hourly?.uv_index?.length) {
    const nowHour = new Date().toISOString().slice(0, 13);
    const idx = (data.hourly.time ?? []).findIndex((t) => t.startsWith(nowHour));
    uv = idx >= 0 ? data.hourly.uv_index[idx] : data.hourly.uv_index[0];
  }

  return { current: data.current, daily: data.daily, uv_index: uv };
}

/**
 * Fetch sea/large-lake surface water temperature via Open-Meteo Marine API.
 * Returns null for inland small lakes not on marine grids — fall back to Copernicus.
 */
export async function fetchMarineWaterTemp(lat: number, lng: number): Promise<{ temp_c: number; measured_at: string } | null> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lng.toFixed(4),
    hourly: "sea_surface_temperature",
    past_days: "1",
    forecast_days: "1",
    timezone: "auto",
  });

  const url = `${MARINE_URL}/marine?${params.toString()}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return null;

  const data = await res.json() as {
    hourly?: {
      time?: string[];
      sea_surface_temperature?: (number | null)[];
    };
  };

  const times = data.hourly?.time ?? [];
  const temps = data.hourly?.sea_surface_temperature ?? [];
  // Find the most recent non-null reading.
  for (let i = times.length - 1; i >= 0; i--) {
    const t = temps[i];
    if (t !== null && t !== undefined && !Number.isNaN(t)) {
      return { temp_c: t, measured_at: new Date(times[i]).toISOString() };
    }
  }
  return null;
}

/**
 * Map WMO weather codes to human-readable conditions.
 * Reference: https://open-meteo.com/en/docs (weather_code table)
 */
export function conditionFromCode(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 2) return "Mainly clear";
  if (code === 3) return "Cloudy";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Showers";
  if (code === 85 || code === 86) return "Snow showers";
  if (code === 95) return "Thunderstorm";
  if (code === 96 || code === 99) return "Thunderstorm w/ hail";
  return "—";
}
