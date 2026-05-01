#!/usr/bin/env bash
# install-ollama-vps.sh
#
# One-time setup für die EU-lokale Ollama-Instanz auf dem Kodee-VPS.
# Idempotent: sicher mehrfach auszuführen.
#
# Was das Skript macht:
#   1. Installiert Ollama (offizielles install.sh) und pinnt es auf 127.0.0.1
#   2. Pullt das Default-Modell (qwen2.5:7b-instruct-q4_K_M, ~4.7 GB)
#   3. Generiert einen Bearer-Token (oder nutzt den übergebenen)
#   4. Schreibt den nginx-Reverse-Proxy mit Bearer-Auth nach
#      /etc/nginx/sites-available/ und enabled ihn
#   5. certbot --nginx für TLS-Cert (Let's Encrypt)
#   6. Health-Check
#
# Voraussetzungen:
#   - Ubuntu/Debian, root oder sudo
#   - DNS-A-Record für $OLLAMA_DOMAIN zeigt schon auf diesen VPS
#   - nginx + certbot bereits installiert (war bei realsyncdynamicsai.de
#     der Fall — falls nicht: apt install nginx certbot python3-certbot-nginx)
#
# Verwendung (auf dem VPS):
#   sudo OLLAMA_DOMAIN=ollama.realsyncdynamicsai.de \
#        OLLAMA_BEARER_TOKEN="$(openssl rand -hex 32)" \
#        bash install-ollama-vps.sh
#
# Token wird am Ende ausgegeben — abspeichern, ist später nur noch in
# /etc/nginx/sites-available/... lesbar.

set -euo pipefail

# ─── Config ─────────────────────────────────────────────────────────────────
OLLAMA_DOMAIN="${OLLAMA_DOMAIN:-ollama.realsyncdynamicsai.de}"
OLLAMA_MODEL="${OLLAMA_MODEL:-qwen2.5:7b-instruct-q4_K_M}"
OLLAMA_BEARER_TOKEN="${OLLAMA_BEARER_TOKEN:-$(openssl rand -hex 32)}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-admin@realsyncdynamicsai.de}"

NGINX_CONF_SRC="$(dirname "$(readlink -f "$0")")/../deploy/nginx/ollama.realsyncdynamicsai.de.conf"
NGINX_CONF_DST="/etc/nginx/sites-available/ollama.realsyncdynamicsai.de.conf"
SYSTEMD_DROPIN_DIR="/etc/systemd/system/ollama.service.d"

