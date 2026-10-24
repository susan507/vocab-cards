#!/bin/sh
# Applies the Supabase migrations to a throwaway local Postgres with a minimal auth stub, then runs scripts/db-test.sql.
set -eu
dir=$(mktemp -d)
trap 'pg_ctl -D "$dir/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$dir"' EXIT
initdb -D "$dir/data" -U postgres -A trust >/dev/null
pg_ctl -D "$dir/data" -o "-k $dir -c listen_addresses=''" -l "$dir/log" -w start >/dev/null
run() { psql -h "$dir" -U postgres -X -q -v ON_ERROR_STOP=1 "$@"; }
run -c "
create role anon nologin; create role authenticated nologin;
grant usage on schema public to anon, authenticated;
create schema auth;
grant usage on schema auth to anon, authenticated;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as \$\$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid \$\$;
"
for f in supabase/migrations/*.sql; do run -1 -f "$f"; done
run -f scripts/db-test.sql
echo "db tests passed"
