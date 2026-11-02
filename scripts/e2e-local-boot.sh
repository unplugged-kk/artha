#!/bin/bash
# Usage: pg_ctlcluster 16 main start; (cd backend && npm run build); scripts/e2e-local-boot.sh
# Needs a superuser role artha_user/artha_password (see docs/agent/HANDOFF.md).
# Boots the real compiled backend against a fresh local database and exercises
# /anomalies over HTTP. Exits non-zero on the first failed expectation.
set -u
cd "$(dirname "$0")/../backend" || exit 1
export PGPASSWORD=artha_password
H="-h localhost -U artha_user"
DB=artha_run
psql $H -d postgres -qc "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB" || exit 1

export DATABASE_HOST=localhost DATABASE_PORT=5432 DATABASE_USER=artha_user \
  DATABASE_PASSWORD=artha_password DATABASE_NAME=$DB \
  JWT_SECRET=0123456789abcdef0123456789abcdef0123 \
  ENCRYPTION_KEY=fedcba9876543210fedcba9876543210ffff \
  LOCAL_AUTH_ENABLED=true REGISTRATION_ENABLED=true NODE_ENV=development \
  PORT=3101 RLS_MODE=off PUBLIC_APP_URL=http://localhost:3000 \
  CORS_ORIGIN=http://localhost:3000

fail=0
expect() { # name, actual, wanted
  if [ "$2" = "$3" ]; then echo "PASS $1"; else echo "FAIL $1: got [$2] wanted [$3]"; fail=1; fi
}

node dist/db-init.js > /tmp/e2e-init.log 2>&1 || { echo "db-init failed"; tail -5 /tmp/e2e-init.log; exit 1; }
node dist/db-migrate.js > /tmp/e2e-migrate.log 2>&1 || { echo "db-migrate failed"; tail -5 /tmp/e2e-migrate.log; exit 1; }
echo "PASS db-init + db-migrate"
node dist/main.js > /tmp/e2e-main.log 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null' EXIT
for i in $(seq 1 60); do
  curl -sf localhost:3101/api/v1/health >/dev/null 2>&1 && break
  sleep 1
done
expect "server boots and health answers" "$(curl -s -o /dev/null -w '%{http_code}' localhost:3101/api/v1/health)" "200"

expect "anomalies refuses an anonymous caller" "$(curl -s -o /dev/null -w '%{http_code}' localhost:3101/api/v1/anomalies)" "401"

JAR=/tmp/e2e-jar.txt; rm -f $JAR
code=$(curl -s -o /tmp/e2e-reg.json -w '%{http_code}' -c $JAR -H 'content-type: application/json' \
  -d '{"email":"e2e@example.com","password":"Str0ng!Passw0rd#1","firstName":"E2E"}' localhost:3101/api/v1/auth/register)
expect "register" "$code" "201"
UID_=$(psql $H -d $DB -tAc "select id from users where email='e2e@example.com'")
[ -n "$UID_" ] || { echo "FAIL no user row"; exit 1; }

expect "anomalies empty for a new user" \
  "$(curl -s -b $JAR 'localhost:3101/api/v1/anomalies?asOf=2026-06-20' | python3 -c 'import sys,json;d=json.load(sys.stdin);print(len(d["spendingSpikes"]),len(d["subscriptionIncreases"]))')" "0 0"
expect "anomalies rejects a malformed asOf" "$(curl -s -o /dev/null -w '%{http_code}' -b $JAR 'localhost:3101/api/v1/anomalies?asOf=junk')" "400"

# Seed a real baseline + spike with SQL, then read it back over HTTP.
psql $H -d $DB -q -v ON_ERROR_STOP=1 <<SQL || { echo "FAIL seed"; exit 1; }
INSERT INTO currencies (code,name,symbol,decimal_places) VALUES ('USD','US Dollar','\$',2) ON CONFLICT DO NOTHING;
WITH a AS (
  INSERT INTO accounts (user_id,name,account_type,currency_code,opening_balance,current_balance)
  VALUES ('$UID_','E2E','CHEQUING','USD',0,0) RETURNING id),
c AS (
  INSERT INTO categories (user_id,name,is_income) VALUES ('$UID_','Dining',false) RETURNING id)
