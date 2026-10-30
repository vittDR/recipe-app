#!/usr/bin/env bash
# Sets up a dev account on the project in web/.env so `npm run dev` opens the
# app already signed in (see devSignIn in web/src/lib/session.tsx). The account
# has its own household, profile and goals, so it skips onboarding and sees
# nothing of anyone else's data. Safe to run again: it reuses the saved
# credentials and only fills in what's missing.
#
# Credentials go to web/.env.development.local (git-ignored, read by `vite`
# in dev only, never by `vite build`). Needs curl and jq.
# Usage: scripts/dev-account.sh [email]
set -euo pipefail
cd "$(dirname "$0")/.."
ENV_LOCAL=web/.env.development.local

URL=$(grep '^VITE_SUPABASE_URL=' web/.env | cut -d= -f2-)
KEY=$(grep '^VITE_SUPABASE_PUBLISHABLE_KEY=' web/.env | cut -d= -f2-)

EMAIL=$(grep -s '^VITE_DEV_EMAIL=' "$ENV_LOCAL" | cut -d= -f2- || true)
PASSWORD=$(grep -s '^VITE_DEV_PASSWORD=' "$ENV_LOCAL" | cut -d= -f2- || true)
if [ -z "$EMAIL" ] || [ -z "$PASSWORD" ]; then
  EMAIL=${1:-dev+$(head -c4 /dev/urandom | od -An -tx1 | tr -d ' \n')@dineamite.test}
  PASSWORD=$(head -c18 /dev/urandom | base64 | tr -d '/+=')
  printf '# Dev account from scripts/dev-account.sh: `npm run dev` signs in with it.\nVITE_DEV_EMAIL=%s\nVITE_DEV_PASSWORD=%s\n' \
    "$EMAIL" "$PASSWORD" > "$ENV_LOCAL"
fi

auth() { # auth <path> <json>: the response, or nothing on an error
  curl -sS -X POST "$URL/auth/v1/$1" -H "apikey: $KEY" -H 'Content-Type: application/json' -d "$2"
}
CREDS=$(jq -n --arg e "$EMAIL" --arg p "$PASSWORD" '{email: $e, password: $p, data: {locale: "en"}}')
TOKEN=$(auth 'token?grant_type=password' "$CREDS" | jq -r '.access_token // empty')
if [ -z "$TOKEN" ]; then
  TOKEN=$(auth signup "$CREDS" | jq -r '.access_token // empty')
  [ -n "$TOKEN" ] || { echo "Couldn't sign up $EMAIL (is \"Confirm email\" off? docs/SETUP.md, step 2)" >&2; exit 1; }
fi
USER_ID=$(curl -sS "$URL/auth/v1/user" -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN" | jq -r .id)

rest() { # rest <method> <path> [json] [extra header]
  curl -sS --fail-with-body -X "$1" "$URL/rest/v1/$2" -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' ${4:+-H "$4"} ${3:+-d "$3"}
}

rest PATCH "profiles?id=eq.$USER_ID&first_name=eq." '{"first_name":"Dev"}' >/dev/null
if [ "$(rest GET "household_members?user_id=eq.$USER_ID&select=household_id" | jq length)" = 0 ]; then
  rest POST rpc/create_household '{"p_name":"Dev kitchen","p_timezone":"Europe/Paris"}' >/dev/null
fi
rest POST member_goals "{\"user_id\":\"$USER_ID\"}" 'Prefer: resolution=ignore-duplicates' >/dev/null

echo "Dev account ready: $EMAIL (saved in $ENV_LOCAL). Run: cd web && npm run dev"
