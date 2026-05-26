#!/usr/bin/env bash
# install-openclaw-vps.sh
#
# One-shot Setup fuer den OpenClaw-Compliance-Agent auf dem Hostinger-VPS
# (srv1622293, 187.77.89.1). Idempotent: sicher mehrfach auszufuehren.
#
# Was das Skript macht:
#   1. Pullt das Docker-Image realsync/openclaw-agent:latest
#   2. Schreibt /etc/openclaw-agent/env (chmod 600) mit den env-Vars
#   3. Installiert die systemd-Unit openclaw-agent.service
#   4. Startet den Service und wartet bis 127.0.0.1:3001/healthz antwortet
#   5. Installiert beide nginx-Configs:
#         - api.realsyncdynamicsai.de (eigene Subdomain + cert)
#         - /etc/nginx/snippets/openclaw-apex.conf (Apex-Pfad-Fallback)
#      und injiziert die include-Zeile in den Apex-Vhost (falls fehlt).
#   6. nginx -t + reload
#   7. Optional: certbot --nginx fuer api.realsyncdynamicsai.de
#   8. Health-Check + Bearer-Auth-Check gegen beide Endpoints
#
# Voraussetzungen:
#   - Ubuntu/Debian, root oder sudo
#   - docker, nginx, certbot, openssl installiert
#   - Apex-Vhost realsyncdynamicsai.de.conf bereits aktiv (deploy/README.md)
#   - DNS-A-Record api.realsyncdynamicsai.de → 187.77.89.1 (fuer certbot-Schritt)
#
# Verwendung (auf dem VPS, im Repo-Root):
#
#   sudo OPENAI_API_KEY="sk-..." \
#        CERTBOT_EMAIL="ops@realsyncdynamicsai.de" \
#        bash scripts/install-openclaw-vps.sh
#
# Optional:
#   OPENCLAW_SECRET=...                  (default: openssl rand -hex 32)
#   OPENCLAW_CORS_ORIGINS=...            (default: https://realsyncdynamicsai.de,https://www.realsyncdynamicsai.de)
#   OPENCLAW_RATE_LIMIT_PER_MIN=10
#   OPENCLAW_DAILY_TOKEN_CAP=2000000
#   SENTRY_DSN=https://...
#   DOCKER_IMAGE=realsync/openclaw-agent:latest
#   SKIP_CERTBOT=1                       (kein cert-Lauf, nur Subdomain-vhost ohne TLS)

set -euo pipefail

# ─── Config ─────────────────────────────────────────────────────────────────
APEX_DOMAIN="${APEX_DOMAIN:-realsyncdynamicsai.de}"
API_DOMAIN="${API_DOMAIN:-api.realsyncdynamicsai.de}"
DOCKER_IMAGE="${DOCKER_IMAGE:-realsync/openclaw-agent:latest}"

OPENAI_API_KEY="${OPENAI_API_KEY:-}"
OPENCLAW_SECRET="${OPENCLAW_SECRET:-}"
OPENCLAW_CORS_ORIGINS="${OPENCLAW_CORS_ORIGINS:-https://${APEX_DOMAIN},https://www.${APEX_DOMAIN}}"
OPENCLAW_RATE_LIMIT_PER_MIN="${OPENCLAW_RATE_LIMIT_PER_MIN:-10}"
OPENCLAW_DAILY_TOKEN_CAP="${OPENCLAW_DAILY_TOKEN_CAP:-2000000}"
SENTRY_DSN="${SENTRY_DSN:-}"
PORT="${PORT:-3001}"

CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
SKIP_CERTBOT="${SKIP_CERTBOT:-0}"

REPO_ROOT="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
SERVICE_SRC="$REPO_ROOT/services/openclaw-agent/openclaw-agent.service"
APEX_SNIPPET_SRC="$REPO_ROOT/deploy/nginx/snippets/openclaw-apex.conf"
API_VHOST_SRC="$REPO_ROOT/deploy/nginx/${API_DOMAIN}.conf"

ENV_FILE="/etc/openclaw-agent/env"
SERVICE_DST="/etc/systemd/system/openclaw-agent.service"
APEX_SNIPPET_DST="/etc/nginx/snippets/openclaw-apex.conf"
APEX_VHOST="/etc/nginx/sites-available/${APEX_DOMAIN}.conf"
API_VHOST_DST="/etc/nginx/sites-available/${API_DOMAIN}.conf"
API_VHOST_LINK="/etc/nginx/sites-enabled/${API_DOMAIN}.conf"
INCLUDE_LINE="include /etc/nginx/snippets/openclaw-apex.conf;"

