# DINEAMITE

A small installable web app (PWA) that helps a couple pick tonight's dinner together in under two minutes and keep one shared, live grocery list. It's in English and French.

Running costs are €0: Supabase free tier, Cloudflare Pages free tier and Web Push. There are no AI calls.

## How it fits together

```
web/                    Vite + React + TypeScript PWA (Cloudflare Pages)
  src/i18n/             en.ts is the source of truth; fr.ts must match its shape
  src/styles/tokens.css generated from design/tokens.json + tokens.app.json (npm run theme)
  src/sw.ts             service worker: offline shell, cached photos, push, notification taps
  src/lib/cache.ts      catalogues and grocery setup kept on the phone
  src/lib/theme.ts      light / dark / automatic, saved per device
supabase/
  migrations/           schema, server rules (matching, no match, lists), RLS, cron
  seed.sql              ingredient catalogue (EN/FR/IT) and its grocery products
  personal/             one-off data for a household (a frequently-bought list, a head start for usuals)
  seed_library.sql      319 seed recipes, generated from seed/recipes.json (don't edit)
  seed/                 the seed library source: recipes.json + review sheet
  functions/            edge functions (Deno)
    deal-deck/          scores the library and deals tonight's 12 cards
    import-recipe/      reads schema.org recipe data from a link, saves recipes
    push-dispatch/      sends queued notifications as Web Push (run by pg_cron)
    _shared/logic/      pure TypeScript shared with the web app, with tests
  tests/                runs every migration on plain Postgres and checks the rules
scripts/                build-seed-library.ts, download_images.py, make_thumbnails.py,
                        supabase-sql.sh (run SQL on the live project)
.github/workflows/      ci.yml (tests, seed check, build), keep-alive.yml
design/                 Household Warm v2: tokens.json (the design system's file, as delivered),
                        tokens.app.json (app-only extras), README.md (brand book), components/
                        (component rules), screens/ (reference renders), HANDOFF.md (intents)
```

Key rules from the handover, and where they live:

