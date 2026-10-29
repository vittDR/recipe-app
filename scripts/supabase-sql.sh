#!/usr/bin/env bash
# Runs SQL on the Supabase project in web/.env through the management API and
# prints the result as JSON. Needs SUPABASE_ACCESS_TOKEN (a personal access
# token). Usage: scripts/supabase-sql.sh "select 1"  or  scripts/supabase-sql.sh < file.sql
set -euo pipefail
cd "$(dirname "$0")/.."
: "${SUPABASE_ACCESS_TOKEN:?Set SUPABASE_ACCESS_TOKEN}"
REF=$(grep '^VITE_SUPABASE_URL' web/.env | sed -E 's#.*https://([^.]+)\..*#\1#')
SQL=${1:-$(cat)}
curl -sS --fail-with-body -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  --data "$(jq -n --arg q "$SQL" '{query: $q}')"
echo