INSERT INTO transactions (user_id,account_id,transaction_date,amount,currency_code,category_id)
SELECT '$UID_', a.id, d::date, amt, 'USD', c.id FROM a, c,
 (VALUES ('2026-03-10',-100),('2026-04-10',-120),('2026-05-10',-110),('2026-06-05',-400)) AS t(d,amt);
SQL
expect "spike over HTTP" \
  "$(curl -s -b $JAR 'localhost:3101/api/v1/anomalies?asOf=2026-06-20' | python3 -c 'import sys,json;d=json.load(sys.stdin);s=d["spendingSpikes"];print(len(s),s[0]["categoryName"] if s else "-",s[0]["current"] if s else "-")')" "1 Dining 400"


# ---- MCP over HTTP with a personal access token ----
CSRF=$(awk '$6=="csrf_token"{print $7}' $JAR | python3 -c 'import sys,urllib.parse;print(urllib.parse.unquote(sys.stdin.read().strip()))')
PAT=$(curl -s -b $JAR -H "x-csrf-token: $CSRF" -H 'content-type: application/json' \
  -d '{"name":"e2e","scopes":"read"}' localhost:3101/api/v1/auth/tokens | python3 -c 'import sys,json;print(json.load(sys.stdin).get("token",""))')
expect "personal access token created" "${PAT:0:4}" "pat_"

MCP="localhost:3101/api/v1/mcp"
rpc() { # session, json
  local sid_hdr=()
  [ -n "$1" ] && sid_hdr=(-H "Mcp-Session-Id: $1")
  curl -s -D /tmp/e2e-hdr.txt -H "Authorization: Bearer $PAT" -H 'content-type: application/json' \
    -H 'accept: application/json, text/event-stream' "${sid_hdr[@]}" -d "$2" $MCP | python3 -c '
import sys
raw=sys.stdin.read()
for line in raw.splitlines():
    if line.startswith("data:"): raw=line[5:].strip(); break
print(raw)'
}
rpc "" '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"e2e","version":"1"}}}' > /tmp/e2e-init.json
SID=$(grep -ai '^mcp-session-id' /tmp/e2e-hdr.txt | awk '{print $2}' | tr -d '\r')
[ -n "$SID" ] && echo "PASS mcp initialize (session)" || { echo "FAIL mcp initialize: $(head -c 300 /tmp/e2e-init.json)"; fail=1; }
rpc "$SID" '{"jsonrpc":"2.0","method":"notifications/initialized"}' >/dev/null
NAMES=$(rpc "$SID" '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | python3 -c 'import sys,json;print(" ".join(sorted(t["name"] for t in json.load(sys.stdin)["result"]["tools"] if t["name"] in ("india_tax","plan_simulate"))))')
expect "tools/list advertises the new tools" "$NAMES" "india_tax plan_simulate"

TAX=$(rpc "$SID" '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"india_tax","arguments":{"operation":"compare_regimes","grossIncome":"1500000"}}}' | python3 -c 'import sys,json;r=json.load(sys.stdin)["result"];d=r["structuredContent"];print(r.get("isError",False),d["new"]["totalTax"],d["old"]["totalTax"],d["better"])')
expect "india_tax via MCP (string income accepted)" "$TAX" "False 97500 257400 new"

SIM=$(rpc "$SID" '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"plan_simulate","arguments":{"operation":"fire","currentCorpus":0,"monthlySavings":50000,"realAnnualReturnPct":0,"annualExpenses":600000,"extraMonthlySavings":50000}}}' | python3 -c 'import sys,json;d=json.load(sys.stdin)["result"]["structuredContent"];print(d["base"]["months"],d["withExtra"]["months"],d["monthsSaved"])')
expect "plan_simulate via MCP" "$SIM" "300 150 150"

BAD=$(rpc "$SID" '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"india_tax","arguments":{"operation":"compare_regimes"}}}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["result"].get("isError",False))')
expect "india_tax without income is an error, not zero" "$BAD" "True"

grep -aci "error" /tmp/e2e-main.log | xargs -I{} echo "server log error lines: {}"
[ $fail = 0 ] && echo "E2E OK" || echo "E2E FAILED"
exit $fail
