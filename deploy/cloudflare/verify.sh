#!/usr/bin/env bash
# Verifiziert, dass die Security-Header live anliegen — nachdem Cloudflare
# vor dem VPS-Origin aktiv ist. Spiegelt exakt die Checks der gdpr-audit-Engine
# (no_hsts / no_xframe), sodass „grün hier" = „Befund 5+6 weg im Audit".
set -euo pipefail

HOST="${1:-https://realsyncdynamicsai.de}"
echo "Prüfe Security-Header für: $HOST"
echo "────────────────────────────────────────────"

headers="$(curl -sSI -m 15 "$HOST")"

check() {
  local name="$1"
  if grep -iq "^${name}:" <<<"$headers"; then
    printf '  ✅ %-28s %s\n' "$name" "$(grep -i "^${name}:" <<<"$headers" | head -1 | cut -d: -f2- | xargs)"
  else
    printf '  ❌ %-28s FEHLT\n' "$name"
    FAIL=1
  fi
}

FAIL=0
check "Strict-Transport-Security"   # → schließt Audit-Befund no_hsts
check "X-Frame-Options"             # → schließt Audit-Befund no_xframe
check "X-Content-Type-Options"
check "Referrer-Policy"
check "Permissions-Policy"

echo "────────────────────────────────────────────"
if [[ "${FAIL:-0}" -eq 0 ]]; then
  echo "Alle Header gesetzt — Cloudflare-Proxy wirkt. Re-Scan auf /audit zeigt nun keine no_hsts/no_xframe-Befunde mehr."
else
  echo "Mindestens ein Header fehlt. Prüfe: (1) DNS proxied (orange cloud)? (2) terraform apply gelaufen? (3) HSTS-Setting aktiv?"
  exit 1
fi
