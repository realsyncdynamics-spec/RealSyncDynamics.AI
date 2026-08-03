#!/bin/bash

################################################################################
# VPS Frontend Smoke Test
#
# Quick validation that the deployed frontend is working correctly.
# Run as: bash smoke-test-vps.sh
#
# Checks:
# - Docker container is running
# - Health endpoint responds
# - Main page loads
# - Key assets are available
# - Performance is acceptable
################################################################################

set -Eeuo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
CONTAINER_NAME="realsync-frontend"
LOCAL_PORT=${FRONTEND_HOST_PORT:-8090}
LOCAL_URL="http://127.0.0.1:${LOCAL_PORT}"
PUBLIC_URL="https://realsyncdynamicsai.de"
TIMEOUT=10

PASSED=0
FAILED=0
WARNINGS=0

echo -e "${BLUE}🧪 Frontend Smoke Test${NC}"
echo -e "${BLUE}Time: $(date)${NC}"
echo ""

################################################################################
# Test 1: Container Status
################################################################################

echo -e "${YELLOW}Test 1: Docker Container Status${NC}"

if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  STATUS=$(docker inspect -f '{{.State.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo "unknown")
  HEALTH=$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo "no health check")

  echo "  Status: $STATUS"
  echo "  Health: $HEALTH"

  if [[ "$STATUS" == "running" ]]; then
    if [[ "$HEALTH" == "healthy" ]]; then
      echo -e "${GREEN}✅ Container is running and healthy${NC}"
      PASSED=$((PASSED + 1))
    else
      echo -e "${YELLOW}⚠️  Container running but health status: $HEALTH${NC}"
      WARNINGS=$((WARNINGS + 1))
    fi
  else
    echo -e "${RED}❌ Container is not running${NC}"
    FAILED=$((FAILED + 1))
  fi
else
  echo -e "${RED}❌ Container '$CONTAINER_NAME' not found${NC}"
  FAILED=$((FAILED + 1))
fi

echo ""

################################################################################
# Test 2: Health Endpoint (Local)
################################################################################

echo -e "${YELLOW}Test 2: Health Endpoint (Local)${NC}"

if timeout $TIMEOUT curl -fsS "${LOCAL_URL}/healthz" >/dev/null 2>&1; then
  echo -e "${GREEN}✅ Health endpoint responds: ${LOCAL_URL}/healthz${NC}"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}❌ Health endpoint not responding${NC}"
  FAILED=$((FAILED + 1))
fi

echo ""

################################################################################
# Test 3: Main Page Load
################################################################################

echo -e "${YELLOW}Test 3: Main Page Load${NC}"

# "|| true", nicht "|| echo 000": curl schreibt bei Fehlschlag bereits "000" und
# exitet ≠ 0 — ein zusätzliches echo ergäbe "000000".
HTTP_CODE=$(timeout $TIMEOUT curl -s -o /dev/null -w "%{http_code}" "${LOCAL_URL}/" || true)
HTTP_CODE=${HTTP_CODE:-000}

if [[ "$HTTP_CODE" == "200" ]]; then
  echo -e "${GREEN}✅ Main page loads: HTTP $HTTP_CODE${NC}"
  PASSED=$((PASSED + 1))
elif [[ "$HTTP_CODE" == "304" ]]; then
  echo -e "${GREEN}✅ Main page cached: HTTP $HTTP_CODE${NC}"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}❌ Main page error: HTTP $HTTP_CODE${NC}"
  FAILED=$((FAILED + 1))
fi

echo ""

################################################################################
# Test 4: Asset Loading
################################################################################

echo -e "${YELLOW}Test 4: Asset Files${NC}"

# Check if /assets directory returns proper responses
ASSETS_HTTP=$(timeout $TIMEOUT curl -s -o /dev/null -w "%{http_code}" "${LOCAL_URL}/assets/" || true)
ASSETS_HTTP=${ASSETS_HTTP:-000}

if [[ "$ASSETS_HTTP" == "200" ]] || [[ "$ASSETS_HTTP" == "301" ]] || [[ "$ASSETS_HTTP" == "404" ]]; then
  echo -e "${GREEN}✅ Assets path responds: HTTP $ASSETS_HTTP${NC}"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}❌ Assets path error: HTTP $ASSETS_HTTP${NC}"
  FAILED=$((FAILED + 1))
fi

echo ""

################################################################################
# Test 5: Security Headers
################################################################################

echo -e "${YELLOW}Test 5: Security Headers${NC}"

HEADERS=$(timeout $TIMEOUT curl -sI "${LOCAL_URL}/" || echo "")

# Check for key security headers
declare -A REQUIRED_HEADERS=(
  ["X-Content-Type-Options"]="nosniff"
  ["X-Frame-Options"]="SAMEORIGIN"
  ["Referrer-Policy"]="strict-origin-when-cross-origin"
)

