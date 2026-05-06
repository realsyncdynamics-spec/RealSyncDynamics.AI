#!/usr/bin/env bash
# fix-ollama-stack-noargs.sh
#
# Wie fix-ollama-stack.sh — aber generiert das Passwort selbst, damit Kodee
# (oder ein anderer kontextfremder Caller) keinen Input von außen entgegennehmen
# muss. Das frische Passwort wird am Skript-Ende ausgegeben; der Operator setzt
# es danach in Supabase OLLAMA_AUTH_TOKEN ein.
#
# Sicherheits-Trade-off: Das Passwort ist 24 Zeichen base64 random, landet
# stdout am Ende des Runs. Auf einer Box wo nur Du root bist, ist das OK —
# Kodee soll's einfach in der Antwort weitergeben, dann setzt Du's manuell.
#
# Verwendung (auf dem VPS):
#   bash /root/RealSyncDynamics.AI/scripts/fix-ollama-stack-noargs.sh

set -euo pipefail

cd "$(dirname "$(readlink -f "$0")")/../deploy/ollama-traefik"

command -v htpasswd >/dev/null || apt install -y apache2-utils 2>/dev/null

PASS=$(openssl rand -base64 24 | tr -d '=+/' | head -c 32)
HASH=$(htpasswd -nbB kodee "$PASS" | sed 's/\$/\$\$/g')
WEBUI_KEY=$(openssl rand -hex 32)
NET="openclaw_default"

cat > .env <<EOF
OLLAMA_BASIC_AUTH=$HASH
WEBUI_SECRET_KEY=$WEBUI_KEY
ENABLE_SIGNUP=true
TRAEFIK_NETWORK=$NET
TRAEFIK_CERT_RESOLVER=letsencrypt
EOF

echo "===== 1. .env keys ====="
grep -E '^[A-Z]' .env | cut -d= -f1

echo
echo "===== 2. docker compose down ====="
docker compose down --remove-orphans 2>&1 | tail -10

echo
echo "===== 3. docker compose up -d --force-recreate ====="
docker compose up -d --force-recreate
sleep 8

echo
echo "===== 4. docker compose ps ====="
docker compose ps

echo
echo "===== 5. network membership ($NET) ====="
docker network inspect "$NET" --format '{{range .Containers}}{{.Name}}{{"\n"}}{{end}}' | grep -E 'kodee|traefik' || echo "(keine kodee-Container im $NET — Problem!)"

echo
echo "===== 6. ollama model pull ====="
docker exec -i kodee-ollama ollama pull qwen3:4b

echo
echo "===== 7. self-tests ====="
sleep 3
printf 'no-auth:   '
curl -s -o /dev/null -w '%{http_code}\n' --max-time 15 https://ollama.realsyncdynamicsai.de/
printf 'with-auth: '
curl -s -u "kodee:$PASS" -o /dev/null -w '%{http_code}\n' --max-time 15 https://ollama.realsyncdynamicsai.de/

echo
echo "============================================"
echo "FERTIG. Setze in Supabase Edge-Function-Secret:"
echo
echo "  OLLAMA_AUTH_TOKEN = kodee:$PASS"
echo
echo "Erwartet: no-auth=401, with-auth=200"
echo "============================================"
