/**
 * Weelake · temperature helpers
 * Windy-style color scale + swim safety verdict.
 *
 * Localisation contract
 * ---------------------
 * `assessSwim` and `relativeTime` are pure business logic and must not
 * import React. They therefore return **i18n message keys** (plus any
 * substitution `vars`) rather than plain English strings — the UI layer
 * translates them via `useT()`. English fallbacks live in the JSON
 * dictionaries. Adding a new bucket or warning means adding one key to
 * each locale file; the compile-time key naming (`swim.warning.*`,
 * `swim.reason.*`, `swim.headline.*`, `time.*`) makes those additions
 * trivial to spot.
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

/** Localised message reference: an i18n key plus optional interpolation vars. */
export interface TranslatableMessage {
  key: string;
  vars?: Record<string, string | number>;
}

export interface SwimAssessment {
  verdict: SwimVerdict;
  score: number;      // 0-100
  /** i18n key for the one-line headline (e.g. 'swim.headline.good'). */
  headlineKey: string;
  /** Positive callouts to render as list items. */
  reasons: TranslatableMessage[];
  /** Warnings to render prominently (bg tint). */
  warnings: TranslatableMessage[];
}

/**
 * Compute a swim-safety verdict from temperature and optional weather signals.
 * Rules are heuristic and conservative — always show the underlying data too.
 *
 * Returns message keys, not English text. See `swim.*` keys in the locale JSONs.
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
      headlineKey: "swim.headline.unknown",
      reasons: [{ key: "swim.reason.noData" }],
      warnings: [],
    };
  }

  const reasons: TranslatableMessage[] = [];
  const warnings: TranslatableMessage[] = [];

  let verdict: SwimVerdict = "ok";
  let score = 60;

  if (w < 10) {
    verdict = "cold";
    score = 20;
    warnings.push({ key: "swim.warning.coldShock" });
  } else if (w < 15) {
    verdict = "cold";
    score = 40;
    warnings.push({ key: "swim.warning.cold" });
  } else if (w < 18) {
    verdict = "ok";
    score = 60;
    reasons.push({ key: "swim.reason.brisk" });
  } else if (w < 22) {
    verdict = "good";
    score = 80;
    reasons.push({ key: "swim.reason.pleasant" });
  } else if (w < 26) {
    verdict = "great";
    score = 95;
    reasons.push({ key: "swim.reason.great" });
  } else if (w < 30) {
    verdict = "great";
    score = 90;
    reasons.push({ key: "swim.reason.veryWarm" });
    warnings.push({ key: "swim.warning.algae" });
  } else {
    verdict = "hot";
    score = 55;
    warnings.push({ key: "swim.warning.veryWarm" });
  }

  if (typeof input.air_c === "number") {
    if (input.air_c < w - 5) {
      warnings.push({ key: "swim.warning.airCold" });
      score -= 5;
    }
    reasons.push({ key: "swim.reason.air", vars: { air: input.air_c.toFixed(0) } });
  }

  if (typeof input.wind_kmh === "number") {
    if (input.wind_kmh > 30) {
      warnings.push({ key: "swim.warning.wind", vars: { wind: Math.round(input.wind_kmh) } });
      score -= 10;
    } else if (input.wind_kmh < 8) {
      reasons.push({ key: "swim.reason.calm" });
    }
  }

  if (typeof input.uv === "number" && input.uv >= 7) {
    warnings.push({ key: "swim.warning.uv", vars: { uv: input.uv.toFixed(0) } });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const headlineKey =
    verdict === "great" ? "swim.headline.great"
    : verdict === "good" ? "swim.headline.good"
    : verdict === "ok"   ? "swim.headline.ok"
    : verdict === "cold" ? "swim.headline.cold"
    : verdict === "hot"  ? "swim.headline.hot"
    : "swim.headline.unknown";

  return { verdict, score, headlineKey, reasons, warnings };
}

/**
 * Return a localised relative-time string using `Intl.RelativeTimeFormat`.
 * When `locale` is omitted we fall back to the runtime default (server) or
 * `navigator.language` (client). Callers with a stable locale (e.g. from
 * `usePrefs`) should pass it explicitly for consistency.
 */
export function relativeTime(iso: string | null | undefined, locale?: string): string {
  if (!iso) return "";
  const effective = locale ?? (typeof navigator !== "undefined" ? navigator.language : "en");
  const rtf = new Intl.RelativeTimeFormat(effective, { numeric: "auto" });
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSec = Math.round((then - now) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, "second");
  const min = Math.round(diffSec / 60);
  if (Math.abs(min) < 60) return rtf.format(min, "minute");
  const hr = Math.round(min / 60);
  if (Math.abs(hr) < 24) return rtf.format(hr, "hour");
  const d = Math.round(hr / 24);
  if (Math.abs(d) < 30) return rtf.format(d, "day");
  return new Date(iso).toLocaleDateString(effective);
}
