#!/usr/bin/env bash
# e2e-residency-test.sh
#
# End-to-End-Test der EU-lokalen Routing-Pipeline. Läuft NACH:
#   - Migration 20260501120000_ai_local_residency.sql angewendet
#   - ai-invoke + _shared/ai.ts + _shared/providers.ts deployed
#   - Ollama-VPS up, OLLAMA_URL + OLLAMA_AUTH_TOKEN als Edge-Function-Secrets gesetzt
#
# Was getestet wird:
#   1. Ollama-Endpoint direkt erreichbar mit Bearer (sanity)
#   2. Ohne Bearer → 401 (auth-gate funktioniert)
#   3. ai-invoke mit residency=cloud → läuft über anthropic, run.metadata.provider = 'anthropic'
#   4. profiles.ai_data_residency=eu_local + ai-invoke code_explain
#      → läuft über ollama, run.metadata.provider = 'ollama', cost_usd = 0
#   5. ai-invoke vps_status im eu_local-Modus → 503 LOCAL_UNAVAILABLE
#   6. Cleanup: User zurück auf 'cloud'
#
# Voraussetzungen:
#   - export SUPABASE_URL, SUPABASE_ANON_KEY (publishable), SUPABASE_SERVICE_ROLE
#   - export TEST_USER_JWT      (Magic-Link-Session, aus Browser-Devtools kopieren)
#   - export TEST_TENANT_ID     (UUID eines Tenants in dem der User Member ist)
#   - export TEST_USER_ID       (auth.uid() des Test-Users)
#   - export OLLAMA_URL OLLAMA_AUTH_TOKEN   (für direkten Endpoint-Test)
#
# Verwendung:
#   bash scripts/e2e-residency-test.sh

set -euo pipefail

PASS="\e[32m✓\e[0m"
FAIL="\e[31m✗\e[0m"
INFO="\e[34m·\e[0m"

step() { echo -e "$INFO $*"; }
ok()   { echo -e "$PASS $*"; }
die()  { echo -e "$FAIL $*"; exit 1; }

req() {
    : "${1:?missing}"
    eval "[ -n \"\${$1:-}\" ]" || die "ENV $1 fehlt — siehe Skript-Header"
}

req SUPABASE_URL
req SUPABASE_ANON_KEY
req SUPABASE_SERVICE_ROLE
req TEST_USER_JWT
req TEST_TENANT_ID
req TEST_USER_ID
req OLLAMA_URL
req OLLAMA_AUTH_TOKEN

INVOKE_URL="$SUPABASE_URL/functions/v1/ai-invoke"

