# Weelake Engineering Principles

**This file is the contract every contributor — human or AI — is
expected to follow.** It exists so we don't have to rediscover the
same lessons across sessions. Read it first, then check the checklist
before opening a PR.

If a rule below stops making sense, propose a change here in the same
PR that violates it. **Silent drift is the enemy.**

---

## 1. Reuse before you build

**Before writing a new component, check if we already have one.**

Every atom that could reasonably be shared lives under
[`apps/web/src/components/ui/`](../apps/web/src/components/ui). If you
find yourself typing `className="rounded-full bg-white/95 ..."` and
recognise the pattern from three other files — extract it, don't
re-inline it.

### The shared component library

| Component | Purpose | Used in |
| --- | --- | --- |
| `TempPill` | Temperature chip. Handles unit conversion + bucket colour. **Never** print a raw °C number outside this. | Map, list, detail |
| `TempPill` variants | `size: "xs" \| "sm" \| "md" \| "lg" \| "xl"` | Everywhere |
| `GlassCard` | Frosted-glass popover container | Layers picker, filters, detail sheets |
| `SyncBadge` | Nav-level data-freshness badge | Nav |
| `RelativeTime` | ISO string → "2 hours ago" (i18n-aware) | Everywhere temperature is shown |
| `Toggle` (see below) | On/off switch, matches glass aesthetic | Filters, layers picker |
| `SortDropdown` (see below) | Reusable sort chip that opens a menu | Map list header |

### When you need a new atom

1. Add it under `apps/web/src/components/ui/<name>.tsx`
2. Export it from `apps/web/src/components/ui/index.ts` (the barrel)
3. Document its props in a JSDoc block above the component
4. **Never** re-inline the same visual pattern twice — that's the trigger
   to extract

