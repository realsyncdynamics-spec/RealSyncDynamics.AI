#!/usr/bin/env bash
# gtm-readiness-check.sh
#
# Single-command Pre-Outreach-Gate. Bevor du auch nur EINE DSB-Kanzlei
# kalt kontaktierst, lass das hier laufen. Wenn ein Punkt rot ist —
# kein Outreach. Anwälte googeln das System in 60 Sekunden und finden
# jede Inkonsistenz.
#
# Usage:
#   bash scripts/gtm-readiness-check.sh
#
# Exit codes:
#   0 — alle Gates grün, Outreach freigegeben
#   1 — ein oder mehr Gates rot, NICHT versenden
#   2 — Tool selbst falsch konfiguriert (env missing etc.)

set -uo pipefail

# ── Config ─────────────────────────────────────────────────────────
SITE="https://realsyncdynamicsai.de"
SUPA="https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1"
TIMEOUT=10

# Track failures
FAILED=0
WARNINGS=0

# ── Colors (degraded if not a tty) ─────────────────────────────────
if [[ -t 1 ]]; then
  RED='\033[31m'; GREEN='\033[32m'; YELLOW='\033[33m'; CYAN='\033[36m'; RESET='\033[0m'; BOLD='\033[1m'
else
  RED=''; GREEN=''; YELLOW=''; CYAN=''; RESET=''; BOLD=''
fi

# ── Helpers ────────────────────────────────────────────────────────
gate_pass() {
  printf "  ${GREEN}✓${RESET} %s\n" "$1"
}
gate_fail() {
  printf "  ${RED}✗${RESET} %s\n" "$1"
  FAILED=$((FAILED + 1))
}
gate_warn() {
  printf "  ${YELLOW}⚠${RESET} %s\n" "$1"
  WARNINGS=$((WARNINGS + 1))
}
gate_info() {
  printf "  ${CYAN}ℹ${RESET} %s\n" "$1"
}
section() {
  printf "\n${BOLD}%s${RESET}\n" "$1"
}

# ── Probe helpers ──────────────────────────────────────────────────
http_status() {
  curl -sS -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" -L "$1" 2>/dev/null
}
http_body() {
  curl -sS --max-time "$TIMEOUT" -L "$1" 2>/dev/null
}
http_post_json() {
  curl -sS -X POST "$1" -H 'Content-Type: application/json' -d "$2" --max-time "$TIMEOUT" 2>/dev/null
}

# ── Pre-flight ─────────────────────────────────────────────────────
section "▸ Pre-flight"
if ! command -v curl >/dev/null 2>&1; then
  printf "${RED}curl not found — abort.${RESET}\n"
  exit 2
fi
gate_pass "curl available"

# ── Gate 1: Live-Site is up ────────────────────────────────────────
section "▸ Gate 1 — Live site reachable"
STATUS=$(http_status "$SITE")
if [[ "$STATUS" == "200" ]]; then
  gate_pass "$SITE → 200"
else
  gate_fail "$SITE → $STATUS (expected 200)"
fi

# ── Gate 2: Pricing page has 6 tiers (Scale included) ──────────────
section "▸ Gate 2 — Pricing-Page reflects 6 Tiers (Scale-Tier merged?)"
PRICING=$(http_body "$SITE/pricing")
# SPA — Tier text is JS-rendered. Probe instead for the lazy-chunk asset.
# Heuristic: check the assets/index-*.js bundle for the literal string 'scale'
# in tier IDs.
BUNDLE_PATH=$(echo "$PRICING" | grep -oE '/assets/index[^"]*\.js' | head -1)
if [[ -z "$BUNDLE_PATH" ]]; then
  gate_warn "Couldn't find JS bundle URL in page HTML (probe inconclusive)"
else
  BUNDLE=$(http_body "$SITE$BUNDLE_PATH")
  if echo "$BUNDLE" | grep -q "id:\"scale\""; then
    gate_pass "Scale-Tier shipped in bundle (PR #349 merged)"
  else
    gate_fail "Scale-Tier NOT in deployed bundle — PR #349 not merged. DSB-deck mentions Scale; pricing page would contradict it."
  fi
fi