# ─── 1. Ollama direkt: Bearer ok ──────────────────────────────────────────────
step "1. Ollama-Endpoint direkt mit Bearer…"
code=$(curl -sf -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer $OLLAMA_AUTH_TOKEN" \
    "$OLLAMA_URL/" || true)
[ "$code" = "200" ] || die "Ollama mit Bearer: HTTP $code (erwartet 200)"
ok "Ollama direkt erreichbar mit Bearer"

# ─── 2. Ollama ohne Bearer: 401 ──────────────────────────────────────────────
step "2. Ollama-Endpoint ohne Bearer…"
code=$(curl -s -o /dev/null -w '%{http_code}' "$OLLAMA_URL/" || true)
[ "$code" = "401" ] || die "Ollama ohne Bearer: HTTP $code (erwartet 401)"
ok "Auth-Gate aktiv (401 ohne Bearer)"

# ─── 3. Cloud-Pfad: User auf 'cloud' setzen, invoke code_explain ──────────────
step "3. User auf data_residency='cloud' setzen…"
curl -sf -X PATCH "$SUPABASE_URL/rest/v1/profiles?id=eq.$TEST_USER_ID" \
    -H "apikey: $SUPABASE_SERVICE_ROLE" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d '{"ai_data_residency":"cloud"}' >/dev/null

step "   invoke code_explain (cloud)…"
resp=$(curl -sf -X POST "$INVOKE_URL" \
    -H "Authorization: Bearer $TEST_USER_JWT" \
    -H "Content-Type: application/json" \
    -d "{\"tenant_id\":\"$TEST_TENANT_ID\",\"tool_key\":\"code_explain\",\"input\":\"const x = 1;\"}")
echo "$resp" | grep -q '"ok":true' || die "Cloud-Call ok=true erwartet, war: $resp"
run_id=$(echo "$resp" | sed -nE 's/.*"run_id":"([^"]+)".*/\1/p')
[ -n "$run_id" ] || die "Kein run_id in Response"
sleep 1
provider=$(curl -sf "$SUPABASE_URL/rest/v1/ai_tool_runs?id=eq.$run_id&select=metadata" \
    -H "apikey: $SUPABASE_SERVICE_ROLE" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE" \
    | sed -nE 's/.*"provider":"([^"]+)".*/\1/p')
[ "$provider" = "anthropic" ] || die "Erwartet provider=anthropic, war '$provider'"
ok "Cloud-Pfad: provider=$provider, run=$run_id"

# ─── 4. EU-lokal-Pfad: User auf 'eu_local', invoke code_explain ──────────────
step "4. User auf data_residency='eu_local' setzen…"
curl -sf -X PATCH "$SUPABASE_URL/rest/v1/profiles?id=eq.$TEST_USER_ID" \
    -H "apikey: $SUPABASE_SERVICE_ROLE" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d '{"ai_data_residency":"eu_local"}' >/dev/null

step "   invoke code_explain (eu_local) — kann 30-60 Sek dauern…"
resp=$(curl -sf --max-time 180 -X POST "$INVOKE_URL" \
    -H "Authorization: Bearer $TEST_USER_JWT" \
    -H "Content-Type: application/json" \
    -d "{\"tenant_id\":\"$TEST_TENANT_ID\",\"tool_key\":\"code_explain\",\"input\":\"const x = 1;\"}")
echo "$resp" | grep -q '"ok":true' || die "EU-lokal-Call ok=true erwartet, war: $resp"
run_id=$(echo "$resp" | sed -nE 's/.*"run_id":"([^"]+)".*/\1/p')
sleep 1
row=$(curl -sf "$SUPABASE_URL/rest/v1/ai_tool_runs?id=eq.$run_id&select=metadata,cost_usd" \
    -H "apikey: $SUPABASE_SERVICE_ROLE" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE")
provider=$(echo "$row" | sed -nE 's/.*"provider":"([^"]+)".*/\1/p')
cost=$(echo "$row" | sed -nE 's/.*"cost_usd":([0-9.]+).*/\1/p')
[ "$provider" = "ollama" ] || die "Erwartet provider=ollama, war '$provider'"
[ "$cost" = "0" ] || die "Erwartet cost_usd=0 für lokal, war '$cost'"
ok "EU-lokal-Pfad: provider=$provider, cost_usd=$cost, run=$run_id"

# ─── 5. LOCAL_UNAVAILABLE: vps_status hat kein ollama_model_id ────────────────
step "5. invoke vps_status (eu_local) → erwartet 503 LOCAL_UNAVAILABLE…"
http=$(curl -s -o /tmp/eu_unavail.json -w '%{http_code}' -X POST "$INVOKE_URL" \
    -H "Authorization: Bearer $TEST_USER_JWT" \
    -H "Content-Type: application/json" \
    -d "{\"tenant_id\":\"$TEST_TENANT_ID\",\"tool_key\":\"vps_status\",\"input\":\"{}\"}")
[ "$http" = "503" ] || die "Erwartet 503, war HTTP $http: $(cat /tmp/eu_unavail.json)"
grep -q "LOCAL_UNAVAILABLE" /tmp/eu_unavail.json || die "Erwartet code=LOCAL_UNAVAILABLE, war: $(cat /tmp/eu_unavail.json)"
ok "LOCAL_UNAVAILABLE 503 sauber für Tools ohne ollama_model_id"

# ─── 6. Cleanup ──────────────────────────────────────────────────────────────
step "6. Cleanup: User zurück auf 'cloud'…"
curl -sf -X PATCH "$SUPABASE_URL/rest/v1/profiles?id=eq.$TEST_USER_ID" \
    -H "apikey: $SUPABASE_SERVICE_ROLE" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d '{"ai_data_residency":"cloud"}' >/dev/null
ok "User-Pref auf cloud zurückgesetzt"

echo ""
echo -e "$PASS Alle 5 Tests grün — EU-lokal-Routing ist live."