HEADERS_OK=0
for header in "${!REQUIRED_HEADERS[@]}"; do
  if echo "$HEADERS" | grep -qi "^${header}:"; then
    echo "  ✅ $header"
    HEADERS_OK=$((HEADERS_OK + 1))
  else
    echo "  ⚠️  $header missing"
  fi
done

if [[ $HEADERS_OK -ge 2 ]]; then
  echo -e "${GREEN}✅ Security headers present${NC}"
  PASSED=$((PASSED + 1))
else
  echo -e "${YELLOW}⚠️  Some security headers missing${NC}"
  WARNINGS=$((WARNINGS + 1))
fi

echo ""

################################################################################
# Test 6: Response Time
################################################################################

echo -e "${YELLOW}Test 6: Response Time${NC}"

START=$(date +%s%N)
REQUEST_OK=true
timeout $TIMEOUT curl -fs "${LOCAL_URL}/" > /dev/null 2>&1 || REQUEST_OK=false
END=$(date +%s%N)

DURATION_MS=$(( (END - START) / 1000000 ))

# Eine fehlgeschlagene Anfrage ist KEIN bestandener Performance-Test — sonst
# meldet der Smoke-Test auf einem toten Server grün, weil der Fehler schnell kam.
if [[ "$REQUEST_OK" != "true" ]]; then
  echo -e "${RED}❌ Request failed after ${DURATION_MS}ms — no timing measured${NC}"
  FAILED=$((FAILED + 1))
elif [[ $DURATION_MS -lt 500 ]]; then
  echo -e "${GREEN}✅ Fast response: ${DURATION_MS}ms${NC}"
  PASSED=$((PASSED + 1))
elif [[ $DURATION_MS -lt 2000 ]]; then
  echo -e "${YELLOW}⚠️  Acceptable response: ${DURATION_MS}ms${NC}"
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "${RED}❌ Slow response: ${DURATION_MS}ms${NC}"
  FAILED=$((FAILED + 1))
fi

echo ""

################################################################################
# Test 7: Public URL (if reachable)
################################################################################

echo -e "${YELLOW}Test 7: Public URL Reachability${NC}"

if timeout 5 curl -fsS "${PUBLIC_URL}/healthz" >/dev/null 2>&1; then
  echo -e "${GREEN}✅ Public URL reachable: ${PUBLIC_URL}${NC}"
  PASSED=$((PASSED + 1))
else
  echo -e "${YELLOW}⚠️  Public URL not reachable (may be expected if reverse-proxy not set up)${NC}"
  WARNINGS=$((WARNINGS + 1))
fi

echo ""

################################################################################
# Test 8: Docker Logs Check
################################################################################

echo -e "${YELLOW}Test 8: Container Logs (checking for errors)${NC}"

# grep -c gibt die Zahl aus UND exitet mit 1, wenn nichts matcht. Ein "|| echo 0"
# würde deshalb eine zweite Zeile anhängen ("0\n0") und den Vergleich unten mit
# einem Syntaxfehler sprengen — daher "|| true" statt "|| echo 0".
# Erst prüfen, ob die Logs überhaupt lesbar sind. Sonst zählt "keine Treffer in
# leerer Ausgabe" als bestanden — grün, obwohl der Daemon oder Container fehlt.
if LOG_OUTPUT=$(docker logs --tail=50 "$CONTAINER_NAME" 2>&1); then
  ERROR_COUNT=$(printf '%s\n' "$LOG_OUTPUT" | grep -ci "error\|fatal\|exception" || true)
  ERROR_COUNT=${ERROR_COUNT:-0}

  if [[ $ERROR_COUNT -eq 0 ]]; then
    echo -e "${GREEN}✅ No errors in recent logs${NC}"
    PASSED=$((PASSED + 1))
  else
    echo -e "${YELLOW}⚠️  Found $ERROR_COUNT error mentions in logs${NC}"
    WARNINGS=$((WARNINGS + 1))
  fi
else
  echo -e "${RED}❌ Could not read container logs (daemon or container missing)${NC}"
  FAILED=$((FAILED + 1))
fi

echo ""

################################################################################
# Summary
################################################################################

TOTAL=$((PASSED + FAILED + WARNINGS))

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}Passed:  $PASSED${NC}"
echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
echo -e "${RED}Failed:  $FAILED${NC}"
echo ""

if [[ $FAILED -eq 0 ]]; then
  if [[ $WARNINGS -eq 0 ]]; then
    echo -e "${GREEN}✅ All tests passed! Frontend is healthy.${NC}"
    exit 0
  else
    echo -e "${YELLOW}⚠️  Tests passed with warnings. Review above.${NC}"
    exit 0
  fi
else
  echo -e "${RED}❌ $FAILED test(s) failed. Review above.${NC}"
  echo ""
  echo "Troubleshooting:"
  echo "  1. Check logs: docker compose logs -f"
  echo "  2. Verify .env: cat deploy/frontend-vps-deploy-v2/.env"
  echo "  3. Restart: docker compose restart"
  echo "  4. See DEPLOYMENT_RUNBOOK.md for more help"
  exit 1
fi
