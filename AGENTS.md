# AGENTS.md

**Read this first.** It's the entry point for any AI coding assistant
working in this repo.

## Your primary contract

Every rule in [`docs/PRINCIPLES.md`](docs/PRINCIPLES.md) applies to
you. Load that file into context before making non-trivial changes.

Short summary:

1. **Reuse before you build.** Check
   `apps/web/src/components/ui/index.ts` for the shared atoms
   (`TempPill`, `GlassCard`, `SyncBadge`, `RelativeTime`, `Toggle`,
   `SortDropdown`). Extract a new atom when you'd write the same
   `className` string a third time.
2. **Never re-inline visual patterns.** If two lists render "photo +
   metadata + trailing chip", they share a component.
3. **Data flow is one-way.** `lakes_current` is only written by the
   daily Open-Meteo worker. `lakes_history` accepts multiple sources,
   dedupe is enforced by the unique index `(lake_id, measured_at,
   source)`.
4. **Security defaults matter.** Service role key server-side only,
   RLS on every table, external images through `/api/img` proxy,
   `rel="noreferrer noopener"` on external links.
5. **Test gates:** `pnpm --filter web test && pnpm --filter web lint
   && pnpm --filter web tsc --noEmit && pnpm i18n:check && pnpm
   --filter web build`. All five green before PR.
6. **Every user-facing string** flows through `useT()` / `useP()`.
   Three locales: `en` (source), `cs`, `de`. i18n parity is a CI gate.
7. **Playwright audit** before shipping map / landing / detail
   changes. Zero console errors expected.
8. **Commit hygiene:** imperative subject ≤72 chars, WHY paragraph
   below. Never commit `.env.local` / service role keys / API keys /
   satellite data caches.

## What you should NOT do

- Guess product decisions. Ask the user in the same message before
  making a call on colours / decimals / data-model shape.
- Add a new third-party dependency without asking.
- Bypass the test gate to get "back to work". A red main is worse
  than a delayed PR.
- Silently overwrite `lakes_current` from a script. That's the
  single source of live temperature for the whole map.
- Write raw SQL with string interpolation. Use Supabase JS
  `.eq()`/`.in()`/`.gt()` instead.

## When you touch the map

Read the block-comments in `apps/web/src/components/map/map-view.tsx`
around lines 300–350 first — they encode three hard-won lessons
(font/glyphs unification, setStyle wipe recovery, and duplicate-handler
prevention) that took two sessions to debug. Any regression here
should trigger a Playwright audit + a manual browser check on all
four basemaps (Light / Dark / Streets / Satellite).

## When you touch data

- Reach for the operator scripts in
  `services/openmeteo-refresh/src/`. Don't shell into psql for
  routine changes.
- Migrations go under `supabase/migrations/` in monotonically
  increasing filenames. Apply with `supabase db push` against the
  linked project.
- Never write to production Supabase from your machine without
  showing the change to the user first (a dry-run flag is preferred).

## Full principle set

[`docs/PRINCIPLES.md`](docs/PRINCIPLES.md) is the source of truth.
This file exists so AI assistants have a short landing page; the
principles doc is where the details live and where new lessons are
added.
