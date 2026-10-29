#!/usr/bin/env bash
# Runs SQL on the Supabase project in web/.env through the management API and
# prints the result as JSON. Needs SUPABASE_ACCESS_TOKEN (a personal access
# token). Usage: scripts/supabase-sql.sh "select 1"  or  scripts/supabase-sql.sh < file.sql
set -euo pipefail
cd "$(dirname "$0")/.."
: "${SUPABASE_ACCESS_TOKEN:?Set SUPABASE_ACCESS_TOKEN}"
REF=$(grep '^VITE_SUPABASE_URL' web/.env | sed -E 's#.*https://([^.]+)\..*#\1#')
# The body goes through a temp file: large files (seed_library.sql) are too long for an argument.
BODY=$(mktemp)
trap 'rm -f "$BODY"' EXIT
if [ $# -gt 0 ]; then jq -n --arg q "$1" '{query: $q}' > "$BODY"; else jq -n --rawfile q /dev/stdin '{query: $q}' > "$BODY"; fi
curl -sS --fail-with-body -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  --data @"$BODY"
echo
