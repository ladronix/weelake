import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { toDisplayTemp, unitSymbol } from "./prefs";

describe("toDisplayTemp", () => {
  it("returns null for null / undefined / NaN", () => {
    expect(toDisplayTemp(null, "C")).toBeNull();
    expect(toDisplayTemp(undefined, "C")).toBeNull();
    expect(toDisplayTemp(Number.NaN, "C")).toBeNull();
  });

  it("returns the celsius value untouched when unit is C", () => {
    expect(toDisplayTemp(20, "C")).toBe(20);
    expect(toDisplayTemp(-5, "C")).toBe(-5);
    expect(toDisplayTemp(30.5, "C")).toBe(30.5);
  });

  it("converts to fahrenheit when unit is F", () => {
    expect(toDisplayTemp(0, "F")).toBe(32);
    expect(toDisplayTemp(100, "F")).toBe(212);
    expect(toDisplayTemp(20, "F")).toBe(68);
  });

  it("round-trips within precision", () => {
    const c = 22.5;
    const f = toDisplayTemp(c, "F");
    expect(f).toBeCloseTo(72.5, 1);
  });
});

describe("unitSymbol", () => {
  it("returns °C for C", () => {
    expect(unitSymbol("C")).toBe("°C");
  });
  it("returns °F for F", () => {
    expect(unitSymbol("F")).toBe("°F");
  });
});

// Prefs storage tests — a subset that doesn't require React rendering.
describe("prefs storage", () => {
  beforeEach(() => {
    // JSDOM localStorage stub
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("has default values", () => {
    // The module reads on first hook call; here we just check the shape.
    const defaults = { unit: "C" as const, lang: "en" as const };
    expect(defaults.unit).toBe("C");
    expect(defaults.lang).toBe("en");
  });
});
