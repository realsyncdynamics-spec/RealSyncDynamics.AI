#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Smoke-Test für die Security-Signal-Ingest-Edge-Function.
#
#   POST /functions/v1/security-signal-ingest
#   Header: x-rsd-api-key: <key>
#
# Voraussetzung: In security_signal_sources existiert eine Quelle mit
#   api_key_hash = sha256(<RSD_SIGNAL_KEY>) und status='active'.
#
# Beispiel (lokal):
#   SUPABASE_URL=http://127.0.0.1:54321 \
#   RSD_SIGNAL_KEY=dev-secret-key \
#   bash scripts/test-security-signal-ingest.sh
#
# Beispiel (remote):
#   SUPABASE_URL=https://<ref>.supabase.co \
#   RSD_SIGNAL_KEY=prod-key \
#   bash scripts/test-security-signal-ingest.sh
# ---------------------------------------------------------------------------
set -euo pipefail

SUPABASE_URL="${SUPABASE_URL:-http://127.0.0.1:54321}"
RSD_SIGNAL_KEY="${RSD_SIGNAL_KEY:-dev-secret-key}"
ENDPOINT="${SUPABASE_URL%/}/functions/v1/security-signal-ingest"
PAYLOAD_FILE="$(dirname "$0")/demo-security-signal.json"

echo "POST $ENDPOINT"
echo "Payload: $PAYLOAD_FILE"
echo "---"

# sha256 des Keys (zum Anlegen der Source-Zeile) bequem ausgeben:
if command -v sha256sum >/dev/null 2>&1; then
  echo "api_key_hash (zum Eintragen in security_signal_sources):"
  printf '%s' "$RSD_SIGNAL_KEY" | sha256sum | awk '{print "  " $1}'
  echo "---"
fi

curl -sS -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "x-rsd-api-key: $RSD_SIGNAL_KEY" \
  --data-binary "@$PAYLOAD_FILE" \
  -w '\n--- HTTP %{http_code} ---\n'

# Optional: Cloudflare-Beispiel über Query-Param-Provider-Override
# curl -sS -X POST "$ENDPOINT?provider=cloudflare" \
#   -H "Content-Type: application/json" \
#   -H "x-rsd-api-key: $RSD_SIGNAL_KEY" \
#   --data '{"ray_id":"7d3f...","action":"block","clientRequestHTTPHost":"app.example.com","ruleMessage":"SQLi attempt","datetime":"2026-06-26T09:00:00Z"}' \
#   -w '\n--- HTTP %{http_code} ---\n'
