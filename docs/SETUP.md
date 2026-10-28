# Dineamite: setup guide

Do the steps in order. Plan for about an hour. You need a Mac or PC with:

- **Node.js 22**: check with `node -v`. If you don't have it, install the LTS from nodejs.org.
- **git**: check with `git --version`.
- Your **Supabase database password**. You chose it when you created the project. If you've lost it, use **Project Settings → Database → Reset database password**.

Supabase and Cloudflare rename menus from time to time. If a label below doesn't match exactly, look for the closest one.

---

## Step 0: Get the code onto `main`

Everything is on the branch `claude/youthful-carson-b1lp64`. Two things only work from your default branch (`main`): Cloudflare's production deploys and GitHub's scheduled keep-alive job. So merge it first:

1. Open https://github.com/vittdr/recipe-app. GitHub shows a banner offering to compare the branch and open a pull request.
2. Open the pull request and merge it.

Then get the code on your computer:

```bash
git clone https://github.com/vittdr/recipe-app.git
cd recipe-app
git checkout main && git pull
```

---

## Step 1: Database (schema, rules, recipes)

All commands run from the `recipe-app` folder. `npx supabase` downloads the Supabase CLI on first use.

1. **Log the CLI in to your Supabase account:**
   ```bash
   npx supabase login
   ```
   A browser tab opens. Approve it, then go back to the terminal.

2. **Link this folder to your project:**
   ```bash
   npx supabase link --project-ref grvkstzctekisscvfroy
   ```
   Enter the database password when asked.

3. **Create all the tables and rules:**
   ```bash
   npx supabase db push
   ```
   It lists five migrations (`…_schema`, `…_functions`, `…_rls`, `…_platform`, `…_seed_library`) and asks you to confirm. Type `Y`.

   - If it fails on the `…_platform` migration with a permissions error about `pg_cron`, `pg_net` or `storage`:
     1. Enable **pg_cron** and **pg_net** in the dashboard under **Database → Extensions**.
     2. Run `npx supabase db push` again. Migrations that already applied are skipped.
   - For any other error, copy the full message and send it to me.

4. **Load the ingredient catalogue and the recipes:**
   1. In the dashboard, open **SQL Editor → New query**.
   2. Open `supabase/seed.sql` in a text editor, copy everything, paste it into the editor and click **Run**. It should say *Success. No rows returned*. This is the ingredient catalogue.
   3. Open a new query and do the same with `supabase/seed_library.sql`: the 110 recipes. It's a big file (about 400 KB), so give the editor a few seconds after pasting.

   Both files are safe to run again: they skip whatever is already loaded. If your project was set up before the seed library existed, run `npx supabase db push` first, then both files.

5. **Check it worked:**
   - **Table Editor** lists `households`, `recipes`, `grocery_items` and the other tables.
   - `recipes` has 110 rows.
   - **Integrations → Cron** (or **Database → Cron Jobs**) shows three jobs: `dineamite-prompts`, `dineamite-purge-invites` and `dineamite-push-dispatch`.

---

## Step 2: Sign-in with email + password

Dineamite signs you in with your email and a password. Supabase never sends any email, so you don't need a mail service or SMTP.

1. In the dashboard, open **Authentication → Sign In / Providers**.
2. Under **User Signups**, keep **Allow new users to sign up** **on** for now.
3. Click **Email** in the provider list and set:
   - **Enable Email provider**: on
   - **Confirm email**: **off**. This is the important one: with it on, Supabase would try to send a confirmation email.
   - **Minimum password length**: `8`, if the field is there.
4. Click **Save**.

**Test it on your Mac.** From the `recipe-app` folder:

```bash
cd web
npm install
npm run dev
```

1. Open http://localhost:5173.
2. Click **Get started**, then enter your email and a password of 8 or more characters.
3. You should land straight on the "About you" screen. Your account now exists, and **Authentication → Users** lists it.
4. Press `Ctrl+C` in the terminal to stop.

**Once you've both created accounts** (Step 5), go back to **Authentication → Sign In / Providers** and turn **Allow new users to sign up** **off**. Nobody else can then create an account. Strangers couldn't see your data anyway, but this keeps the app to just the two of you.

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

## Step 3: Server functions and notifications

### 3a. Generate notification keys and a cron secret

In the `recipe-app` folder:

```bash
npx web-push generate-vapid-keys
```

It prints a **Public Key** and a **Private Key**. Keep both somewhere safe for the next few minutes.

Then generate a random secret for the cron job:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Keep that value too. This guide calls it `CRON_SECRET`.

### 3b. Get your API keys

Open **Project Settings → API Keys**:
- **Publishable key**: `sb_publishable_BkHr…` (you already have it).
- **Secret key**: starts with `sb_secret_`. Click to reveal it and copy it. **Never put this key in the app, in git, or in a chat.**

### 3c. Store the secrets for the functions

Use one command with your real values, all on one line or with the `\` line breaks:

```bash
npx supabase secrets set \
  VAPID_PUBLIC_KEY=<public key from 3a> \
  VAPID_PRIVATE_KEY=<private key from 3a> \
  VAPID_SUBJECT=mailto:vittorioderisi@gmail.com \
  CRON_SECRET=<value from 3a> \
  PUBLISHABLE_KEY=sb_publishable_BkHrEudRfB1j5MlMogL8Dw_h1LPe3xL \
  SECRET_KEY=<sb_secret_… from 3b>