# ── Gate 3: /partners page is reachable ────────────────────────────
section "▸ Gate 3 — /partners landing live (PR #350 merged?)"
STATUS=$(http_status "$SITE/partners")
if [[ "$STATUS" == "200" ]]; then
  gate_pass "$SITE/partners → 200"
else
  gate_fail "$SITE/partners → $STATUS — PR #350 not merged. Outreach links to /partners would 404."
fi

# ── Gate 4: AI Gateway health (Anthropic fallback live?) ───────────
section "▸ Gate 4 — ai-gateway health + Anthropic-fallback wired"
HEALTH=$(http_post_json "$SUPA/ai-gateway" '{"op":"health"}')
if echo "$HEALTH" | grep -q '"ok":true'; then
  gate_pass "ai-gateway health → ok"
  # Bonus: check for fallback shape (PR #344 + Vault key)
  if echo "$HEALTH" | grep -q '"fallback"'; then
    gate_pass "fallback chain wired (PR #344 deployed + ANTHROPIC key in Vault)"
  else
    gate_warn "ai-gateway healthy but no 'fallback' field — PR #344 not deployed yet"
  fi
elif echo "$HEALTH" | grep -q "lmstudio.internal\|dns error"; then
  gate_fail "ai-gateway returns DNS error for LM Studio. PR #344 (Anthropic fallback) not deployed OR Vault key missing. AssistantChip is broken — Outreach demos will fail."
else
  gate_fail "ai-gateway health unexpected: $(echo "$HEALTH" | head -c 200)"
fi

# ── Gate 5: gdpr-audit functional smoke ────────────────────────────
section "▸ Gate 5 — /audit submission works end-to-end"
AUDIT=$(http_post_json "$SUPA/gdpr-audit" '{"url":"https://example.com","email":"readiness@test.invalid"}')
if echo "$AUDIT" | grep -q '"ok":true'; then
  AUDIT_ID=$(echo "$AUDIT" | grep -oE '"audit_id":"[^"]+"' | sed 's/.*:"\(.*\)"/\1/')
  gate_pass "gdpr-audit returns score + audit_id ($AUDIT_ID)"
else
  gate_fail "gdpr-audit failed: $(echo "$AUDIT" | head -c 200)"
  AUDIT_ID=""
fi

# ── Gate 6: audit-report-pdf NOT broken ────────────────────────────
section "▸ Gate 6 — audit-report-pdf (Demo-Endpoint) works (PR #348 merged?)"
if [[ -n "${AUDIT_ID:-}" ]]; then
  PDF=$(http_post_json "$SUPA/audit-report-pdf" "{\"audit_id\":\"$AUDIT_ID\"}")
  if echo "$PDF" | grep -q '"ok":true'; then
    gate_pass "audit-report-pdf returns signed URL"
  elif echo "$PDF" | grep -q "Bucket not found"; then
    gate_fail "audit-report-pdf: 'Bucket not found'. PR #348 (documents storage bucket) not merged. PDF-Download im Demo bricht."
  else
    gate_warn "audit-report-pdf returned unexpected: $(echo "$PDF" | head -c 200)"
  fi
else
  gate_warn "skipping (no audit_id from Gate 5)"
fi

# ── Gate 7: Tool routes (Bußgeld / Meldepflicht etc.) — PR #347 ────
section "▸ Gate 7 — Tool-route aliases live (PR #347 merged?)"
ROUTES=("/bussgeld-rechner" "/bussgeldrechner" "/meldepflicht-timer" "/legaltech" "/publicsector" "/hr")
ALL_OK=true
for r in "${ROUTES[@]}"; do
  STATUS=$(http_status "$SITE$r")
  if [[ "$STATUS" != "200" ]]; then
    ALL_OK=false
    gate_warn "$r → $STATUS (PR #347 alias missing or SPA-routing dance fails — visitors see 404 first)"
  fi
done
if $ALL_OK; then
  gate_pass "all 6 alias routes return 200 directly (PR #347 merged)"
fi

# ── Gate 8: AssistentChip overlap fix (PR #328) ────────────────────
section "▸ Gate 8 — AssistentChip Position (bottom-right vs bottom-center)"
if echo "$PRICING" | grep -q "right-4 bottom-4"; then
  gate_pass "Chip is at bottom-right (PR #328 merged) — no body-copy overlap on scroll"
