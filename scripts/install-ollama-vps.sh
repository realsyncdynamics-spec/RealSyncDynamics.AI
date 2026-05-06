#!/usr/bin/env bash
# install-ollama-vps.sh
#
# One-time setup für die EU-lokale Ollama-Instanz auf dem Kodee-VPS.
# Idempotent: sicher mehrfach auszuführen.
#
# Strategie: keine eigene Subdomain, kein eigenes TLS-Cert. Stattdessen wird
# die existierende Apex-Domain realsyncdynamicsai.de (cert + nginx schon da)
# um einen Bearer-geschützten Pfad /_kodee/ollama erweitert. Vorteil: zero DNS,
# sofort live nach nginx-Reload.
#
# Was das Skript macht:
#   1. Installiert Ollama (offizielles install.sh) und pinnt es auf 127.0.0.1
#   2. Pullt das Default-Modell (qwen3:4b, ~4.7 GB)
#   3. Generiert einen Bearer-Token (oder nutzt den übergebenen)
#   4. Schreibt /etc/nginx/snippets/kodee-ollama.conf mit eingesetztem Token
#   5. Injiziert (falls nötig) die include-Zeile in den existierenden Apex-Vhost
#   6. nginx -t + reload
#   7. Health-Check + Inference-Smoke-Test gegen den öffentlichen URL
#
# Voraussetzungen:
#   - Ubuntu/Debian, root oder sudo
#   - nginx läuft mit Apex-Vhost realsyncdynamicsai.de (war ja schon der Fall)
#   - openssl (für Token-Generierung)
#
# Verwendung (auf dem VPS, im Repo-Root):
#   sudo OLLAMA_BEARER_TOKEN="$(openssl rand -hex 32)" bash scripts/install-ollama-vps.sh
#
# Token wird am Ende ausgegeben — abspeichern, ist später nur noch in
# /etc/nginx/snippets/kodee-ollama.conf lesbar (chmod 600).

set -euo pipefail

# ─── Config ─────────────────────────────────────────────────────────────────
APEX_DOMAIN="${APEX_DOMAIN:-realsyncdynamicsai.de}"
OLLAMA_PATH="${OLLAMA_PATH:-/_kodee/ollama}"
OLLAMA_MODEL="${OLLAMA_MODEL:-qwen3:4b}"
OLLAMA_BEARER_TOKEN="${OLLAMA_BEARER_TOKEN:-$(openssl rand -hex 32)}"

REPO_ROOT="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
SNIPPET_SRC="$REPO_ROOT/deploy/nginx/snippets/kodee-ollama.conf"
SNIPPET_DST="/etc/nginx/snippets/kodee-ollama.conf"
APEX_VHOST="/etc/nginx/sites-available/${APEX_DOMAIN}.conf"
INCLUDE_LINE="include /etc/nginx/snippets/kodee-ollama.conf;"

SYSTEMD_DROPIN_DIR="/etc/systemd/system/ollama.service.d"

log() { echo "[ollama-setup] $*"; }
fail() { echo "[ollama-setup] ERROR: $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "Bitte als root oder mit sudo ausführen."
[ -f "$SNIPPET_SRC" ] || fail "Snippet-Template nicht gefunden: $SNIPPET_SRC (im Repo-Root ausführen)"
[ -f "$APEX_VHOST" ]  || fail "Apex-Vhost nicht gefunden: $APEX_VHOST"

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

# ─── 4. nginx-Snippet schreiben (mit Bearer eingesetzt) ─────────────────────
log "Schreibe nginx-Snippet nach $SNIPPET_DST…"
mkdir -p "$(dirname "$SNIPPET_DST")"
sed "s|__OLLAMA_BEARER_TOKEN__|$OLLAMA_BEARER_TOKEN|g" "$SNIPPET_SRC" > "$SNIPPET_DST"
chmod 600 "$SNIPPET_DST"     # Token nicht world-readable

# ─── 5. include-Zeile in Apex-Vhost injizieren (falls fehlt) ────────────────
if grep -qF "$INCLUDE_LINE" "$APEX_VHOST"; then
    log "include-Zeile bereits im Apex-Vhost vorhanden."
else
    log "Injiziere include-Zeile in $APEX_VHOST…"
    # Backup
    cp "$APEX_VHOST" "${APEX_VHOST}.bak-$(date +%s)"
    # Direkt nach 'index index.html;' im 443-Block einfügen.
    # awk weil sed kein zuverlässiges 'after first match' bei Multi-Line hat.
    awk -v line="    $INCLUDE_LINE" '
        /index index.html;/ && !done { print; print ""; print "    # Kodee Ollama-Proxy"; print line; done=1; next }
        { print }
    ' "$APEX_VHOST" > "${APEX_VHOST}.new"
    mv "${APEX_VHOST}.new" "$APEX_VHOST"
fi

log "nginx-Konfig validieren…"
nginx -t || fail "nginx -t fehlgeschlagen"
systemctl reload nginx

# ─── 6. Health-Check (extern, mit Bearer) ───────────────────────────────────
ENDPOINT_BASE="https://${APEX_DOMAIN}${OLLAMA_PATH}"
log "Health-Check $ENDPOINT_BASE/ mit Bearer…"
HEALTH=$(curl -sf -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer $OLLAMA_BEARER_TOKEN" \
    "$ENDPOINT_BASE/" || true)
[ "$HEALTH" = "200" ] || fail "Health-Check fehlgeschlagen (HTTP $HEALTH)"

UNAUTH=$(curl -s -o /dev/null -w '%{http_code}' "$ENDPOINT_BASE/" || true)
[ "$UNAUTH" = "401" ] || fail "Auth-Check fehlgeschlagen — ohne Bearer kam HTTP $UNAUTH zurück (erwartet 401)"

# ─── 7. Inference Smoke-Test ────────────────────────────────────────────────
log "Smoke-Test einer Inferenz (kann 30-60 Sek dauern)…"
SMOKE=$(curl -sf --max-time 180 -X POST "$ENDPOINT_BASE/api/chat" \
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
║ Endpoint:  $ENDPOINT_BASE
║ Modell:    $OLLAMA_MODEL
║ Bearer:    $OLLAMA_BEARER_TOKEN
╚══════════════════════════════════════════════════════════════════════╝

Setze in Supabase Edge-Function-Secrets:

  OLLAMA_URL        = $ENDPOINT_BASE
  OLLAMA_AUTH_TOKEN = $OLLAMA_BEARER_TOKEN

Token JETZT abspeichern — er steht nur noch in $SNIPPET_DST (chmod 600)
und ist sonst nicht mehr abrufbar.
EOF