| Rule | Where |
| --- | --- |
| Each person's goals and portions stay private; the partner sees only "fits" | RLS + `member_fits()` / `my_portion()` |
| Swipes hidden until you finish the deck | `swipes_select` policy |
| First mutual yes in deck order wins; others offered | `resolve_deck()`, `deck_matches()` |
| No veto, no tie-break: when nobody agreed the deck ends as no match and Ce soir offers a new one, which leaves out those cards and leans towards what anyone liked in them | `resolve_deck()`, `deal-deck` (`exclude`, `lean` in `logic/deck.ts`) |
| Undo on the swipe screen takes back your last choice (and its pass reason) until you finish the deck | `undo_swipe()` |
| One deck per evening on Ce soir; settings are a one-line summary over a sheet, defaulting silently to both of you, under an hour and the mood you say yes to most. Done swiping, Ce soir shows who's still swiping and the nudge; decided, tonight's dish, what's coming up and one groceries card for every planned meal | `screens/Tonight.tsx`, `components/DeckSettings.tsx` |
| After a match, "What do you already have?": probably-owned items ticked (staples, bought recently, already listed), the rest goes to the list | `components/AddToListSheet.tsx`, `proposeListItems()` |
| Just-me deck skips matching | `on_swipe()` |
| One pot; each plate is that person's servings (1 by default); fits = calories within 20% of target and protein at least 85% | `logic/portions.ts`, `my_portion()` |
| 12 cards in three tiers, at least 3 of them seasonal dishes in season this month (from their main ingredients; out-of-season ones rank lower): 5 very close to everyone's taste, 5 close (may lean to one person, labelled), 2 wildcards that fit everyone's calorie and protein goals but take liberties with taste; never/diet/time/recently-cooked filters | `logic/deck.ts` |
| Recommendation: taste (profile averaged per kind of feature) and diet kept apart: passes on dishes that don't fit someone's goals barely count against them, and how strictly they stick to goals only sets how much fit weighs; an exploration bonus for unknown kinds of dish, varied decks, and a treat slot for people who mind their diet | `logic/recommend.ts`, `logic/deck.ts` |
| Taste profile from every recorded choice: deck swipes (pass reasons: not tonight / too long / had recently count nothing, not for me in full), a 20-card taste quiz in onboarding (with undo, and "I like it, but not often": a like for taste, and that kind of dish becomes occasional: one per deck at most, none within 14 days of eating one), cooked meals and a rating after eating (loved +2 … not again −2); older choices fade (half-life 180 days); shown on the Us tab | `logic/profile.ts`, `taste_signals`, `screens/onboarding/TasteQuiz.tsx` |
| Allergies are a person's but rule out a recipe for every deck they eat from, on any line (optional and staples too). People pick from the EU's 14 allergens, each linked to the catalogue ingredients and preparations that contain it (`allergen_ingredients`, in seed.sql), or any catalogue item | `member_allergies`, `passesHardFilters()`, `components/Allergies.tsx` |
| Patterns suggested at 8 of the last 10 exposures; apply only once accepted | `logic/preferences.ts`, Us tab |
| Every recipe (seed, imported, typed) is classified from its ingredients, amounts, steps and tags: protein, starch, dish family, sauce, cooking method, chilli heat, how saucy, lean / high protein, comfort / light / treat. Stored on the recipe (worked out by deal-deck) and cleared when the recipe, its ingredients, the ingredient catalogue or the rules change; only diet, health and mood show as tags, the rest feeds the deck. Learning uses it as namespaced features, and a pass in a mood deck counts half | `logic/classify.ts`, `recipes.classification`, `ingredient_catalog.traits`, [docs/recipe-classification.md](docs/recipe-classification.md) |
| Recipes tab filters (healthy, comfort, high protein, diet, veggie, fish, quick, one pot, easy, everyday ingredients); difficulty, coarse equipment, exotic ingredients | `logic/facets.ts`, `ingredient_catalog.exotic` |
| List lines are real products (chicken breast = Blanc de poulet = petto di pollo; plain "poulet" is its own item), French first; a recipe adds to a line of the same product + unit; staples start unchecked | `products`, `put_grocery_item()`, `logic/products.ts`, `mergeTarget()` in `logic/groceries.ts` |
| Stores (Picard…) are list sections among the aisles | `household_stores`, `household_products`, `set_product_section()` |
| Every list change (typed, usuals, from a recipe) shows at once and saves in the background (ids made on the phone, retried 1 s / 3 s / 10 s, then 10 min) | `logic/listsync.ts`, `web/src/lib/listQueue.ts`, `put_grocery_item()` |
| Products carry a usual amount and units; only people in `app_admins` edit the shared catalogue (nobody else sees the entry) | `apply_product_defaults()`, `app_admins`, `is_catalog_admin()`, Us > Edit the catalog |
| Many households, one copy of the app: each sees the shared catalogue, seed library and tags plus its own rows, never another's; one household per person | RLS on `my_household_id()`, `check_household_refs()`, `tests/households_isolation_test.sql` |
| Usuals = checked-off purchases, halving monthly; due again past the median gap | `logic/usuals.ts` |
| "<name> added N items" pushed after 5 quiet minutes, not to people looking at the list; per-kind switches | `enqueue_grocery_pushes()`, `grocery_presence`, `profiles.push_muted` |
| 17:30 prompt on cook days, reminder later, once per local day (windows that cross midnight still fire) | `enqueue_due_prompts()` + pg_cron |
| Cook days: the next 7 evenings are set on This week; a date left alone follows the usual week (Us > Usual week) | `plan_dates`, `plan_days`, `is_cook_day()`, `web/src/lib/plan.ts` |
| Catalogues (ingredients, products, tags) stay on the phone and are re-downloaded only when `catalog_version()` changes; recipe photos (900×675 WebP) are cached by the service worker | `web/src/lib/cache.ts`, `catalog_version()`, `src/sw.ts` |
| Language, light / dark / automatic theme and password change live in Us > Profile settings; the theme is saved per device | `web/src/lib/theme.ts`, `screens/ProfileSettings.tsx` |
| Screens are built from the shared components in `components/ui.tsx` (TabHeader, ListRow with icon tiles, Chip and fact chips, Section, SectionHeading, SheetHeader, confirmation sheet) and `RecipeBody.tsx`; spacing and colours come from tokens, never inline. Colour = meaning (design/README.md): terracotta for tonight and actions, sage for groceries and at home, iris for the partner, star yellow only for indispensable; you are always `person-1` and the partner `iris` | `components/ui.tsx`, `styles/app.css` |

