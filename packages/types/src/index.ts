/**
 * Weelake / V-Lake — shared domain types.
 * Consumed by web app, workers, and API clients.
 */

export type LakeType = "lake" | "reservoir" | "sea" | "lagoon" | "pond";

export type DataSource =
  | "copernicus_marine"
  | "copernicus_cds"
  | "openmeteo_marine"
  | "openmeteo_forecast"
  | "community"
  | "hydrolakes"
  | "manual";

export type DataQuality = "high" | "medium" | "low" | "estimated";

export interface Lake {
  id: string;
  slug: string;
  name: string;
  name_local?: string | null;
  country_code: string; // ISO 3166-1 alpha-2
  region?: string | null;
  lat: number;
  lng: number;
  area_km2?: number | null;
  max_depth_m?: number | null;
  mean_depth_m?: number | null;
  elevation_m?: number | null;
  type: LakeType;
  importance: number; // 1-10
  photo_url?: string | null;
  wiki_url?: string | null;
  created_at: string;
}

export interface LakeTemperature {
  lake_id: string;
  temp_c: number;
  measured_at: string; // ISO timestamp
  source: DataSource;
  quality: DataQuality;
  updated_at: string;
}

export interface LakeHistoryPoint {
  measured_at: string;
  temp_c: number;
  source: DataSource;
}

export interface LakeWithTemp extends Lake {
  temp?: LakeTemperature | null;
}

export interface WeatherSnapshot {
  air_temp_c: number;
  wind_speed_kmh: number;
  wind_direction_deg: number;
  uv_index: number;
  cloud_cover_pct: number;
  precipitation_mm: number;
  condition: string; // "clear", "cloudy", "rain", ...
  measured_at: string;
}

export interface WeatherForecastDay {
  date: string; // YYYY-MM-DD
  air_temp_max_c: number;
  air_temp_min_c: number;
  water_temp_forecast_c?: number | null;
  wind_speed_max_kmh: number;
  uv_index_max: number;
  precipitation_mm: number;
  condition: string;
}

export interface SwimSafety {
  score: number; // 0-100
  verdict: "great" | "good" | "ok" | "cold" | "hot" | "unsafe";
  reasons: string[]; // human-readable reasons
  warnings: string[]; // warnings (cold shock, heatwave, algae risk)
}

export interface Stats {
  total_lakes: number;
  countries_count: number;
  hottest_now: {
    lake_id: string;
    slug: string;
    name: string;
    country_code: string;
    temp_c: number;
  } | null;
  coldest_now: {
    lake_id: string;
    slug: string;
    name: string;
    country_code: string;
    temp_c: number;
  } | null;
  max_temp_c: number | null;
  min_temp_c: number | null;
  last_updated: string;
}

export interface CountrySummary {
  country_code: string;
  name: string;
  emoji: string;
  lake_count: number;
  avg_temp_c: number | null;
}
