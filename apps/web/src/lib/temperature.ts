/**
 * Weelake · temperature helpers
 * Windy-style color scale + swim safety verdict.
 */

export interface TempBucket {
  min: number;
  max: number;
  color: string;
  label: string;
  className: string;
}

export const TEMP_BUCKETS: TempBucket[] = [
  { min: -Infinity, max: 5,  color: "#1E3A8A", label: "Freezing",        className: "bg-temp-freezing" },
  { min: 5,         max: 10, color: "#3B82F6", label: "Very cold",       className: "bg-temp-cold" },
  { min: 10,        max: 15, color: "#22D3EE", label: "Cold",            className: "bg-temp-cool" },
  { min: 15,        max: 18, color: "#10B981", label: "Fresh",           className: "bg-temp-mild" },
  { min: 18,        max: 22, color: "#FACC15", label: "Pleasant",        className: "bg-temp-warm" },
  { min: 22,        max: 26, color: "#F59E0B", label: "Warm",            className: "bg-temp-hot" },
  { min: 26,        max: 30, color: "#EF4444", label: "Hot",             className: "bg-temp-burning" },
  { min: 30,        max: Infinity, color: "#7C2D12", label: "Extreme",   className: "bg-temp-extreme" },
];

export function bucketForTemp(t: number | null | undefined): TempBucket {
  if (t === null || t === undefined || Number.isNaN(t)) {
    return { min: NaN, max: NaN, color: "#94A3B8", label: "Unknown", className: "bg-slate-400" };
  }
  return TEMP_BUCKETS.find((b) => t >= b.min && t < b.max) ?? TEMP_BUCKETS[0];
}

export function formatTemp(t: number | null | undefined, precision = 1): string {
  if (t === null || t === undefined || Number.isNaN(t)) return "—";
  return `${t.toFixed(precision)}°C`;
}

export type SwimVerdict = "great" | "good" | "ok" | "cold" | "hot" | "unknown";

export interface SwimAssessment {
  verdict: SwimVerdict;
  score: number;      // 0-100
  headline: string;
  reasons: string[];
  warnings: string[];
}

/**
 * Compute a swim-safety verdict from temperature and optional weather signals.
 * Rules are heuristic and conservative — always show the underlying data too.
 */
export function assessSwim(input: {
  water_c?: number | null;
  air_c?: number | null;
  wind_kmh?: number | null;
  uv?: number | null;
}): SwimAssessment {
  const w = input.water_c;
  if (w === null || w === undefined || Number.isNaN(w)) {
    return {
      verdict: "unknown",
      score: 0,
      headline: "No recent data",
      reasons: ["No water temperature reading available."],
      warnings: [],
    };
  }

  const reasons: string[] = [];
  const warnings: string[] = [];

  let verdict: SwimVerdict = "ok";
  let score = 60;

  if (w < 10) {
    verdict = "cold";
    score = 20;
    warnings.push("Cold-water shock risk. Only for trained swimmers.");
  } else if (w < 15) {
    verdict = "cold";
    score = 40;
    warnings.push("Cold: limit exposure. Wetsuit recommended.");
  } else if (w < 18) {
    verdict = "ok";
    score = 60;
    reasons.push("Refreshing but brisk.");
  } else if (w < 22) {
    verdict = "good";
    score = 80;
    reasons.push("Pleasant for a swim.");
  } else if (w < 26) {
    verdict = "great";
    score = 95;
    reasons.push("Great swimming conditions.");
  } else if (w < 30) {
    verdict = "great";
    score = 90;
    reasons.push("Very warm, ideal for kids.");
    warnings.push("Warm water can promote algal blooms — check local advisories.");
  } else {
    verdict = "hot";
    score = 55;
    warnings.push("Very warm water: heightened algae / bacteria risk.");
  }

  if (typeof input.air_c === "number") {
    if (input.air_c < w - 5) {
      warnings.push("Air is colder than water — chilly exit.");
      score -= 5;
    }
    reasons.push(`Air ${input.air_c.toFixed(0)}°C.`);
  }

  if (typeof input.wind_kmh === "number") {
    if (input.wind_kmh > 30) {
      warnings.push(`Strong wind (${Math.round(input.wind_kmh)} km/h) — watch waves.`);
      score -= 10;
    } else if (input.wind_kmh < 8) {
      reasons.push("Calm wind.");
    }
  }

  if (typeof input.uv === "number" && input.uv >= 7) {
    warnings.push(`High UV (index ${input.uv.toFixed(0)}) — sunscreen essential.`);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const headline =
    verdict === "great" ? "Perfect for a swim"
    : verdict === "good" ? "Good for swimming"
    : verdict === "ok"   ? "Swimmable, cool"
    : verdict === "cold" ? "Cold — care needed"
    : verdict === "hot"  ? "Warm — check advisories"
    : "Unknown";

  return { verdict, score, headline, reasons, warnings };
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "unknown";
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const d = Math.round(hr / 24);
  if (d < 30) return `${d} d ago`;
  return new Date(iso).toLocaleDateString();
}