## One-time setup

Follow **[docs/SETUP.md](docs/SETUP.md)** step by step to run your own copy: Supabase project and database, email + password sign-in (no emails sent), functions and notifications, Cloudflare Pages, installing on phones, and keep-alive. It also documents the database structure and how to add recipes and ingredients.

## Development

```bash
cd web && npm install && npm run dev   # http://localhost:5173, talks to the real project
npm run test:logic                     # (repo root) shared logic tests
npm run test:sql                       # (repo root) needs a local Postgres + psql
cd web && npm run typecheck && npm run lint
```

To skip signing in while developing, run `scripts/dev-account.sh` once. It creates a dev account on the project in `web/.env`, with its own household (named "Dev kitchen") and onboarding already done. It saves the account's email and password in `web/.env.development.local`, which git ignores. After that, `npm run dev` opens the app already signed in as that account. Production builds never sign in automatically.

CI (`.github/workflows/ci.yml`) runs the logic tests, the SQL tests, checks that `seed_library.sql` matches `recipes.json`, and builds the web app on every push and pull request.

To query or patch the live database, `scripts/supabase-sql.sh "select 1"` (or `< file.sql`) runs SQL through the Supabase management API on the project named in `web/.env`. It needs `SUPABASE_ACCESS_TOKEN` (a personal access token) and `jq`.

> **Warning:** `.claude/settings.json` pre-approves `scripts/supabase-sql.sh` for Claude Code, so by default Claude can run any SQL against the live Supabase database (reads, writes, schema changes, deletes) without asking first, whenever `SUPABASE_ACCESS_TOKEN` is set in its environment. Remove those `permissions.allow` entries if you want a prompt before each call, and don't give Claude a token for a project you aren't willing to let it change.

- Seed library: edit `supabase/seed/recipes.json` (format in [docs/recipe-template.md](docs/recipe-template.md), collection rules in [docs/recipe-collection-guidelines.md](docs/recipe-collection-guidelines.md)), then run `npm run test:sql` and `node scripts/build-seed-library.ts` to regenerate `seed_library.sql`. The script uses the app's own parser and fails on any line that doesn't match the catalogue.
- Strings: add to `web/src/i18n/en.ts`, then `fr.ts`; TypeScript flags a missing translation.
- Theme: replace `design/tokens.json` with the design system's latest file (app-only tokens go in `design/tokens.app.json`), then run `npm run theme` in `web/`. Never hand-edit `tokens.css`.
- Icons: edit `web/public/favicon.svg`, then run `NODE_PATH=$(npm root -g) npm run icons` (needs Playwright).

## Not built yet

- Recipe import from Instagram captions and photos. Without AI, Instagram links fall back to typing the recipe in, with the link pre-filled.
- An AI fallback for pages that don't publish recipe data.
- Recipe editing and empty-state polish. Dark tokens come from the design system, but screens haven't had a dark-mode design pass.
- From the design handoff: "Photograph a recipe" (needs OCR). Not planned: a cooking reminder, and "suggest it tonight" after saving a recipe.
- Carrefour Drive export.