log()  { echo "[openclaw-setup] $*"; }
warn() { echo "[openclaw-setup] WARN: $*" >&2; }
fail() { echo "[openclaw-setup] ERROR: $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "Bitte als root oder mit sudo ausfuehren."
[ -n "$OPENAI_API_KEY" ] || fail "OPENAI_API_KEY env-var fehlt."
[ -f "$SERVICE_SRC" ]      || fail "systemd-Unit nicht gefunden: $SERVICE_SRC (im Repo-Root ausfuehren)"
[ -f "$APEX_SNIPPET_SRC" ] || fail "apex-Snippet nicht gefunden: $APEX_SNIPPET_SRC"
[ -f "$API_VHOST_SRC" ]    || fail "api-vhost nicht gefunden: $API_VHOST_SRC"

command -v docker  >/dev/null 2>&1 || fail "docker nicht installiert"
command -v nginx   >/dev/null 2>&1 || fail "nginx nicht installiert"
command -v openssl >/dev/null 2>&1 || fail "openssl nicht installiert"
command -v curl    >/dev/null 2>&1 || fail "curl nicht installiert"

if [ "$SKIP_CERTBOT" != "1" ]; then
    command -v certbot >/dev/null 2>&1 || fail "certbot nicht installiert (oder SKIP_CERTBOT=1 setzen)"
    [ -n "$CERTBOT_EMAIL" ] || fail "CERTBOT_EMAIL env-var fehlt (oder SKIP_CERTBOT=1 setzen)"
fi

# Apex-Vhost ist Voraussetzung fuer den Path-Fallback
if [ ! -f "$APEX_VHOST" ]; then
    warn "Apex-Vhost $APEX_VHOST nicht gefunden — Apex-Pfad-Fallback wird uebersprungen."
    SKIP_APEX_INCLUDE=1
else
    SKIP_APEX_INCLUDE=0
fi

# ─── 1. OPENCLAW_SECRET generieren falls leer ──────────────────────────────
if [ -z "$OPENCLAW_SECRET" ]; then
    if [ -f "$ENV_FILE" ] && grep -q '^OPENCLAW_SECRET=' "$ENV_FILE"; then
        log "OPENCLAW_SECRET aus existierender env-Datei uebernommen (re-run)."
        OPENCLAW_SECRET="$(grep '^OPENCLAW_SECRET=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
    else
        OPENCLAW_SECRET="$(openssl rand -hex 32)"
        log "OPENCLAW_SECRET neu generiert."
    fi
fi

# ─── 2. Docker-Image pullen (oder lokal bauen als Fallback) ─────────────────
log "Docker-Image pullen: $DOCKER_IMAGE"
IMAGE_FROM_LOCAL_BUILD=0
if docker pull "$DOCKER_IMAGE" >/dev/null 2>&1; then
    log "Image-Pull erfolgreich."
else
    warn "Pull von $DOCKER_IMAGE fehlgeschlagen (Image nicht in Registry?)."
    DOCKERFILE_DIR="$REPO_ROOT/services/openclaw-agent"
    if [ -f "$DOCKERFILE_DIR/Dockerfile" ]; then
        log "Fallback: baue Image lokal aus $DOCKERFILE_DIR …"
        docker build -t "$DOCKER_IMAGE" "$DOCKERFILE_DIR" \
            || fail "Local Docker-Build fehlgeschlagen."
        log "Local Build OK — Image $DOCKER_IMAGE jetzt lokal verfuegbar."
        IMAGE_FROM_LOCAL_BUILD=1
    else
        fail "Pull fehlgeschlagen und kein Dockerfile unter $DOCKERFILE_DIR fuer Local-Build."
    fi
fi

# ─── 3. /etc/openclaw-agent/env schreiben ──────────────────────────────────
log "Schreibe $ENV_FILE (chmod 600)"
mkdir -p "$(dirname "$ENV_FILE")"
umask 077
cat > "$ENV_FILE" <<EOF
# Auto-generiert von scripts/install-openclaw-vps.sh — Edits ueberleben den
# naechsten Re-Run nicht. Stattdessen das Skript mit anderen env-Vars erneut
# laufen lassen.
OPENAI_API_KEY=$OPENAI_API_KEY
OPENCLAW_SECRET=$OPENCLAW_SECRET
OPENCLAW_CORS_ORIGINS=$OPENCLAW_CORS_ORIGINS
OPENCLAW_RATE_LIMIT_PER_MIN=$OPENCLAW_RATE_LIMIT_PER_MIN
OPENCLAW_DAILY_TOKEN_CAP=$OPENCLAW_DAILY_TOKEN_CAP
SENTRY_DSN=$SENTRY_DSN
PORT=$PORT
EOF
chmod 600 "$ENV_FILE"
umask 022

# ─── 4. systemd-Unit installieren + starten ────────────────────────────────
log "Installiere $SERVICE_DST"
if [ "$IMAGE_FROM_LOCAL_BUILD" = "1" ]; then
    # Local-Build-Fallback: docker-pull-Zeile darf nicht fatal sein, sonst
    # versucht systemd bei jedem Start ein Image zu pullen, das nicht in der
    # Registry liegt, und scheitert. Vorzeichen-Dash macht den Pre-Step
    # non-fatal — systemd nutzt den lokal vorhandenen Tag.
    log "(Local-Build erkannt — docker-pull-Zeile wird non-fatal gemacht)"
    sed 's|^ExecStartPre=/usr/bin/docker pull|ExecStartPre=-/usr/bin/docker pull|' \
        "$SERVICE_SRC" > "$SERVICE_DST"
else
    cp "$SERVICE_SRC" "$SERVICE_DST"
fi
systemctl daemon-reload
systemctl enable openclaw-agent >/dev/null 2>&1 || true
systemctl restart openclaw-agent

log "Warte bis 127.0.0.1:${PORT}/healthz antwortet…"
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
    if curl -sf "http://127.0.0.1:${PORT}/healthz" >/dev/null 2>&1; then
        log "OpenClaw-Agent ist healthy auf 127.0.0.1:${PORT} ✓"
        break
    fi
    sleep 2
    [ "$i" = 15 ] && {
        warn "Health-Check fehlgeschlagen. Letzte 50 Zeilen Logs:"
        journalctl -u openclaw-agent -n 50 --no-pager >&2 || true
        fail "OpenClaw-Agent startet nicht."
    }
done

# ─── 5a. api.realsyncdynamicsai.de Subdomain-vhost ─────────────────────────
log "Installiere Subdomain-vhost $API_VHOST_DST"
cp "$API_VHOST_SRC" "$API_VHOST_DST"
ln -sf "$API_VHOST_DST" "$API_VHOST_LINK"

# ─── 5b. Apex-Pfad-Snippet + include-Zeile ─────────────────────────────────
log "Installiere $APEX_SNIPPET_DST"
mkdir -p "$(dirname "$APEX_SNIPPET_DST")"
cp "$APEX_SNIPPET_SRC" "$APEX_SNIPPET_DST"

if [ "$SKIP_APEX_INCLUDE" = "0" ]; then
    if grep -qF "$INCLUDE_LINE" "$APEX_VHOST"; then
        log "include-Zeile bereits im Apex-Vhost vorhanden."
    else
        log "Injiziere include-Zeile in $APEX_VHOST"
        cp "$APEX_VHOST" "${APEX_VHOST}.bak-$(date +%s)"
        # Direkt nach dem ollama-include (oder ersatzweise nach 'index index.html;') einfuegen.
        awk -v line="    $INCLUDE_LINE" '
            { print }
            !done && /include \/etc\/nginx\/snippets\/kodee-ollama\.conf;/ {
                print ""
                print "    # OpenClaw-Compliance-Agent (Apex-Pfad-Fallback)"
                print line
                done = 1
            }
        ' "$APEX_VHOST" > "${APEX_VHOST}.new"

        # Fallback: kein Ollama-include → nach 'index index.html;'
        if ! grep -qF "$INCLUDE_LINE" "${APEX_VHOST}.new"; then
            awk -v line="    $INCLUDE_LINE" '
                /index index.html;/ && !done {
                    print
                    print ""
                    print "    # OpenClaw-Compliance-Agent (Apex-Pfad-Fallback)"
                    print line
                    done = 1
                    next
                }
                { print }
            ' "$APEX_VHOST" > "${APEX_VHOST}.new"
        fi

        mv "${APEX_VHOST}.new" "$APEX_VHOST"
    fi
fi

# ─── 6. nginx-Konfig validieren + reload ────────────────────────────────────
log "nginx -t…"
nginx -t || fail "nginx -t fehlgeschlagen — siehe Output oben."
systemctl reload nginx

# ─── 7. certbot --nginx fuer die Subdomain ─────────────────────────────────
if [ "$SKIP_CERTBOT" = "1" ]; then
    warn "SKIP_CERTBOT=1 — Subdomain-vhost laeuft nur auf :80 ohne TLS."
else
    if [ -d "/etc/letsencrypt/live/${API_DOMAIN}" ]; then
        log "TLS-Cert fuer ${API_DOMAIN} bereits vorhanden, kein neuer Lauf."
    else
        log "Bitte sicherstellen: A-Record ${API_DOMAIN} → 187.77.89.1 ist live."
        log "certbot --nginx -d ${API_DOMAIN}"
        certbot --nginx \
            -d "${API_DOMAIN}" \
            --email "${CERTBOT_EMAIL}" \
            --agree-tos --redirect --non-interactive \
            || fail "certbot-Lauf fehlgeschlagen. DNS-A-Record gesetzt?"
        systemctl reload nginx
    fi
fi

# ─── 8. Smoke-Tests ─────────────────────────────────────────────────────────
log "Smoke-Test: Apex-Pfad /_openclaw/healthz"
APEX_HEALTH=$(curl -sf -o /dev/null -w '%{http_code}' "https://${APEX_DOMAIN}/_openclaw/healthz" || true)
[ "$APEX_HEALTH" = "200" ] || warn "Apex-Healthz HTTP $APEX_HEALTH (erwartet 200)"

log "Smoke-Test: Apex-Pfad /api/chat ohne Auth → 401 erwartet"
APEX_UNAUTH=$(curl -s -o /dev/null -w '%{http_code}' \
    -X POST "https://${APEX_DOMAIN}/_openclaw/api/chat" \
    -H "Content-Type: application/json" -d '{"message":"x"}' || true)
[ "$APEX_UNAUTH" = "401" ] || warn "Apex-Unauth HTTP $APEX_UNAUTH (erwartet 401)"

log "Smoke-Test: Apex-Pfad /api/chat mit Bearer"
APEX_AUTH=$(curl -sf --max-time 60 -X POST "https://${APEX_DOMAIN}/_openclaw/api/chat" \
    -H "Authorization: Bearer ${OPENCLAW_SECRET}" \
    -H "Content-Type: application/json" \
    -d '{"message":"sag nur ok"}' || true)
echo "$APEX_AUTH" | grep -q '"ok":true' || warn "Apex-Chat lieferte keine ok-Antwort: $APEX_AUTH"

if [ "$SKIP_CERTBOT" != "1" ]; then
    log "Smoke-Test: Subdomain /healthz"
    SUB_HEALTH=$(curl -sf -o /dev/null -w '%{http_code}' "https://${API_DOMAIN}/healthz" || true)
    [ "$SUB_HEALTH" = "200" ] || warn "Subdomain-Healthz HTTP $SUB_HEALTH (erwartet 200)"
fi

# ─── 9. Summary ─────────────────────────────────────────────────────────────
cat <<EOF

╔══════════════════════════════════════════════════════════════════════╗
║ OPENCLAW-VPS-SETUP ABGESCHLOSSEN                                     ║
╠══════════════════════════════════════════════════════════════════════╣
║ Image:       $DOCKER_IMAGE
║ env-File:    $ENV_FILE (chmod 600)
║ systemd:     $SERVICE_DST
║ Upstream:    127.0.0.1:${PORT}
║
║ Endpoints:
║   Subdomain: https://${API_DOMAIN}/{healthz,api/chat,ws}
║   Apex-Pfad: https://${APEX_DOMAIN}/_openclaw/{healthz,api/chat,ws}
║
║ Bearer-Token (OPENCLAW_SECRET):
║   ${OPENCLAW_SECRET}
╚══════════════════════════════════════════════════════════════════════╝

Token JETZT abspeichern — er steht nur noch in ${ENV_FILE} (chmod 600).

Naechste Schritte:
  - In Supabase Edge-Function-Secrets (falls Edge-Functions OpenClaw aufrufen):
      OPENCLAW_URL    = https://${API_DOMAIN}
      OPENCLAW_SECRET = <der Token oben>
  - Browser-Frontend ruft den Agent ueber https://${API_DOMAIN} (CORS-allow)
    oder https://${APEX_DOMAIN}/_openclaw (same-origin) auf.
  - Status: systemctl status openclaw-agent
  - Logs:   journalctl -u openclaw-agent -f
  - Restart nach env-Aenderung: bash scripts/install-openclaw-vps.sh erneut.
EOF