The barrel export is what makes `import { TempPill } from
"@/components/ui"` work everywhere. Don't `import from
"@/components/ui/temp-pill"` — go through the barrel so future
renames don't propagate through the codebase.

### Component naming

- File names: `kebab-case.tsx`
- Component names: `PascalCase`
- Prop interfaces: colocated in the same file, named `<Name>Props`
- Variants: use the `size`/`variant` pattern with a lookup table, not
  a long conditional

---

## 2. Data flow: single source of truth

**Never write to `lakes_current` from anywhere but the daily worker.**
The map and list read from `lakes_current` and expect it to be fresh.
Historical anchors go to `lakes_history` with a distinct `source`
value — see [`ARCHITECTURE.md`](ARCHITECTURE.md).

**Never write to `lakes_history` without a matching `source` field.**
The unique index `(lake_id, measured_at, source)` guarantees
idempotence; missing `source` will collide.

**Never let a user-supplied string reach a raw SQL query.** Supabase
JS uses parameterised queries under the hood — use `.eq()`, `.in()`,
`.gt()`. Do NOT string-concatenate SQL.

---

## 3. Security defaults

### Supabase / API

- **Service role key** stays server-side only. Never expose it in a
  Next.js client component or in `NEXT_PUBLIC_*` env vars.
- **Row-Level Security (RLS)** is on for every table. Public read
  policies live in migrations; anything the user can write goes
  through a signed-in Supabase auth session.
- **API routes** validate input with an explicit allowlist. See
  [`/api/img/route.ts`](../apps/web/src/app/api/img/route.ts) for the
  pattern: parse the input, allowlist the hostname, deny everything
  else.
- **Rate limiting** at the edge for anything that reads from a paid
  upstream (Wikimedia, Copernicus). The image proxy dedupes concurrent
  requests via an in-flight `Map`.

### Frontend

- **No `dangerouslySetInnerHTML`** for user content. If you need HTML,
  sanitise upstream and comment why.
- **No `eval`, no `new Function`, no `Function.prototype.call` with
  string args.**
- **CSP-friendly**: no inline scripts, no inline styles that couldn't
  be expressed with Tailwind or a `style={{}}` object with static
  values.
- **External URLs in `<a>` tags** need `rel="noreferrer noopener"`
  when they open in a new tab.
- **External images**: proxy through `/api/img` unless the host is our
  own or a `data:` URI. See [`proxy-image.ts`](../apps/web/src/lib/proxy-image.ts).

---

## 4. Testing gates

**Every PR runs, and passes:**

```bash
pnpm --filter web test           # Vitest — currently 67 suites
pnpm --filter web lint           # next lint
pnpm --filter web tsc --noEmit   # strict TS
pnpm i18n:check                  # locale parity
pnpm --filter web build          # production build
```

CI runs all five on every push to `main` — see
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml). **Don't
merge on red.**

### What to test

- Every new pure function (`lib/*.ts`) gets a unit test in
  `__tests__/*.test.ts` next to it.
- Every new i18n key goes into `en.json`, `cs.json`, and `de.json` in
  the same commit — the i18n-parity test fails otherwise.
- UI components get **behaviour** tests (Vitest + Testing Library),
  not snapshots. Snapshots reward change, not correctness.
- Regressions get a test that reproduces the bug BEFORE the fix — see
  the "map pins on satellite" saga in the git log for the anti-pattern.

---

## 5. Playwright audits before production

Every time we touch the map, the landing, or the detail page:

```bash
pnpm --filter web build
pnpm --filter web start -p 3001 &
node /tmp/weelake-audit.mjs      # console-error / screenshot pass
```

The audit script:
- opens `/`, `/map`, `/sources`
- captures every console message, request-failure, and pageerror
- takes a viewport screenshot per page
- prints a per-page error / warning summary

**Zero-error goal**: production `/map` should have **no console errors**
except:
- Wikimedia `429` (rate-limit — fades after first load thanks to edge
  caching)
- WebGL `GPU stall due to ReadPixels` warnings (Playwright software
  GL only — invisible on real GPUs)

Anything else is a regression.

---

## 6. Best-practice defaults for MapLibre

The three tar-pits we already stepped in — learn from them.

- **Fonts:** every basemap ships its own `glyphs` URL. If you need a
  symbol layer to render on all four basemaps, override `glyphs` via
  `transformStyle` on `setStyle()`. Otherwise MapLibre silently 404s
  the font pbf and drops symbol paint. See `map-view.tsx`.
- **setStyle wipes runtime sources/layers.** Re-install from the
  `styledata` + `idle` events using idempotent `addSourceOnce` /
  `addLayerOnce` guards. Do NOT rely on transformStyle to preserve
  everything.
- **Event handlers bind once.** Use a marker property on the map
  instance (`__weelakeInteractionsBound`) to avoid stacking duplicate
  handlers on every re-install.

---

## 7. i18n workflow

- Three languages: `en` (source), `cs`, `de`.
- **Every user-facing string goes through `useT()` or `useP()`.** No
  raw strings in JSX — the i18n check will fail.
- Plural families for anything with a count. `{n} lakes` uses `useP`,
  not `useT`.
- When adding a key: add to `en.json` first, run `pnpm i18n:sync-deepl`
  (if you have the DeepL key) or add manually to `cs.json` +
  `de.json`, verify with `pnpm i18n:check`.
- Reuse existing keys before creating new ones. Grep the locale files.

See [`I18N.md`](I18N.md) for the deeper workflow.

---

## 8. Commit hygiene

- One logical change per commit.
- Commit messages: imperative subject line ≤72 chars, then a
  paragraph explaining WHY. See recent history for the pattern:
  ```
  fix(map): unify glyphs URL across basemaps so satellite pins render

  Real root cause. The prior 'font stack' fix was a red herring …
  ```
- **Never** commit `.env.local`, service role keys, CDS API keys, or
  anything under `data/` (satellite NetCDF cache).
- Backups from the auto-backup system are gitignored.

---

## 9. Refactor triggers

Refactor **before** you build the third similar thing, not after
you've built five.

**Signals it's refactor time:**
- Same `className` string in ≥3 files
- Same layout pattern (photo + text + trailing chip) in ≥2 places
- Same `useEffect` for a Supabase fetch in ≥2 places
- A component's file is >600 lines (extract sub-components)
- Props are being drilled ≥3 levels deep (lift to context or route
  params)

The map view is currently ~2000 lines. **This is technical debt.** We
tolerate it because it hasn't crossed the "same pattern ≥3 times"
threshold yet, but the next feature that touches it should extract at
least one sub-component.

---

## 10. When you're stuck

**Ask, don't guess.** The user prefers a quick clarifying question to
a wrong assumption you propagate through five files.

Especially for:
- Product decisions (which sources, how many decimals, what colour)
- Data-model changes (adding a column, changing a constraint)
- New third-party dependencies

The user is often in a hurry — offer the smallest reversible change
first, then a follow-up plan.

---

## Change log for this document

- **2026-07-21** — initial version. Captures lessons from the map-pins
  saga, image-proxy CORS work, and the seed batches. If you touch any
  of these principles, update this file in the same PR.
