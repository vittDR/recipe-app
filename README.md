# DINEAMITE

A small installable web app (PWA) that helps a couple pick tonight's dinner together in under two minutes and keep one shared, live grocery list. It's in English and French.

Running costs are €0: Supabase free tier, Cloudflare Pages free tier and Web Push. There are no AI calls.

## How it fits together

```
web/                    Vite + React + TypeScript PWA (Cloudflare Pages)
  src/i18n/             en.ts is the source of truth; fr.ts must match its shape
  src/styles/tokens.css generated from design/tokens.json (npm run theme)
  src/sw.ts             service worker: offline shell, push, notification taps
supabase/
  migrations/           schema, server rules (matching, tie-break, lists), RLS, cron
  seed.sql              ingredient catalogue (EN/FR/IT)
  seed_library.sql      110 seed recipes, generated from seed/recipes.json (don't edit)
  seed/                 the seed library source: recipes.json + review sheet
  functions/            edge functions (Deno)
    deal-deck/          scores the library and deals tonight's 12 cards
    import-recipe/      reads schema.org recipe data from a link, saves recipes
    push-dispatch/      sends queued notifications as Web Push (run by pg_cron)
    _shared/logic/      pure TypeScript shared with the web app, with tests
  tests/                runs every migration on plain Postgres and checks the rules
scripts/                build-seed-library.ts, download_images.py
design/tokens.json      Household Warm tokens (placeholder until the real file lands)
```

Key rules from the handover, and where they live:

| Rule | Where |
| --- | --- |
| Each person's goals and portions stay private; the partner sees only "fits" | RLS + `member_fits()` / `my_portion()` |
| Swipes hidden until you finish the deck | `swipes_select` policy |
| First mutual yes in deck order wins; others offered | `resolve_deck()`, `deck_matches()` |
| Tie-break: 3 near-misses, Must-have counts double; same pick wins, else best fit | `tiebreak_options()`, `on_tiebreak_pick()` |
| Just-me deck skips matching | `on_swipe()` |
| One pot, plates sized by calorie target; fits within 15% protein | `logic/portions.ts`, `my_portion()` |
| 12 cards, ~8 known + 4 new, never/diet/time/recently-cooked filters | `logic/deck.ts` |
| Patterns suggested at 8 of the last 10 exposures; apply only once accepted | `logic/preferences.ts`, Us tab |
| List merges same name + unit; staples start unchecked | `add_grocery_items()`, `logic/groceries.ts` |
| 17:30 prompt on cook days, reminder later, once per local day | `enqueue_due_prompts()` + pg_cron |

## One-time setup

Follow **[docs/SETUP.md](docs/SETUP.md)** step by step: database, email + password sign-in (no emails sent), functions and notifications, Cloudflare Pages, installing on the iPhones, and keep-alive.

## Development

```bash
cd web && npm install && npm run dev   # http://localhost:5173, talks to the real project
npm run test:logic                     # (repo root) shared logic tests
npm run test:sql                       # (repo root) needs a local Postgres + psql
```

- Seed library: edit `supabase/seed/recipes.json` (format in [docs/recipe-template.md](docs/recipe-template.md), collection rules in [docs/recipe-collection-guidelines.md](docs/recipe-collection-guidelines.md)), then run `npm run test:sql` and `node scripts/build-seed-library.ts` to regenerate `seed_library.sql`. The script uses the app's own parser and fails on any line that doesn't match the catalogue.
- Strings: add to `web/src/i18n/en.ts`, then `fr.ts`; TypeScript flags a missing translation.
- Theme: edit `design/tokens.json`, then run `npm run theme` in `web/`. Never hand-edit `tokens.css`.
- Icons: edit `web/public/favicon.svg`, then run `NODE_PATH=$(npm root -g) npm run icons` (needs Playwright).

## Not built yet

- Recipe import from Instagram captions and photos. Without AI, Instagram links fall back to typing the recipe in, with the link pre-filled.
- An AI fallback for pages that don't publish recipe data.
- Recipe editing, empty-state polish and screen-by-screen dark-mode design.
- Carrefour Drive export.
