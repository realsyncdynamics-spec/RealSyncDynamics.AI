#!/usr/bin/env bash
# Verify, dass alle Pflicht-Security-Header an einem URL gesetzt sind.
#
# Usage:
#   ./scripts/check-security-headers.sh https://realsyncdynamicsai.de
#
# Exit-Code 0 wenn alle Pflicht-Header da sind, 1 sonst. Wert wird nicht
# gegen einen Sollwert geprüft (das ist Job der Cloudflare-Konsole bzw.
# eines weiteren Vergleichs-Skripts) — nur Anwesenheit.

set -u

URL="${1:-https://realsyncdynamicsai.de}"

REQUIRED_HEADERS=(
  "strict-transport-security"
  "x-frame-options"
  "x-content-type-options"
  "referrer-policy"
  "permissions-policy"
  "content-security-policy"
)

echo "→ Probe $URL"
RESPONSE_HEADERS=$(curl -sI -L "$URL" 2>/dev/null | tr '[:upper:]' '[:lower:]')

if [ -z "$RESPONSE_HEADERS" ]; then
  echo "[FAIL] keine Response erhalten von $URL"
  exit 1
fi

FAILED=0
for header in "${REQUIRED_HEADERS[@]}"; do
  VALUE=$(printf '%s\n' "$RESPONSE_HEADERS" | awk -v h="$header" 'BEGIN{IGNORECASE=1} $1 ~ "^"h":$" {sub(/^[^:]+:[ ]*/,""); print}')
  if [ -z "$VALUE" ]; then
    echo "[FAIL] $header — fehlt"
    FAILED=1
  else
    # Wert auf 80 Zeichen kürzen für Lesbarkeit
    TRIMMED=$(printf '%s' "$VALUE" | cut -c1-80)
    echo "[OK]   $header: $TRIMMED"
  fi
done

# Cookies sollten Secure + HttpOnly + SameSite haben — informativer Check
COOKIE_LINES=$(printf '%s\n' "$RESPONSE_HEADERS" | awk '/^set-cookie:/')
if [ -n "$COOKIE_LINES" ]; then
  echo "$COOKIE_LINES" | while IFS= read -r cookie; do
    [[ "$cookie" == *"secure"* ]] || echo "[WARN] cookie ohne Secure-Flag: $(echo "$cookie" | cut -c1-80)"
  done
fi

if [ "$FAILED" -ne 0 ]; then
  echo ""
  echo "→ Setup-Anleitung: docs/runbooks/cloudflare-security-headers.md"
  exit 1
fi

echo ""
echo "→ Alle Pflicht-Header vorhanden."
exit 0