```

Check with `npx supabase secrets list`. It shows the names, not the values.

### 3d. Deploy the three functions

```bash
npx supabase functions deploy deal-deck
npx supabase functions deploy import-recipe
npx supabase functions deploy push-dispatch
```

If the CLI complains that Docker isn't running, add `--use-api` to each command, for example `npx supabase functions deploy deal-deck --use-api`.

All three now appear under **Edge Functions** in the dashboard.

### 3e. Tell the cron job where to send notifications

1. In **SQL Editor → New query**, paste this, replacing `<CRON_SECRET>` with the same value as in 3c:
   ```sql
   select vault.create_secret('https://grvkstzctekisscvfroy.supabase.co/functions/v1/push-dispatch', 'push_dispatch_url');
   select vault.create_secret('<CRON_SECRET>', 'cron_secret');
   ```
2. Click **Run**.

If you ever need to change one of these values, delete it first under **Project Settings → Vault** and create it again.

### 3f. Put the public notification key in the app

1. Open `web/.env` and fill in the last line with the **public** key from 3a:
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

## Step 4: Put the app online (Cloudflare Pages, free)

1. **Create an account:** sign up at https://dash.cloudflare.com if you don't have one. The free plan is enough.
2. **Start the import:** go to **Workers & Pages → Create**, choose the **Pages** tab, then **Import an existing Git repository**.
3. **Pick the repository:** connect your GitHub account. When GitHub asks, allow access to `vittdr/recipe-app` only. Then select the repository.
4. **Fill in the build settings:**
   - Project name: `dineamite`. This gives you the address `https://dineamite.pages.dev`, or a variant if the name is taken.
   - Production branch: `main`
   - Framework preset: **None**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory (under *Advanced*): `web`
   - Environment variable: `NODE_VERSION` = `22`

   The Supabase URL, publishable key and VAPID public key come from `web/.env` in the repo, so you don't need to add them here.
5. **Deploy:** click **Save and Deploy**. The first build takes 1–2 minutes. Every later push to `main` redeploys automatically.
6. Optional: go back to Supabase, open **Authentication → URL Configuration**, set **Site URL** to your Pages address (for example `https://dineamite.pages.dev`), and click **Save**. Password sign-in doesn't depend on it.

---

## Step 5: Install it on your iPhones and try it

Both of you do this.

1. **Install the app:**
   1. On the iPhone, open the Pages address in **Safari**. It has to be Safari.
   2. Tap **Share** (the square with the arrow), then **Add to Home Screen**, then **Add**.
   3. Open Dineamite **from the Home Screen icon**. Do everything from here on inside that app, not in Safari: the installed app keeps its own sign-in, separate from Safari's.
2. **You (first):**
   1. Tap **Get started** if you haven't created your account yet, or **I already have an account** if you did in Step 2. Then enter your email and password.
   2. Enter your first name and choose a colour and language.
   3. Create the household, for example "Chez nous".
   4. On the invite screen, tap **Share invite** and send it to your partner. Or read the 6-character code to them; it's valid for 48 hours.
3. **Your partner:**
   1. Install the app from the Home Screen first, as in item 1.
   2. Open it and tap **I have an invite code**, then create their account with their email and a password.
   3. After the name step, the join screen appears. Enter the code and tap **Join**.

   The invite link works too, but it opens in Safari, so entering the code inside the installed app is simpler.
4. **Each of you:** set your goals and tastes.
5. **Notifications:** open the **Us** tab, tap **Turn on notifications**, and allow them.
6. **Test the Tonight flow:**
   1. One of you deals a deck from **Tonight**.
   2. The other gets a notification within about a minute and joins.
   3. Both of you swipe and get a match, or a tie-break.
   4. Tap **Add to list** and check that the item appears on the other phone's **Groceries** tab.

---

## Step 6: Keep the free project awake

Free Supabase projects pause after 7 days without traffic. After Step 0, the workflow `.github/workflows/keep-alive.yml` runs every day on GitHub for free and pings the project. To check it:

1. In GitHub, open **Actions → Keep Supabase awake → Run workflow**.
2. Wait for a green tick.

If the project ever does pause, go to **Restore project** on the Supabase dashboard. Your data is kept.

---

## If something goes wrong

| Symptom | Likely cause / fix |
| --- | --- |
| "Account created, but email confirmation is still on" | Turn off **Confirm email** (Step 2). Then delete the half-created user in **Authentication → Users** and sign up again. |
| "Wrong email or password" | Check for a typo. Forgotten password: see the end of Step 2. |
| "Deal the deck" fails | Open **Edge Functions → deal-deck → Logs**. A missing key error means Step 3c is incomplete. "no_recipes" means the seed wasn't loaded (Step 1.4), or your filters are too strict. |
| No notifications | The app isn't installed from the Home Screen, notifications are off in **Us**, or the VAPID key in `web/.env` differs from the one in the secrets. Look at **Edge Functions → push-dispatch → Logs** and the `push_outbox` table: its `error` column shows why a send failed. |
| Link import says "no recipe data" | That site doesn't publish structured recipe data. Type the recipe in; the link is kept. |
| Blank page after a deploy | Pull to refresh, or close and reopen the app, so the new version loads. |
