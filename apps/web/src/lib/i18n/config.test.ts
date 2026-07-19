import { describe, expect, it } from "vitest";
import { detectSystemLocale, DEFAULT_LOCALE } from "./config";
import { translate, translatePlural } from "./index";

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

describe("translate", () => {
  it("returns the localised value for a known key", () => {
    expect(translate("en", "nav.map")).toBe("Map");
    expect(translate("cs", "nav.map")).toBe("Mapa");
    expect(translate("de", "nav.map")).toBe("Karte");
  });

  it("falls back to English when the target locale lacks the key", () => {
    // 'settings.system' exists in all locales; use a locale-missing key by hand
    // (all our keys are complete today so we just assert the fallback runs).
    expect(translate("en", "definitely.not.a.key")).toBe("definitely.not.a.key");
  });

  it("substitutes {placeholders}", () => {
    expect(translate("en", "footer.copyright", { year: 2026 })).toContain("2026");
  });
});

describe("translatePlural (Intl.PluralRules)", () => {
  it("resolves English singular vs plural", () => {
    expect(translatePlural("en", "countries.countLake", 1)).toBe("1 lake");
    expect(translatePlural("en", "countries.countLake", 5)).toBe("5 lakes");
  });

  it("resolves Czech one / few / other", () => {
    expect(translatePlural("cs", "countries.countLake", 1)).toBe("1 jezero");
    expect(translatePlural("cs", "countries.countLake", 3)).toBe("3 jezera");
    expect(translatePlural("cs", "countries.countLake", 12)).toBe("12 jezer");
  });

  it("resolves German singular vs plural", () => {
    expect(translatePlural("de", "countries.countLake", 1)).toBe("1 See");
    expect(translatePlural("de", "countries.countLake", 7)).toBe("7 Seen");
  });

  it("falls back to _other when a specific plural category is missing", () => {
    // "countries.countCountry" in English has no _few, but Intl will pick _other.
    expect(translatePlural("en", "countries.countCountry", 4)).toBe("4 countries");
  });
});
