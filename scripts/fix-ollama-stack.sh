#!/usr/bin/env bash
# fix-ollama-stack.sh
#
# Repariert in einem Schwung:
#   1. .env mit den korrekten Variablen schreiben (OLLAMA_BASIC_AUTH, WEBUI_SECRET_KEY,
#      TRAEFIK_NETWORK, TRAEFIK_CERT_RESOLVER, ENABLE_SIGNUP)
#   2. Stack komplett wegwerfen + frisch hochziehen (--force-recreate),
#      damit die Container an die richtigen Docker-Netze gehängt werden
#   3. Ollama-Modell pullen falls noch nicht da
#   4. Selbsttest: 401 ohne Auth, 200 mit BasicAuth
#
# Voraussetzung: Du kennst das gleiche Klartext-Passwort, das Du als
#                'kodee:<password>' in Supabase als OLLAMA_AUTH_TOKEN gespeichert hast.
#
# Verwendung (auf dem VPS):
#   bash /root/RealSyncDynamics.AI/scripts/fix-ollama-stack.sh "DEIN-PASSWORT"

set -euo pipefail

PASS="${1:-}"
if [ -z "$PASS" ]; then
    echo "Verwendung: $0 \"<ollama-password>\""
    echo
    echo "Das ist das Plaintext-Passwort, das Du als 'kodee:<password>' in Supabase"
    echo "unter dem Secret OLLAMA_AUTH_TOKEN gespeichert hast (32 Zeichen aus 1Password)."
    exit 1
fi

cd "$(dirname "$(readlink -f "$0")")/../deploy/ollama-traefik"

# Sicherstellen dass htpasswd verfügbar
command -v htpasswd >/dev/null || apt install -y apache2-utils 2>/dev/null

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

echo "===== 1. .env (nur Schlüsselnamen, keine Werte) ====="
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
docker network inspect "$NET" --format '{{range .Containers}}{{.Name}}{{"\n"}}{{end}}' | grep -E 'kodee|traefik' || echo "(no kodee containers in $NET — problem!)"

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
echo "Erwartet:  no-auth=401, with-auth=200"
echo "Wenn no-auth=000: TLS-Cert noch nicht da, ggf. 1-2 Min warten und Tests wiederholen."
echo "Wenn with-auth=502: Container vielleicht nicht im richtigen Netz, siehe Schritt 5."
