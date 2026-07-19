#!/usr/bin/env node
/**
 * Weelake · i18n auto-translation
 * ------------------------------
 * For each target locale (cs, de) walk the reference locale (en.json)
 * and translate every key that is missing (or listed in --force) using
 * DeepL. Placeholders like {n} / {name} are preserved verbatim.
 *
 * Requirements:
 *   - env DEEPL_API_KEY set (from https://www.deepl.com/pro-api → Free tier)
 *   - Node ≥ 20 (native fetch)
 *
 * Usage:
 *   DEEPL_API_KEY=... pnpm i18n:sync              # missing keys only
 *   DEEPL_API_KEY=... pnpm i18n:sync --force      # retranslate everything
 *   DEEPL_API_KEY=... pnpm i18n:sync --locale=cs  # single locale
 *
 * The output is sorted-key JSON with the same 2-space indentation as
 * hand-authored files. Suggested workflow: run this, then a human editor
 * (you) does a fast pass over the diff — DeepL is very good but doesn't
 * know 'Cold-plunge' means winter swimming, etc.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, "..", "src", "lib", "i18n", "locales");
const REFERENCE = "en";
const TARGETS = ["cs", "de"];

const args = process.argv.slice(2);
const force = args.includes("--force");
const localeArg = args.find((a) => a.startsWith("--locale="))?.slice("--locale=".length);
const chosen = localeArg ? [localeArg] : TARGETS;

const apiKey = process.env.DEEPL_API_KEY;
if (!apiKey) {
  console.error("DEEPL_API_KEY is required. Get one at https://www.deepl.com/pro-api");
  process.exit(1);
}
const isFree = apiKey.endsWith(":fx");
const endpoint = isFree
  ? "https://api-free.deepl.com/v2/translate"
  : "https://api.deepl.com/v2/translate";

function load(locale) {
  return JSON.parse(readFileSync(join(LOCALES_DIR, `${locale}.json`), "utf8"));
}
function save(locale, obj) {
  writeFileSync(join(LOCALES_DIR, `${locale}.json`), JSON.stringify(obj, null, 2) + "\n");
}

/**
 * Ask DeepL to translate a batch of strings. DeepL supports up to 50
 * `text` params per request; we batch to keep us under that.
 */
async function translateBatch(texts, targetLang) {
  const body = new URLSearchParams();
  body.append("target_lang", targetLang.toUpperCase());
  body.append("source_lang", "EN");
  body.append("tag_handling", "xml"); // protects our {placeholders}
  body.append("preserve_formatting", "1");
  // Placeholders as ignored XML tags so DeepL leaves them alone.
  for (const t of texts) {
    body.append("text", t.replace(/\{(\w+)\}/g, "<ph>$1</ph>"));
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepL ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.translations.map((t) =>
    t.text.replace(/<ph>(\w+)<\/ph>/g, "{$1}"),
  );
}

async function syncLocale(locale) {
  const ref = load(REFERENCE);
  const existing = load(locale);
  const refKeys = Object.keys(ref);

  const toTranslate = refKeys.filter(
    (k) => force || !(k in existing) || !existing[k],
  );

  if (toTranslate.length === 0) {
    console.log(`  ${locale}.json: nothing to do (in sync)`);
    return;
  }

  console.log(`  ${locale}.json: ${toTranslate.length} keys to translate…`);

  const out = { ...existing };
  const batchSize = 40;
  for (let i = 0; i < toTranslate.length; i += batchSize) {
    const batchKeys = toTranslate.slice(i, i + batchSize);
    const batchTexts = batchKeys.map((k) => ref[k]);
    const translations = await translateBatch(batchTexts, locale);
    batchKeys.forEach((k, idx) => {
      out[k] = translations[idx];
    });
    process.stdout.write(".");
  }
  process.stdout.write("\n");

  // Order keys same as reference (nice diff).
  const ordered = {};
  for (const k of refKeys) {
    if (k in out) ordered[k] = out[k];
  }
  // Preserve any *extra* target-only keys (rare) at the end.
  for (const k of Object.keys(out)) {
    if (!(k in ordered)) ordered[k] = out[k];
  }

  save(locale, ordered);
  console.log(`  ${locale}.json: saved (${Object.keys(ordered).length} keys total)`);
}

console.log("i18n sync via DeepL");
console.log(`  reference: ${REFERENCE}.json`);
for (const locale of chosen) {
  await syncLocale(locale);
}
console.log("done — please review the diff before committing.");