log() { echo "[ollama-setup] $*"; }
fail() { echo "[ollama-setup] ERROR: $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "Bitte als root oder mit sudo ausführen."

# ─── 1. Ollama installieren ─────────────────────────────────────────────────
if ! command -v ollama >/dev/null 2>&1; then
    log "Ollama wird installiert…"
    curl -fsSL https://ollama.com/install.sh | sh
else
    log "Ollama bereits installiert ($(ollama --version | head -1))."
fi

# ─── 2. Ollama auf 127.0.0.1 pinnen (nicht 0.0.0.0!) ───────────────────────
log "Setze Ollama OLLAMA_HOST=127.0.0.1:11434 via systemd-Drop-In…"
mkdir -p "$SYSTEMD_DROPIN_DIR"
cat > "$SYSTEMD_DROPIN_DIR/override.conf" <<'EOF'
[Service]
Environment="OLLAMA_HOST=127.0.0.1:11434"
# CPU-only Inferenz: nur ein paralleler Slot, sonst kollabiert die Latenz.
Environment="OLLAMA_NUM_PARALLEL=1"
# Modell 30 Min im RAM halten, bevor es entladen wird (sonst Cold-Start).
Environment="OLLAMA_KEEP_ALIVE=30m"
EOF

systemctl daemon-reload
systemctl enable ollama
systemctl restart ollama

# Warte bis es lauscht
for i in 1 2 3 4 5 6 7 8 9 10; do
    if curl -sf http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then break; fi
    sleep 1
    [ "$i" = 10 ] && fail "Ollama lauscht nicht auf 127.0.0.1:11434"
done
log "Ollama läuft auf 127.0.0.1:11434 ✓"

# ─── 3. Modell pullen ───────────────────────────────────────────────────────
if ollama list | grep -q "${OLLAMA_MODEL%:*}"; then
    log "Modell '$OLLAMA_MODEL' bereits gepullt."
else
    log "Pulle Modell '$OLLAMA_MODEL' (~4.7 GB)…"
    ollama pull "$OLLAMA_MODEL"
fi

# ─── 4. nginx vhost ─────────────────────────────────────────────────────────
[ -f "$NGINX_CONF_SRC" ] || fail "nginx-Template nicht gefunden: $NGINX_CONF_SRC"

log "Schreibe nginx-Vhost nach $NGINX_CONF_DST mit Bearer-Token…"
sed "s|__OLLAMA_BEARER_TOKEN__|$OLLAMA_BEARER_TOKEN|g" "$NGINX_CONF_SRC" \
    | sed "s|ollama.realsyncdynamicsai.de|$OLLAMA_DOMAIN|g" \
    > "$NGINX_CONF_DST"
chmod 600 "$NGINX_CONF_DST"  # Token nicht world-readable

ln -sf "$NGINX_CONF_DST" "/etc/nginx/sites-enabled/$(basename "$NGINX_CONF_DST")"

log "nginx-Konfig validieren…"
nginx -t || fail "nginx -t fehlgeschlagen, sieh Output oben"
systemctl reload nginx

# ─── 5. TLS via certbot ─────────────────────────────────────────────────────
if [ ! -f "/etc/letsencrypt/live/$OLLAMA_DOMAIN/fullchain.pem" ]; then
    log "Hole TLS-Zertifikat für $OLLAMA_DOMAIN via certbot…"
    certbot --nginx -d "$OLLAMA_DOMAIN" \
        --non-interactive --agree-tos -m "$CERTBOT_EMAIL" --redirect
else
    log "TLS-Zertifikat existiert bereits."
fi

# ─── 6. Health-Check ────────────────────────────────────────────────────────
log "Health-Check (extern, mit Bearer-Token)…"
HEALTH=$(curl -sf -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer $OLLAMA_BEARER_TOKEN" \
    "https://$OLLAMA_DOMAIN/" || true)
[ "$HEALTH" = "200" ] || fail "Health-Check fehlgeschlagen (HTTP $HEALTH)"

UNAUTH=$(curl -sf -o /dev/null -w '%{http_code}' "https://$OLLAMA_DOMAIN/" || true)
[ "$UNAUTH" = "401" ] || fail "Auth-Check fehlgeschlagen — ohne Bearer kam HTTP $UNAUTH zurück (erwartet 401)"

# ─── 7. Inference Smoke-Test ────────────────────────────────────────────────
log "Smoke-Test einer Inferenz (kann 30-60 Sek dauern)…"
SMOKE=$(curl -sf -X POST "https://$OLLAMA_DOMAIN/api/chat" \
    -H "Authorization: Bearer $OLLAMA_BEARER_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"$OLLAMA_MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Sag nur: ok\"}],\"stream\":false}" \
    || true)
echo "$SMOKE" | grep -q '"content"' || fail "Smoke-Test bekam keine content-Antwort: $SMOKE"
log "Inferenz funktioniert ✓"

# ─── 8. Setup-Summary ───────────────────────────────────────────────────────
cat <<EOF

╔══════════════════════════════════════════════════════════════════════╗
║ OLLAMA-VPS-SETUP ABGESCHLOSSEN                                       ║
╠══════════════════════════════════════════════════════════════════════╣
║ Endpoint:  https://$OLLAMA_DOMAIN
║ Modell:    $OLLAMA_MODEL
║ Bearer:    $OLLAMA_BEARER_TOKEN
╚══════════════════════════════════════════════════════════════════════╝

Setze in Supabase Edge-Function-Secrets:

  OLLAMA_URL        = https://$OLLAMA_DOMAIN
  OLLAMA_AUTH_TOKEN = $OLLAMA_BEARER_TOKEN

Token JETZT abspeichern — er steht nur in /etc/nginx/sites-available/$(basename "$NGINX_CONF_DST")
und ist sonst nicht mehr abrufbar.
EOF