elif echo "$PRICING" | grep -q "left-1/2 -translate-x-1/2"; then
  gate_fail "Chip is at bottom-CENTER — PR #328 not merged. Will overlap body-copy on mobile during demo."
else
  gate_warn "Chip position inconclusive (probe SPA bundle directly)"
fi

# ── Gate 9: legal entity sanity check (UK Ltd vs DE Einzelunternehmen) ─
section "▸ Gate 9 — Legal-entity check (Companies-House Risk)"
IMPRESSUM=$(http_body "$SITE/impressum")
HAS_UK_LTD=false
HAS_DE_SOLE=false
echo "$IMPRESSUM" | grep -qi "REALSYNC AI LTD\|UK Companies\|Limited" && HAS_UK_LTD=true
echo "$IMPRESSUM" | grep -qi "Einzelunternehmen\|Dominik Steiner" && HAS_DE_SOLE=true

if $HAS_UK_LTD && $HAS_DE_SOLE; then
  gate_warn "Impressum mentions BOTH UK Ltd and DE Einzelunternehmen — pick one before outreach (DSB lawyers will spot)"
elif $HAS_UK_LTD; then
  gate_pass "Impressum: UK Ltd. Outreach material must match Companies-House #15647435."
elif $HAS_DE_SOLE; then
  gate_pass "Impressum: DE Einzelunternehmen (Dominik Steiner). Outreach material must NOT claim UK Ltd."
else
  gate_warn "Impressum-legal-entity unclear from probe"
fi

# ── Gate 10: GTM artifacts present ─────────────────────────────────
section "▸ Gate 10 — GTM artifacts present in /root/"
for f in /root/REALSYNC_AI_LTD.md /root/MARKETING_STRATEGY_10M.md /root/DSB_KANZLEIEN_150.csv /root/OUTREACH_SEQUENCES_TOP10.md /root/SALES_PIPELINE_DSB.csv /root/SALES_SCRIPT_5MIN.md; do
  if [[ -f "$f" ]]; then
    SIZE=$(stat -c%s "$f" 2>/dev/null || stat -f%z "$f" 2>/dev/null || echo 0)
    if [[ "$SIZE" -lt 500 ]]; then
      gate_warn "$f exists but suspiciously small ($SIZE bytes)"
    else
      gate_pass "$f ($SIZE bytes)"
    fi
  else
    gate_fail "$f MISSING — GTM material incomplete"
  fi
done

KANZLEI_COUNT=$(wc -l < /root/DSB_KANZLEIEN_150.csv 2>/dev/null || echo 0)
KANZLEI_COUNT=$((KANZLEI_COUNT - 1))  # subtract header
if [[ "$KANZLEI_COUNT" -lt 100 ]]; then
  gate_warn "DSB_KANZLEIEN_150.csv has only $KANZLEI_COUNT entries (target 150). Plan-volume is at $((KANZLEI_COUNT * 100 / 150))% of design — Pipeline shorter."
fi

# ── Summary ────────────────────────────────────────────────────────
section "▸ Summary"
TOTAL_GATES=10
if [[ "$FAILED" -eq 0 && "$WARNINGS" -eq 0 ]]; then
  printf "${GREEN}${BOLD}✓ ALLE %d GATES GRÜN${RESET}\n" "$TOTAL_GATES"
  printf "${GREEN}Outreach FREIGEGEBEN. Starte mit Top-5 aus /root/SALES_PIPELINE_DSB.csv.${RESET}\n"
  exit 0
elif [[ "$FAILED" -eq 0 ]]; then
  printf "${YELLOW}${BOLD}⚠ %d Warnings (keine Hard-Fails)${RESET}\n" "$WARNINGS"
  printf "${YELLOW}Outreach möglich, aber Warnings vorher prüfen.${RESET}\n"
  exit 0
else
  printf "${RED}${BOLD}✗ %d Hard-Fails + %d Warnings${RESET}\n" "$FAILED" "$WARNINGS"
  printf "${RED}KEIN OUTREACH bis die Hard-Fails grün sind.${RESET}\n"
  printf "Empfehlung: merge offene PRs (#344, #347, #348, #349, #350), dann erneut prüfen.${RESET}\n"
  exit 1
fi
