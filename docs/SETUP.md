# DINEAMITE: setup guide

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

## Step 1: Database (schema, rules, starter recipes)

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
   It lists four migrations (`…_schema`, `…_functions`, `…_rls`, `…_platform`) and asks you to confirm. Type `Y`.

   - If it fails on the `…_platform` migration with a permissions error about `pg_cron`, `pg_net` or `storage`:
     1. Enable **pg_cron** and **pg_net** in the dashboard under **Database → Extensions**.
     2. Run `npx supabase db push` again. Migrations that already applied are skipped.
   - For any other error, copy the full message and send it to me.

4. **Load the ingredient catalogue and the 14 starter recipes:**
   1. In the dashboard, open **SQL Editor → New query**.
   2. Open `supabase/seed.sql` in a text editor, copy everything, paste it into the editor and click **Run**. It should say *Success. No rows returned*.

5. **Check it worked:**
   - **Table Editor** lists `households`, `recipes`, `grocery_items` and the other tables.
   - `recipes` has 14 rows.
   - **Integrations → Cron** (or **Database → Cron Jobs**) shows three jobs: `dineamite-prompts`, `dineamite-purge-invites` and `dineamite-push-dispatch`.

---

## Step 2: Sign-in by email code

The app signs you in with a 6-digit code sent by email. There's no password, and the code works inside the installed iPhone app.

### 2a. Put the code in the emails

Supabase sends one of two emails, so edit both:
- **Confirm signup**: someone's first sign-in.
- **Magic Link**: every sign-in after that.

1. Open **Authentication → Emails → Templates**.
2. Open **Confirm signup** and replace the whole body with:
   ```html
   <h2>DINEAMITE</h2>
   <p>Your code / Votre code : <strong style="font-size:24px">{{ .Token }}</strong></p>
   <p>It expires in one hour. / Il expire dans une heure.</p>
   ```
   Change the subject to something like `Your DINEAMITE code`, then click **Save**.
3. Do the same for **Magic Link**.

### 2b. Check the code settings

1. Open **Authentication → Sign In / Providers → Email**.
2. Make sure **Enable Email provider** is on.
3. Make sure **Email OTP Length** is **6**. The app expects 6 digits.

### 2c. Make sure the emails actually arrive (important)

Supabase's built-in mailer only delivers to the email addresses of your Supabase organisation's team members, and only sends a couple per hour. Your partner's email would never arrive. Fix it with free custom SMTP. Gmail is the easiest because you don't need a domain:

1. **Create a Gmail app password:**
   1. Go to https://myaccount.google.com/security and make sure **2-Step Verification** is on.
   2. Go to https://myaccount.google.com/apppasswords, create an app password named `DINEAMITE`, and copy the 16-character password.
2. **Enter it in Supabase:** open **Authentication → Emails → SMTP Settings**, turn on **Enable custom SMTP**, and fill in:
   - Sender email: `vittorioderisi@gmail.com`
   - Sender name: `DINEAMITE`
   - Host: `smtp.gmail.com`
   - Port: `465`
   - Username: `vittorioderisi@gmail.com`
   - Password: the 16-character app password

   Then click **Save**.
3. **Raise the sending limit:** open **Authentication → Rate Limits** and raise the email limit from its low default, for example to 30 per hour.

Gmail allows about 500 emails a day, far more than two people need. Sessions also stay signed in, so you'll rarely get a code after the first time.

### 2d. Site URL

You'll set this in Step 4, once you have the app's address.

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
6. **Go back to Supabase** and open **Authentication → URL Configuration**:
   - Set **Site URL** to your Pages address, for example `https://dineamite.pages.dev`.
   - Under **Redirect URLs**, add `https://dineamite.pages.dev/**`.
   - Click **Save**.

---

## Step 5: Install it on your iPhones and try it

Both of you do this.

1. **Install the app:**
   1. On the iPhone, open the Pages address in **Safari**. It has to be Safari.
   2. Tap **Share** (the square with the arrow), then **Add to Home Screen**, then **Add**.
   3. Open DINEAMITE **from the Home Screen icon**. Do everything from here on inside that app, not in Safari: the installed app keeps its own sign-in, separate from Safari's.
2. **You (first):**
   1. Tap **Get started**, enter your email, then enter the 6-digit code.
   2. Enter your first name and choose a colour and language.
   3. Create the household, for example "Chez nous".
   4. On the invite screen, tap **Share invite** and send it to your partner. Or read the 6-character code to them; it's valid for 48 hours.
3. **Your partner:**
   1. Install the app from the Home Screen first, as in item 1.
   2. Open it and tap **I have an invite code**, then sign in with their email and code.
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
| No code email arrives | Step 2c isn't done, or the email is in spam. Check **Authentication → Logs**. |
| "That code didn't work" | The OTP length isn't 6, or you used an older code. Tap **Send a new code**. |
| "Deal the deck" fails | Open **Edge Functions → deal-deck → Logs**. A missing key error means Step 3c is incomplete. "no_recipes" means the seed wasn't loaded (Step 1.4), or your filters are too strict. |
| No notifications | The app isn't installed from the Home Screen, notifications are off in **Us**, or the VAPID key in `web/.env` differs from the one in the secrets. Look at **Edge Functions → push-dispatch → Logs** and the `push_outbox` table: its `error` column shows why a send failed. |
| Link import says "no recipe data" | That site doesn't publish structured recipe data. Type the recipe in; the link is kept. |
| Blank page after a deploy | Pull to refresh, or close and reopen the app, so the new version loads. |
