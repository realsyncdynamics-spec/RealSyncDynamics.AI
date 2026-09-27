#!/bin/bash
# Schnelle Diagnose für den Production-Deploy-Fehler
# Befund 1: Alte Seite live statt MainLanding
# Datum: 2026-09-04

set -e

echo "════════════════════════════════════════════════════════════════"
echo "Production Deploy Diagnostik — 3 Tests"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Test 1: Welche Seite ist live?
echo "Test 1: Welche Seite ist live?"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

CONTENT=$(curl -s https://realsyncdynamicsai.de/ 2>/dev/null | head -500)

if echo "$CONTENT" | grep -qi "earth\|bolt"; then
  echo "✅ NEUE SEITE (MainLanding) ist live"
  echo "   Die Bolt-Seite ist bereits online. Problem könnte behoben sein."
elif echo "$CONTENT" | grep -qi "governance\|workspace\|radar"; then
  echo "❌ ALTE SEITE (PublicWorkspacePreview) ist live"
  echo "   Deploy ist veraltet. Siehe Test 2 & 3."
else
  echo "⚠️  UNBEKANNTE Seite — Netzwerkfehler oder Website down?"
  exit 1
fi

echo ""

# Test 2: Welcher Origin antwortet?
echo "Test 2: Cloudflare Pages oder GitHub Pages?"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

HEADERS=$(curl -sI https://realsyncdynamicsai.de/ 2>/dev/null)

if echo "$HEADERS" | grep -qi "server.*cloudflare\|cf-ray"; then
  echo "✅ CLOUDFLARE Pages antwortet (korrekt)"
  echo "   Der DNS zeigt auf den richtigen Origin."
elif echo "$HEADERS" | grep -qi "server.*github\|pages.github"; then
  echo "❌ GITHUB Pages antwortet (falsch!)"
  echo "   → DNS zeigt noch auf alten Origin"
  echo "   → Siehe Ursache A: docs/runbooks/PRODUCTION_DEPLOY_RECOVERY.md"
  exit 1
else
  echo "⚠️  Origin unklar. Headers:"
  echo "$HEADERS" | head -10
fi

echo ""

# Test 3: DNS-Records
echo "Test 3: DNS-Records prüfen"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v dig &> /dev/null; then
  DNS_IP=$(dig +short realsyncdynamicsai.de A 2>/dev/null | head -1)
  if [ -z "$DNS_IP" ]; then
    DNS_IP="(kein A-Record, vermutlich CNAME/ALIAS)"
  fi

  echo "A-Record für realsyncdynamicsai.de: $DNS_IP"

  if echo "$DNS_IP" | grep -q "185.199.10"; then
    echo "❌ GitHub Pages IP erkannt (185.199.10x.xxx)"
    echo "   → Siehe Ursache A: DNS-Migration erforderlich"
  elif echo "$DNS_IP" | grep -q "\."; then
    echo "⚠️  Anderer IP-Bereich — nicht GitHub/Cloudflare Standard"
  else
    echo "✅ CNAME/ALIAS zu Cloudflare (kein direkter A-Record)"
  fi
else
  echo "⚠️  dig nicht verfügbar — übersprungen"
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "Nächste Schritte:"
echo "────────────────"
if echo "$CONTENT" | grep -qi "earth\|bolt"; then
  echo "1. Problem behoben! Neue Seite ist live. ✅"
  echo "2. Rückfrage: Wurde der DNS oder die Secrets gerade gesetzt?"
else
  echo "1. Lese: docs/runbooks/PRODUCTION_DEPLOY_RECOVERY.md"
  echo "2. Führe aus:"
  if echo "$HEADERS" | grep -qi "github"; then
    echo "   → Ursache A: DNS auf Cloudflare Pages umstellen"
  else
    echo "   → Ursache B/C: Secrets setzen oder Build debuggen"
  fi
  echo "3. Trigger: GitHub Actions → Deploy-Workflow → Run workflow"
  echo "4. Warte 10 Min, dann teste neu: curl -s https://realsyncdynamicsai.de/ | grep -i earth"
fi
echo "════════════════════════════════════════════════════════════════"
