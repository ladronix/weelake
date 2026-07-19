/**
 * Structural i18n test — every locale JSON must expose the same key-set.
 * Missing/extra keys fail loudly so CI catches half-authored translations
 * before they reach prod.
 *
 * Plurals are treated specially: keys ending in `_one|_few|_many|_other|_two|_zero`
 * belong to a CLDR plural family and each locale is allowed to define only
 * the plural categories it uses. The stem (everything before the underscore)
 * must exist in every locale; the exact categories may differ (Czech uses
 * one/few/other, English uses one/other, etc.).
 */
import { describe, expect, it } from "vitest";
import en from "./locales/en.json";
import cs from "./locales/cs.json";
import de from "./locales/de.json";

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

function pluralStem(key: string): string | null {
  const m = key.match(PLURAL_SUFFIX);
  return m ? key.slice(0, -m[0].length) : null;
}

function keySets(dict: Record<string, string>) {
  const scalarKeys = new Set<string>();
  const pluralStems = new Set<string>();
  for (const key of Object.keys(dict)) {
    const stem = pluralStem(key);
    if (stem) pluralStems.add(stem);
    else scalarKeys.add(key);
  }
  return { scalarKeys, pluralStems };
}

describe("i18n locale consistency", () => {
  const enSet = keySets(en as Record<string, string>);
  const csSet = keySets(cs as Record<string, string>);
  const deSet = keySets(de as Record<string, string>);

  const checkAgainstEn = (name: string, target: ReturnType<typeof keySets>) => {
    const missingScalars = [...enSet.scalarKeys].filter((k) => !target.scalarKeys.has(k));
    const extraScalars = [...target.scalarKeys].filter((k) => !enSet.scalarKeys.has(k));
    const missingStems = [...enSet.pluralStems].filter((s) => !target.pluralStems.has(s));
    const extraStems = [...target.pluralStems].filter((s) => !enSet.pluralStems.has(s));

    expect(missingScalars, `${name} missing ${missingScalars.length} scalars: ${missingScalars.slice(0,3).join(", ")}`).toEqual([]);
    expect(extraScalars, `${name} has ${extraScalars.length} extra scalars: ${extraScalars.slice(0,3).join(", ")}`).toEqual([]);
    expect(missingStems, `${name} missing ${missingStems.length} plural stems: ${missingStems.slice(0,3).join(", ")}`).toEqual([]);
    expect(extraStems, `${name} has ${extraStems.length} extra plural stems: ${extraStems.slice(0,3).join(", ")}`).toEqual([]);
  };

  it("cs.json aligns with en.json (scalars 1:1, plural stems 1:1)", () => {
    checkAgainstEn("cs", csSet);
  });

  it("de.json aligns with en.json (scalars 1:1, plural stems 1:1)", () => {
    checkAgainstEn("de", deSet);
  });

  it("every plural family has _other as the mandatory fallback in every locale", () => {
    const check = (name: string, dict: Record<string, string>) => {
      const stems = new Set<string>();
      const otherKeys = new Set<string>();
      for (const key of Object.keys(dict)) {
        const stem = pluralStem(key);
        if (stem) {
          stems.add(stem);
          if (key.endsWith("_other")) otherKeys.add(stem);
        }
      }
      const missing = [...stems].filter((s) => !otherKeys.has(s));
      expect(missing, `${name}: plural stems without _other fallback: ${missing.slice(0,3).join(", ")}`).toEqual([]);
    };
    check("en", en as Record<string, string>);
    check("cs", cs as Record<string, string>);
    check("de", de as Record<string, string>);
  });

  it("no locale contains empty-string values (missing translations)", () => {
    const check = (name: string, dict: Record<string, string>) => {
      const empties = Object.entries(dict).filter(([, v]) => typeof v !== "string" || v.trim() === "");
      expect(empties, `${name}: ${empties.length} empty values`).toEqual([]);
    };
    check("en", en as Record<string, string>);
    check("cs", cs as Record<string, string>);
    check("de", de as Record<string, string>);
  });

  it("every locale preserves the same {placeholders} as English (per plural variant)", () => {
    const rePlaceholder = /\{(\w+)\}/g;
    const placeholders = (s: string) => {
      const found = new Set<string>();
      let m;
      while ((m = rePlaceholder.exec(s)) !== null) found.add(m[1]);
      return found;
    };
    for (const [locale, dict] of [
      ["cs", cs as Record<string, string>],
      ["de", de as Record<string, string>],
    ] as const) {
      for (const key of Object.keys(en) as Array<keyof typeof en>) {
        const enPlaceholders = placeholders(en[key]);
        // For a plural key we compare against the _other variant of the
        // target locale (guaranteed to exist thanks to the test above).
        const stem = pluralStem(String(key));
        let targetVal: string | undefined;
        if (stem) {
          targetVal = dict[`${stem}_other`] ?? dict[String(key)];
        } else {
          targetVal = dict[String(key)];
        }
        if (targetVal == null) continue; // extra-scalar test above will catch it.
        const localePlaceholders = placeholders(targetVal);
        for (const p of enPlaceholders) {
          expect(
            localePlaceholders.has(p),
            `${locale}: '${String(key)}' does not preserve the {${p}} placeholder`,
          ).toBe(true);
        }
      }
    }
  });
});
