#!/usr/bin/env node
/**
 * V-Lake · i18n structural check
 * ------------------------------
 * Ensures every non-EN locale JSON exposes the same key-set as en.json
 * (the source of truth). Plural families (`_one`, `_few`, `_many`,
 * `_other`, `_two`, `_zero`) are grouped by stem — each locale must
 * define at least an `_other` fallback per stem, but is allowed to
 * define additional plural categories relevant to its language.
 *
 * Fails the CI with a non-zero exit if a scalar key or a plural stem is
 * missing / extra, listing the offenders per locale.
 *
 * Run:  node scripts/i18n-check.mjs
 * Or:   pnpm i18n:check
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, "..", "src", "lib", "i18n", "locales");
const REFERENCE = "en";
const TARGETS = ["cs", "de"];

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;
function pluralStem(key) {
  const m = key.match(PLURAL_SUFFIX);
  return m ? key.slice(0, -m[0].length) : null;
}

function load(locale) {
  const path = join(LOCALES_DIR, `${locale}.json`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function classify(dict) {
  const scalars = new Set();
  const stems = new Set();
  const stemHasOther = new Set();
  for (const key of Object.keys(dict)) {
    const stem = pluralStem(key);
    if (stem) {
      stems.add(stem);
      if (key.endsWith("_other")) stemHasOther.add(stem);
    } else {
      scalars.add(key);
    }
  }
  return { scalars, stems, stemHasOther };
}

const ref = classify(load(REFERENCE));

let ok = true;
const summary = [];

for (const locale of TARGETS) {
  const tgt = classify(load(locale));

  const missingScalars = [...ref.scalars].filter((k) => !tgt.scalars.has(k));
  const extraScalars = [...tgt.scalars].filter((k) => !ref.scalars.has(k));
  const missingStems = [...ref.stems].filter((s) => !tgt.stems.has(s));
  const extraStems = [...tgt.stems].filter((s) => !ref.stems.has(s));
  const missingOthers = [...tgt.stems].filter((s) => !tgt.stemHasOther.has(s));

  const clean =
    missingScalars.length === 0 &&
    extraScalars.length === 0 &&
    missingStems.length === 0 &&
    extraStems.length === 0 &&
    missingOthers.length === 0;

  if (clean) {
    const total = tgt.scalars.size + tgt.stems.size;
    summary.push(`  ✓ ${locale}.json — ${total} keys (${tgt.scalars.size} scalars + ${tgt.stems.size} plural families), in sync`);
    continue;
  }

  ok = false;
  summary.push(`  ✗ ${locale}.json`);
  if (missingScalars.length) summary.push(`    missing scalars (${missingScalars.length}): ${missingScalars.slice(0, 5).join(", ")}${missingScalars.length > 5 ? "…" : ""}`);
  if (extraScalars.length) summary.push(`    extra scalars (${extraScalars.length}): ${extraScalars.slice(0, 5).join(", ")}${extraScalars.length > 5 ? "…" : ""}`);
  if (missingStems.length) summary.push(`    missing plural families (${missingStems.length}): ${missingStems.slice(0, 5).join(", ")}${missingStems.length > 5 ? "…" : ""}`);
  if (extraStems.length) summary.push(`    extra plural families (${extraStems.length}): ${extraStems.slice(0, 5).join(", ")}${extraStems.length > 5 ? "…" : ""}`);
  if (missingOthers.length) summary.push(`    plural families without _other fallback (${missingOthers.length}): ${missingOthers.slice(0, 5).join(", ")}${missingOthers.length > 5 ? "…" : ""}`);
}

const header = ok ? "\ni18n structural check: OK" : "\ni18n structural check: FAILED";
console.log(header);
console.log(`  reference: ${REFERENCE}.json — ${ref.scalars.size} scalars + ${ref.stems.size} plural families`);
console.log(summary.join("\n"));

if (!ok) {
  console.log("\nRun `pnpm i18n:sync` to auto-translate missing keys via DeepL (needs DEEPL_API_KEY).");
  process.exit(1);
}

