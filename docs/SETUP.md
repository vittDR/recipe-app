# DINEAMITE: set up your own copy

This guide takes you from nothing to your own DINEAMITE running on your own
Supabase project and your own Cloudflare Pages address. Do the steps in order;
plan for about an hour. Everything fits in the free tiers, and there are no AI
or paid API calls.

The second half of the guide is a reference: how the database is laid out, and
how to add recipes and ingredients.

**Contents**

- [What you need](#what-you-need)
- [Step 0: Fork and clone the repository](#step-0-fork-and-clone-the-repository)
- [Step 1: Create the Supabase project](#step-1-create-the-supabase-project)
- [Step 2: Point the code at your project](#step-2-point-the-code-at-your-project)
- [Step 3: Create the database](#step-3-create-the-database)
- [Step 4: Sign-in with email + password](#step-4-sign-in-with-email--password)
- [Step 5: Server functions and notifications](#step-5-server-functions-and-notifications)
- [Step 6: Put the app online with Cloudflare Pages](#step-6-put-the-app-online-with-cloudflare-pages)
- [Step 7: Install it on your phones and try it](#step-7-install-it-on-your-phones-and-try-it)
- [Step 8: Keep the free project awake](#step-8-keep-the-free-project-awake)
- [Reference: database structure](#reference-database-structure)
- [Reference: adding recipes](#reference-adding-recipes)
- [Reference: adding ingredients to the catalogue](#reference-adding-ingredients-to-the-catalogue)
- [Local development and tests](#local-development-and-tests)
- [If something goes wrong](#if-something-goes-wrong)

Supabase and Cloudflare rename menus from time to time. If a label below
doesn't match exactly, look for the closest one.

---

## What you need

- A **GitHub** account (to fork the code, and for the free keep-alive job).
- A **Supabase** account: https://supabase.com. The free plan is enough.
- A **Cloudflare** account: https://dash.cloudflare.com. The free plan is enough.
- A computer with:
  - **Node.js 22**: check with `node -v`. If you don't have it, install the LTS from nodejs.org.
  - **git**: check with `git --version`.
- Phones to install the app on. iPhones need iOS 16.4 or later for notifications, and the app must be installed from Safari.

Throughout this guide, replace these placeholders with your own values:

| Placeholder | What it is | Where you find it |
| --- | --- | --- |
| `<you>` | Your GitHub user or organisation | GitHub |
| `<project-ref>` | Your Supabase project's ID, about 20 lowercase letters | Supabase **Project Settings → General**, or the `https://<project-ref>.supabase.co` URL |
| `<publishable-key>` | Public API key, starts with `sb_publishable_` | Supabase **Project Settings → API Keys** |
| `<secret-key>` | Server-only API key, starts with `sb_secret_` | Supabase **Project Settings → API Keys** |
| `<db-password>` | The database password | You choose it in Step 1 |

---

## Step 0: Fork and clone the repository

1. Open the repository on GitHub and click **Fork**. Keep the default branch (`main`).
2. Clone your fork:
   ```bash
   git clone https://github.com/<you>/recipe-app.git
   cd recipe-app
   ```

All commands in this guide run from the `recipe-app` folder unless they say otherwise.

---

## Step 1: Create the Supabase project

1. In the Supabase dashboard, click **New project**.
2. Fill in:
   - **Name**: anything, for example `dineamite`.
   - **Database password**: generate a strong one and **save it somewhere safe**. You need it in Step 3. (If you lose it: **Project Settings → Database → Reset database password**.)
   - **Region**: the one closest to you.
3. Click **Create new project** and wait a minute or two until it's ready.
4. Note the `<project-ref>` (it's in the project URL) and, from **Project Settings → API Keys**, the **publishable key**.

   If your project only shows the older **anon** and **service_role** keys, those work too: use `anon` wherever this guide says publishable key and `service_role` wherever it says secret key.

5. Enable two extensions before creating the database, so the scheduled jobs get set up: open **Database → Extensions**, search for **pg_cron** and turn it on, then do the same for **pg_net**.

---

## Step 2: Point the code at your project

Three files in the repository name the original project. Change them to yours.

1. **`web/.env`**: the web app's settings. Replace the first two values with yours and leave the last one for Step 5:
   ```
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
   VITE_VAPID_PUBLIC_KEY=
   ```
   Everything in this file is public by design: it ends up in the app that every visitor downloads. **Never put the secret key here.**

   The file is listed in `.gitignore` but is already tracked, so git still picks up your changes. That's on purpose: Cloudflare builds the app from it.

2. **`.github/workflows/keep-alive.yml`**: replace the project URL and the `apikey` value with your `<project-ref>` and `<publishable-key>`.

3. **`supabase/config.toml`**: set `project_id = "<project-ref>"`. (This is only a label for the Supabase CLI; `supabase link` in Step 3 is what actually connects the folder.)

Commit and push:

```bash
git add web/.env .github/workflows/keep-alive.yml supabase/config.toml
git commit -m "Point the app at my Supabase project"
git push
```

---

## Step 3: Create the database

`npx supabase` downloads the Supabase CLI the first time you use it.

1. **Log the CLI in to your Supabase account:**
   ```bash
   npx supabase login
   ```
   A browser tab opens. Approve it, then go back to the terminal.

2. **Link this folder to your project:**
   ```bash
   npx supabase link --project-ref <project-ref>
   ```
   Enter the database password when asked.

3. **Create all the tables, rules and scheduled jobs:**
   ```bash
   npx supabase db push
   ```
   It lists every file in `supabase/migrations/` (schema, functions, RLS, platform, and the later changes) and asks you to confirm. Type `Y`.

   - If it fails on the `…_platform` migration with a permissions error about `pg_cron`, `pg_net` or `storage`, check that both extensions are enabled (Step 1.5) and run `npx supabase db push` again. Migrations that already applied are skipped.
   - If you forgot Step 1.5 and the push succeeded anyway, the scheduled jobs were silently skipped. See [Scheduled jobs are missing](#if-something-goes-wrong) at the end.

4. **Load the ingredient catalogue and the recipe library.** The migrations create empty tables; these two files fill them.

   - `supabase/seed.sql`: the ingredient catalogue (about 190 ingredients with EN/FR/IT names, aisles and nutrition).
   - `supabase/seed_library.sql`: the 110 seed recipes. Load it **after** `seed.sql`.

   Either paste them into the dashboard:
   1. Open **SQL Editor → New query**.
   2. Open `supabase/seed.sql` in a text editor, copy everything, paste it into the editor and click **Run**. It should say *Success. No rows returned*.
   3. Open a new query and do the same with `supabase/seed_library.sql`. It's about 400 KB, so give the editor a few seconds after pasting.

   Or, if you have `psql` installed, run them from the terminal with the connection string from the dashboard's **Connect** button (use the *Session pooler* string and put your database password in it):
   ```bash
   psql "<connection string>" -f supabase/seed.sql
   ```
   ```bash
   psql "<connection string>" -f supabase/seed_library.sql
   ```

   Both files are safe to run again: they skip whatever is already loaded.

5. **Check it worked:**
   - **Table Editor** lists `households`, `recipes`, `grocery_items` and the other tables (the full list is in the [database reference](#reference-database-structure)).
   - `recipes` has 110 rows and `ingredient_catalog` has about 190.
   - **Integrations → Cron** (or **Database → Cron Jobs**) shows three jobs: `dineamite-prompts`, `dineamite-purge-invites` and `dineamite-push-dispatch`.
   - **Storage** shows a private bucket called `recipe-images`.

---

## Step 4: Sign-in with email + password

DINEAMITE signs people in with an email and a password. Supabase never sends any email, so you don't need a mail service or SMTP.

1. In the dashboard, open **Authentication → Sign In / Providers**.
2. Under **User Signups**, keep **Allow new users to sign up** **on** for now.
3. Click **Email** in the provider list and set:
   - **Enable Email provider**: on
   - **Confirm email**: **off**. This is the important one: with it on, Supabase would try to send a confirmation email and sign-up would stall.
   - **Minimum password length**: `8`, if the field is there.
4. Click **Save**.

**Test it locally:**

```bash
cd web
npm install
npm run dev
```

1. Open http://localhost:5173.
2. Click **Get started**, then enter an email and a password of 8 or more characters.
3. You should land straight on the "About you" screen. **Authentication → Users** now lists the account.
4. Press `Ctrl+C` in the terminal to stop, and `cd ..` back to the repository folder.

**Once everyone in your household has an account** (Step 7), come back here and turn **Allow new users to sign up** **off**. Nobody else can then create an account on your project. Strangers couldn't see your data anyway (row-level security keeps every household separate), but this keeps the project to just you.

**Forgotten password.** There's no reset email, so set a new password from the dashboard:
1. Open **SQL Editor** and run this, with the person's email and a new password:
   ```sql
   update auth.users
   set encrypted_password = extensions.crypt('NewPassword123', extensions.gen_salt('bf'))
   where email = 'someone@example.com';
   ```
2. They sign in with that password.
3. They change it in the app under **Us → Change password**.

---

## Step 5: Server functions and notifications

The app has three edge functions (Deno, in `supabase/functions/`):

| Function | What it does | Called by |
| --- | --- | --- |
| `deal-deck` | Scores the recipe library and deals tonight's 12 cards | The app |
| `import-recipe` | Reads schema.org recipe data from a link, and saves recipes (works out ingredients and macros) | The app |
| `push-dispatch` | Sends queued notifications as Web Push | `pg_cron`, every minute |

### 5a. Generate notification keys and a cron secret

```bash
npx web-push generate-vapid-keys
```

It prints a **Public Key** and a **Private Key**. Keep both for the next few minutes.

Then generate a random secret that lets the cron job call `push-dispatch`:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

This guide calls that value `<cron-secret>`.

### 5b. Store the secrets for the functions

Copy the **secret key** from **Project Settings → API Keys** (click to reveal it). **Never put it in the app, in git, or in a chat.** Then run one command with your real values:

```bash
npx supabase secrets set \
  VAPID_PUBLIC_KEY=<public key from 5a> \
  VAPID_PRIVATE_KEY=<private key from 5a> \
  VAPID_SUBJECT=mailto:<your email> \
  CRON_SECRET=<cron-secret> \
  PUBLISHABLE_KEY=<publishable-key> \
  SECRET_KEY=<secret-key>
```

| Secret | Used for |
| --- | --- |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Signing Web Push messages |
| `VAPID_SUBJECT` | A contact address push services can reach if something goes wrong. A `mailto:` link. |
| `CRON_SECRET` | `push-dispatch` only runs when called with it |
| `PUBLISHABLE_KEY` | The functions check who's calling with it. Falls back to the built-in `SUPABASE_ANON_KEY` if unset. |
| `SECRET_KEY` | Server-side writes (dealing decks, saving imports). Falls back to the built-in `SUPABASE_SERVICE_ROLE_KEY` if unset. |

Check with `npx supabase secrets list`. It shows the names, not the values.

### 5c. Deploy the three functions

```bash
npx supabase functions deploy deal-deck
```
```bash
npx supabase functions deploy import-recipe
```
```bash
npx supabase functions deploy push-dispatch
```

If the CLI complains that Docker isn't running, add `--use-api` to each command, for example `npx supabase functions deploy deal-deck --use-api`.

All three now appear under **Edge Functions** in the dashboard. `supabase/config.toml` turns off the platform's JWT check for them (`verify_jwt = false`) because each function checks the caller itself.

### 5d. Tell the cron job where to send notifications

The `dineamite-push-dispatch` cron job reads the function's address and the cron secret from Supabase Vault. In **SQL Editor → New query**, run:

```sql
select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/push-dispatch', 'push_dispatch_url');
select vault.create_secret('<cron-secret>', 'cron_secret');
```

Use the same `<cron-secret>` as in 5b. To change one of these later, delete it under **Project Settings → Vault** and create it again.

### 5e. Put the public notification key in the app

1. In `web/.env`, fill in the last line with the **public** key from 5a:
   ```
   VITE_VAPID_PUBLIC_KEY=<public key>
   ```
   Only the public key goes here. It's safe to commit.
2. Commit and push:
   ```bash
   git add web/.env
   git commit -m "Set Web Push public key"
   git push
   ```

---

## Step 6: Put the app online with Cloudflare Pages

1. **Start the import:** in the Cloudflare dashboard go to **Workers & Pages → Create**, choose the **Pages** tab, then **Import an existing Git repository**.
2. **Pick the repository:** connect your GitHub account. When GitHub asks, allow access to `<you>/recipe-app` only, then select it.
3. **Fill in the build settings:**

   | Setting | Value |
   | --- | --- |
   | Project name | Anything, for example `dineamite`. It becomes your address: `https://<name>.pages.dev`. |
   | Production branch | `main` |
   | Framework preset | **None** |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory (under *Advanced*) | `web` |
   | Environment variable | `NODE_VERSION` = `22` |

   The Supabase URL, publishable key and VAPID public key come from `web/.env` in the repository, so you don't add them here. (If you'd rather keep them out of git, add `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_VAPID_PUBLIC_KEY` as environment variables here instead; Vite reads both.)
4. **Deploy:** click **Save and Deploy**. The first build takes 1–2 minutes. Every later push to `main` redeploys automatically, and other branches get their own preview address.
5. **Optional:** back in Supabase, open **Authentication → URL Configuration**, set **Site URL** to your Pages address and click **Save**. Password sign-in doesn't depend on it.
6. **Optional, custom domain:** in your Pages project, open **Custom domains → Set up a custom domain**. Web Push and installing to the home screen need HTTPS, which Cloudflare provides.

`web/public/_headers` tells Cloudflare not to cache the service worker and manifest, so a new deploy reaches phones on the next launch.

---

## Step 7: Install it on your phones and try it

Each person does this.

1. **Install the app:**
   - **iPhone**: open your Pages address in **Safari** (it has to be Safari), tap **Share → Add to Home Screen → Add**, then open DINEAMITE **from the Home Screen icon**. Do everything from here on inside that app, not in Safari: the installed app keeps its own sign-in.
   - **Android**: open the address in Chrome and tap **Install app** (or **⋮ → Add to Home screen**).
2. **First person:**
   1. Tap **Get started** (or **I already have an account** if you made one in Step 4) and enter an email and password.
   2. Enter a first name and choose a colour and language.
   3. Create the household, for example "Chez nous".
   4. On the invite screen, tap **Share invite** and send it to your partner, or read them the 6-character code. It's valid for 48 hours.
3. **Second person:**
   1. Install the app first, as in item 1.
   2. Open it, tap **I have an invite code**, and create an account.
   3. After the name step, enter the code and tap **Join**.

   The invite link works too, but on iPhone it opens in Safari, so entering the code inside the installed app is simpler.
4. **Everyone:** set goals and tastes.
5. **Notifications:** open the **Us** tab, tap **Turn on notifications**, and allow them.
6. **Test the Tonight flow:**
   1. One person deals a deck from **Tonight**.
   2. The other gets a notification within about a minute and joins.
   3. Both swipe and get a match, or a tie-break.
   4. Tap **Add to list** and check that the items appear on the other phone's **Groceries** tab.

Then turn off sign-ups (end of Step 4).

---

## Step 8: Keep the free project awake

Free Supabase projects pause after 7 days without traffic. `.github/workflows/keep-alive.yml` pings yours once a day on GitHub Actions, for free, using the URL and key you set in Step 2.

GitHub turns off scheduled workflows on forks until you enable them:

1. In your fork on GitHub, open **Actions** and click **I understand my workflows, go ahead and enable them**.
2. Open **Keep Supabase awake → Run workflow** and wait for a green tick.

If the project ever does pause, click **Restore project** on the Supabase dashboard. Your data is kept.

---

## Reference: database structure

Everything lives in the `public` schema, created by the files in
`supabase/migrations/` (applied in filename order). The rules both phones must
agree on (matching, tie-break, grocery merging, scheduled prompts) are SQL
functions, so they run in one place.

### The shape of it

```
auth.users ──1:1── profiles ──1:1── member_goals            (private)
                      │      ──1:n── taste_rules            (private)
                      │      ──1:n── learned_patterns       (private)
                      │      ──1:n── push_subscriptions     (private)
                      │
                household_members (one household per user)
                      │
                  households ──1:n── invites
                      │      ──1:n── recipes ──1:n── recipe_ingredients
                      │      ──1:n── decks ──1:n── deck_cards
                      │      │              ──1:n── deck_members
                      │      │              ──1:n── member_portions (private)
                      │      │              ──1:n── swipes
                      │      │              ──1:n── tiebreak_picks
                      │      ──1:n── meals
                      │      ──1:7── plan_days
                      │      ──1:n── grocery_items
                      │      ──1:n── household_staples
                      │      ──1:n── household_aisle_order
                      │      ──1:n── household_stores
                      │      ──1:n── household_products ──n:1── products
                      │      ──1:n── products (the household's own items)

ingredient_catalog   (shared by everyone; recipe_ingredients.name points at it by name)
products with household_id = null   (the shared shopping catalogue; one per catalogue ingredient)
recipes with household_id = null   (the seed library, readable by everyone)
push_outbox, ai_cache   (server only)
```

### Enums

| Type | Values |
| --- | --- |
| `member_role` | `owner`, `member` |
| `goal_kind` | `lean`, `maintain`, `build` |
| `taste_kind` | `never`, `love`, `diet` |
| `rule_source` | `manual`, `learned` |
| `pattern_status` | `suggested`, `accepted`, `dismissed` |
| `recipe_source` | `web`, `instagram`, `photo`, `typed`, `ai`, `seed` |
| `deck_status` | `open`, `matched`, `tiebreak`, `closed` |
| `deck_mood` | `any`, `comfort`, `light`, `quick`, `fancy` |
| `verdict` | `pass`, `yes`, `must` |
| `meal_status` | `planned`, `cooked`, `skipped` |
| `aisle` | `produce`, `meat_fish`, `dairy_eggs`, `bakery`, `pantry`, `spices`, `frozen`, `drinks`, `hygiene`, `household`, `other` |

### People and households

| Table | Key | What it holds |
| --- | --- | --- |
| `profiles` | `id` = `auth.users.id` | First name, colour, locale (`en`/`fr`). Created automatically by a trigger on sign-up. |
| `households` | `id` | Name, owner, IANA `timezone`, `store_name`, `prompt_time` (17:30) and `reminder_time` (18:30), plus `last_prompt_on`/`last_reminder_on` so each prompt goes out once per local day. |
| `household_members` | `(household_id, user_id)` | Who belongs where, with `role`. A unique index allows one household per user; drop `household_members_one_per_user` to allow several. |
| `invites` | `code` | 6-character codes (no `I`, `O`, `0`, `1`), valid 48 hours, single use. Expired ones are purged nightly. |

### Private per-person data

Only the person themselves can read or write these rows.

| Table | What it holds |
| --- | --- |
| `member_goals` | `goal`, `dinner_kcal` (200–3000), `dinner_protein_g` (0–300), `servings` per plate (0.25–4, default 1) |
| `taste_rules` | `kind` + `value`: `never`/`love` a tag or ingredient, or one `diet` rule (`everything`, `pescatarian`, `vegetarian`) |
| `learned_patterns` | Suggested habits as JSON, e.g. `{"kind":"avoid","target":"tag","value":"mushroom"}`, with `evidence_count`, `status` and a scoring `weight` |
| `push_subscriptions` | One row per installed device (Web Push endpoint and keys) |

### Recipes

| Table | What it holds |
| --- | --- |
| `ingredient_catalog` | Canonical ingredients. `name` (lowercase English, primary key), `name_fr`, `name_it`, `aliases[]`, `default_aisle`, `is_staple`, `kcal_100g`, `protein_100g`, `grams_per_unit`, `diet_class` (`veg`/`fish`/`meat`), `exotic`. Readable by every signed-in user. |
| `recipes` | `household_id` (**null = seed library**, shared by everyone), `copied_from`, `title`, `source_type`, `source_url`, `source_name`, `image_path`, `image_source_url`, `servings`, `original_servings`, `total_min`, `steps` (JSON array of strings), `tags[]`, `cuisine`, `language` (`en`/`fr`/`it`), `kcal_per_serving`, `protein_g_per_serving`, `macros_estimated`, `difficulty` (`easy`/`medium`/`hard`), `equipment` (JSON, e.g. `{"pots":2,"oven":true,"special":["blender"]}`). `source_url` is unique per household. |
| `recipe_ingredients` | One row per line: `position`, `name` (the catalogue name when matched), `quantity`, `unit`, `aisle`, `is_staple`, `guessed`, `raw_text` (the line as written), `original_text` (the source's unscaled line). |
| `library_recipes` (view) | What a household sees on the Recipes tab: its own recipes plus the seed library, minus seed recipes it has already copied. |

Households never edit seed recipes directly: `copy_recipe(recipe_id)` makes a
household copy (with its ingredients) the first time someone changes one.

Macros are worked out from the ingredients (catalogue values × quantity,
divided by `servings`), never copied from the source site. A recipe's diet
(veg/fish/meat) isn't stored: it's worked out from its ingredients' `diet_class`
each time a deck is dealt.

### Tonight: decks, swipes, tie-breaks, meals

| Table | What it holds |
| --- | --- |
| `decks` | One deal: `for_date`, `started_by`, `who_eating[]`, `max_minutes`, `mood`, `status`, `matched_recipe_id`. Written by `deal-deck`. |
| `deck_cards` | The 12 cards in order, with `score`, `fit_score` (0..1, used by the tie-break), `fits_all` and an optional `reason`. |
| `member_portions` | Each person's plate for each card: `kcal`, `protein_g`, `servings`, `fits`. Only that person can read their row. |
| `deck_members` | Progress the household can see: `swiped_count`, `finished_at`, `nudged_at`. Counts only, no verdicts. |
| `swipes` | `verdict` per person per card. Hidden from the partner until you've finished the deck too. A trigger (`on_swipe`) resolves the deck when everyone's done. |
| `tiebreak_picks` | Each person's pick among the three tie-break options. |
| `meals` | What's planned or cooked per day (one per household per date). |
| `plan_days` | Per weekday (1 = Monday): `cook_at_home`, plus an optional pre-picked recipe. Drives the 17:30 prompt. |

### Groceries

| Table | What it holds |
| --- | --- |
| `products` | The real items behind list lines: `name_fr` (French first), `name_en`, `aliases[]` (other words and brands: *sopalin*, *pq*), `ingredient` (the catalogue ingredient it is, so recipe lines land on it), `default_aisle`. `household_id` null = the shared catalogue (catalogue ingredients plus everyday non-food items); otherwise an item a household created by typing it. |
| `grocery_items` | The shared list: `product_id`, `name` (the product's French name when added), `quantity`, `unit`, `aisle`, `store_id`, `recipe_id`, who added/checked it, `sort_key`. Cleared items keep a `cleared_at` and stay for "probably at home" hints. |
| `household_stores` | Stores like Picard. Each is a section of the list, ordered among the aisles (same `position` space as `household_aisle_order`). |
| `household_products` | Per household and product: remembered `aisle` or `store_id`, `add_count`, `last_added_at`, and `pinned` / `hidden` for "Frequently bought" (shown when pinned or added at least twice, unless hidden). |
| `household_staples` | Names the household always has at home. |
| `household_aisle_order` | The household's aisle order for their store. |

### Server-only tables

| Table | What it holds |
| --- | --- |
| `push_outbox` | Notifications waiting to be sent: `user_id`, `kind` (`prompt`, `reminder`, `deck_dealt`, `partner_finished`, `match`, `nudge`, `partner_joined`), `payload`, `sent_at`, `error`. Written by triggers and functions, sent by `push-dispatch`. |
| `ai_cache` | Cached link imports, so the same page is never fetched twice. |

### Functions the app calls (RPC)

| Function | What it does |
| --- | --- |
| `create_household(name, timezone)` | Creates the household and makes the caller its owner |
| `create_invite()`, `preview_invite(code)`, `redeem_invite(code)` | Invites |
| `leave_household()`, `remove_member(user)` | Leaving, and the owner removing someone |
| `copy_recipe(recipe)` | Household copy of a seed recipe; returns the copy's id |
| `my_portion(recipe, eaters)` | The caller's plate and whether it fits their goals |
| `member_fits(deck)` | Per card, whether each person fits, without revealing their numbers |
| `deck_matches(deck)`, `tiebreak_options(deck)`, `choose_match(deck, recipe)`, `close_deck(deck)`, `nudge(deck)` | The Tonight flow |
| `add_grocery_items(items)`, `clear_checked_items()` | The list. Items are `{product_id}` or `{name}` (any language or alias; unknown names become a household item). Same product + unit merge into one line. |
| `set_product_section(product, aisle, store)`, `set_frequent(product, on)`, `add_store(name)` | Where a product goes for the household (remembered), "Frequently bought" pin/hide, a new store. |

`enqueue_due_prompts()` and `purge_expired_invites()` are run by `pg_cron`, not by the app.

### Security, live updates, storage and scheduled jobs

- **Row-level security** is on for every table (`…_rls.sql`). The rule of thumb: household data is readable by its members, personal data only by its owner, the catalogue and seed library by everyone signed in, and server tables by nobody but the functions.
- **Realtime** is enabled for `grocery_items`, `household_products`, `household_stores`, `decks`, `deck_members`, `tiebreak_picks` and `meals`, so both phones update live.
- **Storage**: a private `recipe-images` bucket, with files under `<household_id>/…` readable only by that household.
- **pg_cron jobs**: `dineamite-prompts` (every 5 minutes, queues the evening prompt and reminder), `dineamite-push-dispatch` (every minute, only does anything when `push_outbox` has unsent rows), `dineamite-purge-invites` (nightly).

### Changing the schema

Never edit a migration that has already been applied. Add a new file named
`supabase/migrations/<YYYYMMDDHHMMSS>_<what>.sql`, run `npm run test:sql`
locally, then `npx supabase db push`.

---

## Reference: adding recipes

There are three ways, from easiest to most hands-on.

### 1. From the app (one household)

In the **Recipes** tab, tap **Add recipe**:

- **Link.** Paste a recipe link. `import-recipe` reads the page's schema.org recipe data (most big recipe sites publish it), shows it for review, then saves it. Pages without that data fall back to typing.
- **Type it.** One ingredient per line, such as `300 g chicken thigh, diced`.

Either way, the server matches each line against the ingredient catalogue and
works out the macros, aisles and diet. The recipe belongs to your household
only.

### 2. Into the seed library (every household, the recommended bulk route)

The seed library is the set of recipes with `household_id = null` that every
household sees. Its source of truth is `supabase/seed/recipes.json`; the SQL is
generated from it.

1. Add your recipes to `supabase/seed/recipes.json`, one object per recipe. The full field list, ingredient-line format, tags and image specs are in [recipe-template.md](recipe-template.md); collection rules are in [recipe-collection-guidelines.md](recipe-collection-guidelines.md). The short version:
   ```json
   {
     "title": "Chicken coconut rice bowl",
     "language": "en",
     "servings": 2,
     "total_min": 35,
     "source_type": "seed",
     "source_name": "My kitchen",
     "source_url": "https://example.com/chicken-coconut-rice-bowl",
     "image_url": "/recipe-photos/chicken-coconut-rice-bowl.webp",
     "cuisine": "thai",
     "tags": ["chicken", "bowl", "asian", "thai"],
     "difficulty": "easy",
     "equipment": { "pots": 2, "oven": false, "special": [] },
     "ingredients": [
       { "text": "350 g chicken thigh, diced" },
       { "text": "400 ml coconut milk" },
       { "text": "100 g spinach" },
       { "text": "150 g rice" },
       { "text": "1 lime" },
       { "text": "olive oil" },
       { "text": "salt" }
     ],
     "steps": [
       "Cook the rice.",
       "Brown the chicken in a little oil, 5 min.",
       "Add the coconut milk and simmer 15 min, then stir in the spinach.",
       "Serve over the rice with lime wedges."
     ]
   }
   ```
   Give each seed recipe a unique `source_url`: it's how reloading the file skips recipes that are already in.
2. Optional photo: put a 4:3 WebP (900 × 675, under 200 KB) in `web/public/recipe-photos/`, then run `python3 scripts/make_thumbnails.py web/public/recipe-photos`.
3. Regenerate the SQL. This needs a local Postgres (see [Local development](#local-development-and-tests)):
   ```bash
   npm run test:sql
   ```
   ```bash
   node scripts/build-seed-library.ts
   ```
   The script runs every line through the same parser and catalogue as the app, prints each recipe's macros, and **stops on any ingredient the catalogue doesn't know**. Add those first (next section).
4. Load the regenerated `supabase/seed_library.sql` into your project as in Step 3.4. Recipes already loaded are skipped; new ones are added.
5. Commit `recipes.json`, `seed_library.sql` and any photos. CI checks that `seed_library.sql` matches `recipes.json`.

To **change** a seed recipe that's already loaded, delete it in SQL first
(`delete from public.recipes where household_id is null and source_url = '…';`)
and reload: the loader only adds missing recipes. Deleting a seed recipe also
deletes the decks and swipes that used it; households' own copies stay.

### 3. Straight into the database with SQL

Use this for a quick one-off, for example a household recipe without going
through the app. Run it in **SQL Editor**, which bypasses row-level security.
Nothing is computed for you here, so you fill in everything the server would
normally work out:

- Each ingredient's `name` must be an exact `ingredient_catalog.name` (lowercase English), or it adds no macros, falls under the **Other** aisle and counts as vegetarian.
- `kcal_per_serving` and `protein_g_per_serving` are yours to work out. Without them the recipe can't say whether it fits anyone's goals.

```sql
-- household_id: null for the seed library, or a household's id
-- (select id, name from public.households;)
with r as (
  insert into public.recipes (household_id, title, source_type, source_url, source_name,
    image_path, servings, total_min, steps, tags, cuisine, language,
    kcal_per_serving, protein_g_per_serving, macros_estimated, difficulty, equipment)
  values (null, 'Chicken coconut rice bowl', 'seed', 'https://example.com/chicken-coconut-rice-bowl', 'My kitchen',
    null, 2, 35,
    '["Cook the rice.", "Brown the chicken in a little oil, 5 min.", "Add the coconut milk and simmer 15 min, then stir in the spinach.", "Serve over the rice with lime wedges."]'::jsonb,
    array['chicken', 'bowl', 'asian', 'thai'], 'thai', 'en',
    994, 43, true, 'easy', '{"pots": 2, "oven": false, "special": []}'::jsonb)
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle, is_staple, raw_text)
select r.id, v.* from r, (values
  (0, 'chicken thigh', 350::real, 'g', 'meat_fish'::public.aisle, false, '350 g chicken thigh, diced'),
  (1, 'coconut milk', 400::real, 'ml', 'pantry'::public.aisle, false, '400 ml coconut milk'),
  (2, 'spinach', 100::real, 'g', 'produce'::public.aisle, false, '100 g spinach'),
  (3, 'rice', 150::real, 'g', 'pantry'::public.aisle, false, '150 g rice'),
  (4, 'lime', 1::real, 'piece', 'produce'::public.aisle, false, '1 lime'),
  (5, 'olive oil', null::real, null, 'pantry'::public.aisle, true, 'olive oil'),
  (6, 'salt', null::real, null, 'spices'::public.aisle, true, 'salt')
) as v(position, name, quantity, unit, aisle, is_staple, raw_text);
```

To look up the values you need for the macros and aisles:

```sql
select name, default_aisle, is_staple, kcal_100g, protein_100g, grams_per_unit, diet_class
from public.ingredient_catalog
where name in ('chicken thigh', 'coconut milk', 'spinach', 'rice', 'lime');
```

(For the example: 350 g × 177 + 400 ml × 197 + 100 g × 23 + 150 g × 360 + 60 g × 30, all ÷ 100, is about 1,990 kcal for the pot, so 994 per serving.)

If you add seed recipes this way, also add them to `recipes.json` so they
survive a rebuild.

---

## Reference: adding ingredients to the catalogue

Recipes can only be understood in terms of the catalogue, so add an ingredient
before using it. Add it to `supabase/seed.sql` (so it's part of the repository
and every new setup) and run the same statement on your project:

```sql
insert into public.ingredient_catalog
  (name, name_fr, name_it, aliases, default_aisle, is_staple, kcal_100g, protein_100g, grams_per_unit, diet_class, exotic)
values
  ('chorizo', 'chorizo', 'chorizo', '{chorizo sausage}', 'meat_fish', false, 455, 24, 60, 'meat', false)
on conflict (name) do nothing;
```

| Column | Rules |
| --- | --- |
| `name` | Lowercase English, the canonical name |
| `name_fr`, `name_it` | Names in French and Italian; ingredient lines in those languages match on them |
| `aliases` | Other spellings, any language, lowercase |
| `default_aisle` | One of the `aisle` values |
| `is_staple` | `true` for oil, salt, spices and the like: they go on the list unchecked and don't need amounts |
| `kcal_100g`, `protein_100g` | Per 100 g raw, edible weight |
| `grams_per_unit` | Grams in one piece, clove, can… Needed if recipes count it rather than weigh it |
| `diet_class` | `veg`, `fish` or `meat`. **This drives the diet filters**, so get it right. |
| `exotic` | `true` if most French supermarkets don't sell it. Drives the "Everyday ingredients" filter. |

Re-running `seed.sql` also gives each new ingredient its grocery product
(`sync_products_from_catalog()`). Everyday items that aren't recipe
ingredients (shampoo, sopalin…) are rows in `products` with `household_id`
null and no `ingredient`; add them to a new migration.

---

## Local development and tests

```bash
cd web && npm install && npm run dev
```

That starts the app on http://localhost:5173, talking to the Supabase project in `web/.env`.

From the repository folder:

```bash
npm run test:logic
```
```bash
npm run test:sql
```

- `test:logic` runs the shared TypeScript logic tests (deck dealing, portions, ingredient parsing, groceries…) with Node 22.
- `test:sql` applies every migration plus both seed files to a throwaway local database called `dineamite_test`, then runs the SQL tests. It needs a local Postgres 16 and `psql`; set `PGHOST`, `PGUSER` and `PGPASSWORD` if yours isn't the default. It leaves `dineamite_test` behind for `build-seed-library.ts`.

GitHub Actions (`.github/workflows/ci.yml`) runs both, checks that `seed_library.sql` is up to date, and builds the web app on every push.

---

## If something goes wrong

| Symptom | Likely cause / fix |
| --- | --- |
| The app shows a blank page or "Invalid API key" | `web/.env` still has another project's values, or a typo. Fix it (Step 2), push, and wait for Cloudflare to redeploy. |
| "Account created, but email confirmation is still on" | Turn off **Confirm email** (Step 4). Then delete the half-created user in **Authentication → Users** and sign up again. |
| "Wrong email or password" | Check for a typo. Forgotten password: see the end of Step 4. |
| "Deal the deck" fails | Open **Edge Functions → deal-deck → Logs**. A missing key error means Step 5b is incomplete. `no_recipes` means the seed files weren't loaded (Step 3.4), or the filters are too strict. |
| Scheduled jobs are missing from **Cron** | `pg_cron`/`pg_net` weren't enabled when the platform migration ran. Enable them, then run the second `do $$ … $$;` block of `supabase/migrations/20261027000004_platform.sql` in **SQL Editor**. |
| No notifications | The app isn't installed to the home screen, notifications are off in **Us**, the Vault secrets are missing (Step 5d), or the VAPID key in `web/.env` differs from the one in the function secrets. Check **Edge Functions → push-dispatch → Logs** and the `push_outbox` table: its `error` column says why a send failed. |
| Link import says "no recipe data" | That site doesn't publish structured recipe data. Type the recipe in; the link is kept. |
| `build-seed-library.ts` stops on an ingredient | It isn't in the catalogue. Add it to `seed.sql` ([see above](#reference-adding-ingredients-to-the-catalogue)), re-run `npm run test:sql`, then the script. |
| The project stopped responding after a quiet week | It paused. Click **Restore project** in Supabase, then check the keep-alive workflow is enabled (Step 8). |
| Blank page after a deploy | Pull to refresh, or close and reopen the app, so the new version loads. |
