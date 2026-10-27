#!/usr/bin/env bash
# Applies the migrations and seed to a throwaway local database, then runs the
# SQL tests. Usage: supabase/tests/run_local.sh  (needs a local Postgres + psql)
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${DB:-dineamite_test}
PSQL=${PSQL:-psql}
$PSQL -q -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists $DB" -c "create database $DB"
run() { $PSQL -q -o /dev/null -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/stub_supabase.sql
for f in migrations/*.sql; do run "$f"; done
run seed.sql
for f in tests/*_test.sql; do echo "== $f"; run "$f"; done
echo "All SQL tests passed."
