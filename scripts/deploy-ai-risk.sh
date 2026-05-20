#!/usr/bin/env bash
#
# deploy-ai-risk.sh — Bootstrap-Script für den ai-risk-agent Baseline-Run
#
# Was es tut:
#   1. Fragt nach dem ANTHROPIC_API_KEY (read -s, kein Echo, nicht auf Disk)
#   2. Erzeugt einen AI_RISK_AGENT_TOKEN (32 hex bytes)
#   3. Setzt beide als Supabase-Function-Secrets
#   4. Pusht die Migrations
#   5. Deployt die Edge Function ai-risk
#   6. Führt den Two-Step-Smoke-Test aus (Healthcheck + High-Risk-Sample)
#   7. Druckt die vier GitHub-Repo-Secret-Werte für Copy-Paste
#
# Was es NICHT tut:
#   - GitHub-Repo-Secrets setzen (geht nur über die GitHub-UI/REST mit
#     einem PAT; absichtlich nicht im Script, weil das einen weiteren
#     Credential-Pfad öffnen würde)
#   - Den Workflow triggern — der Klick auf "Run workflow" in der UI
#     ist sicherer als ein gh-CLI-Call, weil Du den Run-Status direkt siehst
#
# Voraussetzungen:
#   - supabase-CLI installiert (`supabase --version` läuft)
#   - In diesem Repo eingeloggt + Projekt verlinkt (`supabase link`)
#   - jq installiert (für die Smoke-Test-JSON-Ausgabe)
#   - openssl installiert (für die Token-Generierung)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# ─── Farben für Lesbarkeit ──────────────────────────────────────────────────
if [[ -t 1 ]]; then
  C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'; C_GREEN=$'\033[32m'; C_RED=$'\033[31m'
  C_YELLOW=$'\033[33m'; C_RESET=$'\033[0m'
else
  C_BOLD=''; C_DIM=''; C_GREEN=''; C_RED=''; C_YELLOW=''; C_RESET=''
fi

step()  { echo; echo "${C_BOLD}── $* ──${C_RESET}"; }
ok()    { echo "${C_GREEN}✓${C_RESET} $*"; }
warn()  { echo "${C_YELLOW}!${C_RESET} $*"; }
fail()  { echo "${C_RED}✗${C_RESET} $*" >&2; exit 1; }

# ─── Voraussetzungen prüfen ─────────────────────────────────────────────────
step "0/6  Voraussetzungen prüfen"

for cmd in supabase openssl jq curl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    fail "Befehl '$cmd' nicht gefunden — bitte installieren und Script neu starten."
  fi
done
ok "supabase, openssl, jq, curl sind installiert"

# Supabase-Projekt-Link prüfen
if [[ ! -f supabase/.temp/project-ref ]] && [[ -z "${SUPABASE_PROJECT_REF:-}" ]]; then
  warn "Projekt scheint nicht verlinkt. Versuche jetzt 'supabase link'..."
  echo "    Falls Du den Projekt-Ref kennst, kannst Du auch:"
  echo "    SUPABASE_PROJECT_REF=<ref> bash scripts/deploy-ai-risk.sh"
  supabase link || fail "supabase link fehlgeschlagen"
fi

PROJECT_REF="${SUPABASE_PROJECT_REF:-$(cat supabase/.temp/project-ref 2>/dev/null || true)}"
if [[ -z "$PROJECT_REF" ]]; then
  fail "PROJECT_REF konnte nicht ermittelt werden — bitte SUPABASE_PROJECT_REF env setzen."
fi
PROJECT_URL="https://${PROJECT_REF}.supabase.co"
FUNCTION_URL="${PROJECT_URL}/functions/v1/ai-risk"
ok "Projekt-Ref: $PROJECT_REF"
ok "Function-URL: $FUNCTION_URL"

# ─── 1/6 Anthropic API Key einlesen ─────────────────────────────────────────
step "1/6  ANTHROPIC_API_KEY einlesen"

echo "    Falls noch keiner existiert: https://console.anthropic.com/settings/keys"
echo "    → Create Key → kopieren → unten einfügen"
echo "    (Eingabe ist verdeckt, nichts wird auf Disk geschrieben)"
echo
read -r -s -p "    ANTHROPIC_API_KEY: " ANTHROPIC_API_KEY
echo

if [[ -z "$ANTHROPIC_API_KEY" ]]; then
  fail "Kein Key eingegeben — abgebrochen."
fi
if [[ ! "$ANTHROPIC_API_KEY" =~ ^sk-ant- ]]; then
  warn "Key beginnt nicht mit 'sk-ant-' — könnte falsch sein. Trotzdem weiter? [y/N]"
  read -r CONFIRM
  [[ "$CONFIRM" == "y" || "$CONFIRM" == "Y" ]] || fail "Abgebrochen."
fi
ok "Key entgegengenommen (Länge: ${#ANTHROPIC_API_KEY} Zeichen)"

# ─── 2/6 AI_RISK_AGENT_TOKEN generieren ─────────────────────────────────────
step "2/6  AI_RISK_AGENT_TOKEN generieren"

AI_RISK_AGENT_TOKEN="$(openssl rand -hex 32)"
ok "Frischer Token erzeugt (64 hex chars)"

# ─── 3/6 Supabase Function-Secrets setzen ───────────────────────────────────
step "3/6  Supabase Function-Secrets setzen"

supabase secrets set \
  ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  AI_RISK_AGENT_TOKEN="$AI_RISK_AGENT_TOKEN" \
  >/dev/null || fail "supabase secrets set fehlgeschlagen"
ok "Beide Secrets gesetzt"

# ─── 4/6 Migrations pushen + Edge Function deployen ─────────────────────────
step "4/6  Migrations + Edge Function deployen"

supabase db push || fail "supabase db push fehlgeschlagen"
ok "Migrations eingespielt"

supabase functions deploy ai-risk || fail "Edge Function deploy fehlgeschlagen"
ok "Edge Function deployed"

# ─── 5/6 Smoke-Test 1: Healthcheck ──────────────────────────────────────────
step "5/6  Smoke-Test 1: Healthcheck (kein Anthropic-Cost)"

HEALTHCHECK_RESP="$(curl -sS -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $AI_RISK_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"payload":{"_healthcheck":true}}')"

echo "$HEALTHCHECK_RESP" | jq . || { echo "$HEALTHCHECK_RESP"; fail "Antwort ist kein JSON"; }

HC_TIER="$(echo "$HEALTHCHECK_RESP" | jq -r '.risk_tier // empty')"
if [[ "$HC_TIER" != "minimal" ]]; then
  fail "Healthcheck lieferte risk_tier='$HC_TIER', erwartet 'minimal'. Stop, debug."
fi
ok "Healthcheck ok"

# ─── 6/6 Smoke-Test 2: Echter Call gegen High-Risk-Sample ───────────────────
step "6/6  Smoke-Test 2: High-Risk-Sample (verbraucht ~1k Anthropic-Tokens)"

SAMPLE_RESP="$(curl -sS -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $AI_RISK_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"payload":{"system_name":"Recruitment AI Screener","sector":"hr","context":"employment_access","decisions_affect_persons":true}}')"

echo "$SAMPLE_RESP" | jq . || { echo "$SAMPLE_RESP"; fail "Antwort ist kein JSON"; }

S_TIER="$(echo "$SAMPLE_RESP" | jq -r '.risk_tier // empty')"
case "$S_TIER" in
  high)
    ok "High-Risk-Sample → risk_tier=high. Anthropic-Pfad funktioniert."
    ;;
  minimal|limited|prohibited)
    warn "High-Risk-Sample → risk_tier=$S_TIER (erwartet 'high'). KEIN Bug — semantisches Signal."
    warn "Notiere das. Baseline-Run kann trotzdem starten — die Confusion-Matrix zeigt den vollständigen Befund."
    ;;
  "")
    fail "High-Risk-Sample: keine valide risk_tier in der Antwort."
    ;;
