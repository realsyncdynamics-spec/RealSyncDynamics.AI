#!/usr/bin/env bash
# scripts/provision-stripe-vault.sh
#
# Schreibt STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET aus der Umgebung in den
# Supabase-Vault via public.set_app_secret(). Die Werte werden NIE geloggt
# (nur Name, Länge und Key-Prefix zur Sanity-Prüfung).
#
# Hintergrund:
#   stripe-checkout / stripe-webhook / stripe-portal lesen ihre Secrets
#   "vault-first, env-fallback" (siehe getSecret() in den Edge Functions).
#   Der Vault ist damit die Source-of-Truth: überlebt einen Env-Wipe und
#   erlaubt Key-Rotation ohne Function-Redeploy. Dieses Skript spiegelt die
#   bereits gesetzten Env-Vars additiv in den Vault.
#
# Voraussetzungen (als Umgebungsvariablen):
#   SUPABASE_PROJECT_ID        z.B. ebljyceifhnlzhjfyxup
#   SUPABASE_SERVICE_ROLE_KEY  service_role JWT — NUR lokal/CI, niemals commiten
#   STRIPE_SECRET_KEY          sk_live_… (oder rk_live_… / sk_test_…)
#   STRIPE_WEBHOOK_SECRET      whsec_…
# Optional:
#   SUPABASE_URL   Default: https://$SUPABASE_PROJECT_ID.supabase.co
#   FORCE=1        überspringt die Bestätigungsabfrage (für CI)
#   DRY_RUN=1      zeigt nur, was gesetzt würde — kein Schreibzugriff
#   VERIFY=0       überspringt die Rücklese-Verifikation
#
# Usage:
#   export SUPABASE_PROJECT_ID=ebljyceifhnlzhjfyxup
#   export SUPABASE_SERVICE_ROLE_KEY=eyJ...           # aus Supabase → Settings → API
#   export STRIPE_SECRET_KEY=sk_live_...              # aus Stripe → Developers → API keys
#   export STRIPE_WEBHOOK_SECRET=whsec_...            # aus Stripe → Webhooks → Signing secret
#   scripts/provision-stripe-vault.sh
#
# Sicherheit:
#   - Secret-Werte erscheinen nie in stdout/stderr und nie in der Prozess-Argv
#     (Übergabe an curl ausschließlich via stdin-Heredoc).
#   - validiert Key-Prefixe (sk_/rk_, whsec_) gegen Tippfehler/Vertauschung.
#   - bestätigt vor dem Schreiben (außer FORCE=1).

set -uo pipefail

# ── Pre-Flight ──────────────────────────────────────────────────────────────
command -v curl >/dev/null 2>&1 || { echo "FEHLER: curl nicht im PATH." >&2; exit 3; }

: "${SUPABASE_PROJECT_ID:?SUPABASE_PROJECT_ID nicht gesetzt}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY nicht gesetzt}"
: "${STRIPE_SECRET_KEY:?STRIPE_SECRET_KEY nicht gesetzt}"
: "${STRIPE_WEBHOOK_SECRET:?STRIPE_WEBHOOK_SECRET nicht gesetzt}"

SUPABASE_URL="${SUPABASE_URL:-https://${SUPABASE_PROJECT_ID}.supabase.co}"
RPC_URL="${SUPABASE_URL%/}/rest/v1/rpc"
FORCE="${FORCE:-0}"
DRY_RUN="${DRY_RUN:-0}"
VERIFY="${VERIFY:-1}"

# ── Prefix-Validierung (fängt Tippfehler & vertauschte Keys ab) ─────────────
case "$STRIPE_SECRET_KEY" in
  sk_live_*|rk_live_*) STRIPE_MODE="live" ;;
  sk_test_*|rk_test_*) STRIPE_MODE="test" ;;
  *) echo "FEHLER: STRIPE_SECRET_KEY hat kein erwartetes Prefix (sk_/rk_ live/test)." >&2; exit 2 ;;
