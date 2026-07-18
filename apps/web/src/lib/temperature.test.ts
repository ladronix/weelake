import { describe, expect, it } from "vitest";
import {
  TEMP_BUCKETS,
  assessSwim,
  bucketForTemp,
  formatTemp,
  relativeTime,
} from "./temperature";

describe("bucketForTemp", () => {
  it("returns unknown bucket for null / undefined / NaN", () => {
    expect(bucketForTemp(null).label).toBe("Unknown");
    expect(bucketForTemp(undefined).label).toBe("Unknown");
    expect(bucketForTemp(Number.NaN).label).toBe("Unknown");
  });

  it("assigns freezing for temps below 5°C", () => {
    expect(bucketForTemp(-2).label).toBe("Freezing");
    expect(bucketForTemp(4.9).label).toBe("Freezing");
  });

  it("assigns pleasant band for 18-22°C", () => {
    expect(bucketForTemp(18).label).toBe("Pleasant");
    expect(bucketForTemp(21.9).label).toBe("Pleasant");
  });

  it("assigns extreme for temps ≥ 30°C", () => {
    expect(bucketForTemp(30).label).toBe("Extreme");
    expect(bucketForTemp(45).label).toBe("Extreme");
  });

  it("has strictly ordered bucket boundaries", () => {
    for (let i = 1; i < TEMP_BUCKETS.length; i++) {
      expect(TEMP_BUCKETS[i].min).toBeGreaterThanOrEqual(TEMP_BUCKETS[i - 1].max);
    }
  });
});

describe("formatTemp", () => {
  it("returns dash for empty values", () => {
    expect(formatTemp(null)).toBe("—");
    expect(formatTemp(undefined)).toBe("—");
    expect(formatTemp(Number.NaN)).toBe("—");
  });

  it("respects precision", () => {
    expect(formatTemp(22.375, 1)).toBe("22.4°C");
    expect(formatTemp(22.375, 0)).toBe("22°C");
    expect(formatTemp(22.375, 2)).toBe("22.38°C");
  });
});

describe("assessSwim", () => {
  it("returns unknown when water temperature is missing", () => {
    const r = assessSwim({ water_c: null });
    expect(r.verdict).toBe("unknown");
    expect(r.score).toBe(0);
  });

  it("flags cold-shock warning below 10°C", () => {
    const r = assessSwim({ water_c: 8 });
    expect(r.verdict).toBe("cold");
    expect(r.warnings.some((w) => w.toLowerCase().includes("cold"))).toBe(true);
  });

  it("marks 22°C as great swimming", () => {
    const r = assessSwim({ water_c: 22.5 });
    expect(r.verdict).toBe("great");
    expect(r.score).toBeGreaterThan(80);
  });

  it("adds warning for algae risk above 30°C", () => {
    const r = assessSwim({ water_c: 31 });
    expect(r.verdict).toBe("hot");
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it("penalises strong wind", () => {
    const calm  = assessSwim({ water_c: 22, wind_kmh: 5 });
    const stormy = assessSwim({ water_c: 22, wind_kmh: 45 });
    expect(stormy.score).toBeLessThan(calm.score);
    expect(stormy.warnings.some((w) => w.toLowerCase().includes("wind"))).toBe(true);
  });

  it("warns on high UV", () => {
    const r = assessSwim({ water_c: 24, uv: 9 });
    expect(r.warnings.some((w) => w.toLowerCase().includes("uv"))).toBe(true);
  });

  it("keeps score bounded to 0..100", () => {
    for (const t of [-10, 0, 5, 10, 15, 20, 25, 30, 40]) {
      const r = assessSwim({ water_c: t, wind_kmh: 100, uv: 12 });
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });
});

describe("relativeTime", () => {
  it("handles missing input", () => {
    expect(relativeTime(null)).toBe("unknown");
    expect(relativeTime(undefined)).toBe("unknown");
  });

  it("returns 'just now' for very recent timestamps", () => {
    const iso = new Date(Date.now() - 5_000).toISOString();
    expect(relativeTime(iso)).toBe("just now");
  });

  it("returns minutes for < 1h", () => {
    const iso = new Date(Date.now() - 15 * 60_000).toISOString();
    expect(relativeTime(iso)).toMatch(/min ago$/);
  });

  it("returns hours for < 24h", () => {
    const iso = new Date(Date.now() - 5 * 3600_000).toISOString();
    expect(relativeTime(iso)).toMatch(/h ago$/);
  });

  it("returns days for < 30d", () => {
    const iso = new Date(Date.now() - 3 * 24 * 3600_000).toISOString();
    expect(relativeTime(iso)).toMatch(/d ago$/);
  });
});