esac

# ─── Final: GitHub-Repo-Secrets zum Copy-Paste ──────────────────────────────
SERVICE_KEY_SNIPPET="$(supabase status --output json 2>/dev/null | jq -r '.api.service_role // empty' || true)"
if [[ -z "$SERVICE_KEY_SNIPPET" ]]; then
  SERVICE_KEY_HINT="https://supabase.com/dashboard/project/${PROJECT_REF}/settings/api  → service_role key kopieren"
else
  SERVICE_KEY_HINT="(autodetected) — siehe unten"
fi

echo
echo "${C_BOLD}═══════════════════════════════════════════════════════════════════════${C_RESET}"
echo "${C_BOLD}  GitHub Repo Secrets — diese vier Werte in die Repo-Settings eintragen${C_RESET}"
echo "${C_BOLD}═══════════════════════════════════════════════════════════════════════${C_RESET}"
echo
echo "  URL: https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/settings/secrets/actions/new"
echo
echo "  ${C_BOLD}1.${C_RESET} Name:  SUPABASE_URL"
echo "     Wert: $PROJECT_URL"
echo
echo "  ${C_BOLD}2.${C_RESET} Name:  SUPABASE_SERVICE_KEY"
echo "     Wert: $SERVICE_KEY_HINT"
echo
echo "  ${C_BOLD}3.${C_RESET} Name:  AI_RISK_AGENT_URL"
echo "     Wert: $FUNCTION_URL"
echo
echo "  ${C_BOLD}4.${C_RESET} Name:  AI_RISK_AGENT_TOKEN"
echo "     Wert: $AI_RISK_AGENT_TOKEN"
echo
echo "${C_DIM}  (Token nicht woanders speichern — wenn Du ihn verlierst, einfach das${C_RESET}"
echo "${C_DIM}   Script neu laufen lassen, der Token wird neu generiert.)${C_RESET}"
echo
echo "${C_BOLD}═══════════════════════════════════════════════════════════════════════${C_RESET}"
echo "${C_BOLD}  Nächster Schritt — Workflow triggern${C_RESET}"
echo "${C_BOLD}═══════════════════════════════════════════════════════════════════════${C_RESET}"
echo
echo "  https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/actions/workflows/risk-agent-eval.yml"
echo "  → Run workflow → Branch 'claude/review-project-status-umBWS' wählen → Run"
echo
echo "  Dauer: ~2–3 Minuten (30 Goldset-Cases × ~2-3s Anthropic-Latency)"
echo "  Ergebnis erscheint als PR-Kommentar + Action-Artifact."
echo
ok "Bootstrap fertig. Setze die vier Repo-Secrets und triggere den Workflow."
