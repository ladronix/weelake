import { describe, expect, it } from "vitest";
import { detectSystemLocale, DEFAULT_LOCALE } from "./config";

describe("detectSystemLocale", () => {
  it("returns default for empty/null/undefined input", () => {
    expect(detectSystemLocale([])).toBe(DEFAULT_LOCALE);
    expect(detectSystemLocale(null)).toBe(DEFAULT_LOCALE);
    expect(detectSystemLocale(undefined)).toBe(DEFAULT_LOCALE);
  });

  it("matches by primary subtag (regional variants)", () => {
    expect(detectSystemLocale(["cs-CZ"])).toBe("cs");
    expect(detectSystemLocale(["de-AT"])).toBe("de");
    expect(detectSystemLocale(["en-US"])).toBe("en");
    expect(detectSystemLocale(["en-GB"])).toBe("en");
  });

  it("respects language priority (first match wins)", () => {
    expect(detectSystemLocale(["fr-FR", "cs-CZ", "en"])).toBe("cs");
    expect(detectSystemLocale(["sk-SK", "de-DE"])).toBe("de");
  });

  it("falls back to default when nothing matches", () => {
    expect(detectSystemLocale(["fr", "es", "it"])).toBe(DEFAULT_LOCALE);
    expect(detectSystemLocale(["zh-CN"])).toBe(DEFAULT_LOCALE);
  });

  it("is case-insensitive", () => {
    expect(detectSystemLocale(["CS-cz"])).toBe("cs");
    expect(detectSystemLocale(["DE"])).toBe("de");
  });

  it("handles underscored tags", () => {
    expect(detectSystemLocale(["cs_CZ"])).toBe("cs");
  });

  it("skips empty/non-string entries safely", () => {
    // @ts-expect-error - deliberately malformed input to test robustness
    expect(detectSystemLocale(["", null, undefined, "de"])).toBe("de");
  });
});