esac
case "$STRIPE_WEBHOOK_SECRET" in
  whsec_*) : ;;
  *) echo "FEHLER: STRIPE_WEBHOOK_SECRET beginnt nicht mit 'whsec_'. Vertauscht?" >&2; exit 2 ;;
esac

# Prefix nur zur Anzeige (max. 8 Zeichen, niemals der volle Wert).
secret_prefix() { printf '%.8s…' "$1"; }

echo "════ Stripe-Vault-Provisioning ════"
echo "· Projekt:  $SUPABASE_PROJECT_ID"
echo "· URL:      $SUPABASE_URL"
echo "· Modus:    $STRIPE_MODE (aus STRIPE_SECRET_KEY abgeleitet)"
echo "· Setzt:"
printf '    %-22s len=%-3s prefix=%s\n' "stripe_secret_key"     "${#STRIPE_SECRET_KEY}"     "$(secret_prefix "$STRIPE_SECRET_KEY")"
printf '    %-22s len=%-3s prefix=%s\n' "stripe_webhook_secret" "${#STRIPE_WEBHOOK_SECRET}" "$(secret_prefix "$STRIPE_WEBHOOK_SECRET")"

if [ "$DRY_RUN" = "1" ]; then
  echo "· DRY_RUN=1 — kein Schreibzugriff. Ende."
  exit 0
fi

if [ "$FORCE" != "1" ]; then
  read -r -p "In den Vault schreiben? [y/N] " ans
  [ "$ans" = "y" ] || [ "$ans" = "Y" ] || { echo "abgebrochen."; exit 0; }
fi

# ── set_app_secret(name, value) via PostgREST-RPC ───────────────────────────
# Wert ausschließlich via stdin-Heredoc → erscheint nie in der Prozessliste.
# Stripe-Keys sind [A-Za-z0-9_], also JSON-sicher ohne Escaping.
set_secret() {
  local name="$1" value="$2" http
  http="$(
    curl -sS -o /dev/null -w '%{http_code}' \
      -X POST "${RPC_URL}/set_app_secret" \
      -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
      -H "Content-Type: application/json" \
      --data-binary @- <<JSON
{"secret_name":"${name}","secret_value":"${value}"}
JSON
  )"
  case "$http" in
    2*) echo "  ✓ ${name} geschrieben (HTTP ${http})" ;;
    *)  echo "  ✗ ${name} FEHLGESCHLAGEN (HTTP ${http})" >&2; return 1 ;;
  esac
}

# ── Rücklese-Verifikation: Länge prüfen, Wert nie ausgeben ──────────────────
verify_secret() {
  local name="$1" expected_len="$2" body got_len
  body="$(
    curl -sS \
      -X POST "${RPC_URL}/get_app_secret" \
      -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
      -H "Content-Type: application/json" \
      --data-binary @- <<JSON
{"secret_name":"${name}"}
JSON
  )"
  # PostgREST liefert den Scalar als JSON-String ("…") zurück → Quotes strippen.
  body="${body%\"}"; body="${body#\"}"
  got_len="${#body}"
  if [ "$got_len" = "$expected_len" ]; then
    echo "  ✓ ${name} verifiziert (len=${got_len})"
  else
    echo "  ✗ ${name} Längen-Mismatch: erwartet ${expected_len}, im Vault ${got_len}" >&2
    return 1
  fi
}

echo "── schreibe ──"
rc=0
set_secret "stripe_secret_key"     "$STRIPE_SECRET_KEY"     || rc=1
set_secret "stripe_webhook_secret" "$STRIPE_WEBHOOK_SECRET" || rc=1

if [ "$rc" = "0" ] && [ "$VERIFY" = "1" ]; then
  echo "── verifiziere ──"
  verify_secret "stripe_secret_key"     "${#STRIPE_SECRET_KEY}"     || rc=1
  verify_secret "stripe_webhook_secret" "${#STRIPE_WEBHOOK_SECRET}" || rc=1
fi

echo "════ Fertig (rc=${rc}) ════"
if [ "$rc" = "0" ]; then
  echo "Nächster Schritt: Test-Checkout (siehe docs/runbooks/stripe-production-checkout.md)."
fi
exit "$rc"
