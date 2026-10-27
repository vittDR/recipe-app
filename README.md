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
  seed.sql              ingredient catalogue (EN/FR) + 14 starter recipes
  functions/            edge functions (Deno)
    deal-deck/          scores the library and deals tonight's 12 cards
    import-recipe/      reads schema.org recipe data from a link, saves recipes
    push-dispatch/      sends queued notifications as Web Push (run by pg_cron)
    _shared/logic/      pure TypeScript shared with the web app, with tests
  tests/                runs every migration on plain Postgres and checks the rules
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

You need Node 22 and the Supabase CLI (`npx supabase …` works without installing it).

### 1. Database

```bash
npx supabase login
npx supabase link --project-ref grvkstzctekisscvfroy
npx supabase db push            # applies supabase/migrations
```

Then open **SQL Editor** in the dashboard, paste the contents of `supabase/seed.sql`, and run it. This loads the ingredient catalogue and the starter recipes.

The migration enables `pg_cron` and `pg_net` itself. If it reports that it can't, enable both under **Database → Extensions** and run `db push` again.

### 2. Sign-in by email code

The app signs in with a 6-digit email code, not a magic link. On iPhone, a link would open in Safari instead of the installed app.

1. **Authentication → Sign In / Providers → Email**: keep it enabled. Set the OTP length to 6 if it isn't already.
2. **Authentication → Email Templates → Magic Link**: put the code in the email body, for example `Your DINEAMITE code: {{ .Token }}`.
3. **Authentication → URL Configuration**: set the Site URL to your Cloudflare Pages URL (step 4).
4. Supabase's built-in mailer only delivers to the project's team members and is heavily rate-limited. Either invite both of your email addresses to the Supabase project, or plug in a free SMTP service (Brevo or Resend free tier) under **Authentication → SMTP Settings**.

### 3. Notifications (Web Push)

```bash
npx web-push generate-vapid-keys          # prints a public and a private key
npx supabase secrets set \
  VAPID_PUBLIC_KEY=<public> VAPID_PRIVATE_KEY=<private> \
  VAPID_SUBJECT=mailto:you@example.com \
  CRON_SECRET=$(openssl rand -hex 24)
npx supabase functions deploy deal-deck
npx supabase functions deploy import-recipe
npx supabase functions deploy push-dispatch
```

Tell the minute-by-minute cron job where to send pushes. Run this in the SQL Editor, using the same `CRON_SECRET` as above:

```sql
select vault.create_secret('https://grvkstzctekisscvfroy.supabase.co/functions/v1/push-dispatch', 'push_dispatch_url');
select vault.create_secret('<CRON_SECRET>', 'cron_secret');
```

Put the VAPID **public** key in `web/.env` (`VITE_VAPID_PUBLIC_KEY`) and in the Cloudflare build settings.

On iPhone, notifications only work once DINEAMITE is on the Home Screen (Safari → Share → Add to Home Screen, iOS 16.4 or later). Then turn them on from the **Us** tab.

### 4. Hosting (Cloudflare Pages)

In the Cloudflare dashboard, go to **Workers & Pages → Create → Pages → Connect to Git** and pick this repository. Use these settings:

- Root directory: `web`
- Build command: `npm run build`
- Build output directory: `dist`
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_VAPID_PUBLIC_KEY` (values from `web/.env`) and `NODE_VERSION=22`

Pages serves `index.html` for every path, so links like `/join/ABC234` work.

### 5. Keep the free project awake

Free Supabase projects pause after a week with no activity. `.github/workflows/keep-alive.yml` pings the API once a day, and GitHub runs it for free.

## Development

```bash
cd web && npm install && npm run dev   # http://localhost:5173, talks to the real project
npm run test:logic                     # (repo root) shared logic tests
npm run test:sql                       # (repo root) needs a local Postgres + psql
```

- Strings: add to `web/src/i18n/en.ts`, then `fr.ts`; TypeScript flags a missing translation.
- Theme: edit `design/tokens.json`, then run `npm run theme` in `web/`. Never hand-edit `tokens.css`.
- Icons: edit `web/public/favicon.svg`, then run `NODE_PATH=$(npm root -g) npm run icons` (needs Playwright).

## Not built yet

- Recipe import from Instagram captions and photos. Without AI, Instagram links fall back to typing the recipe in, with the link pre-filled.
- An AI fallback for pages that don't publish recipe data.
- A bulk import for the seed library (a few hundred recipes from the sources you pick).
- Recipe editing, empty-state polish and screen-by-screen dark-mode design.
- Carrefour Drive export.
