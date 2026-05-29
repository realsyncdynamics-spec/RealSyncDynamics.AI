#!/usr/bin/env bash
# scripts/ops/doctor.sh
#
# Vollständige Read-Only-Diagnose der RealSync-VPS-Infrastruktur.
# Idempotent. Keine Mutation. Sicher in jedem Lauf.
#
# Ausführung auf dem VPS:
#   bash scripts/ops/doctor.sh                 # alles
#   bash scripts/ops/doctor.sh --section A     # nur Sektion A (Ollama)
#   bash scripts/ops/doctor.sh --no-curl       # ohne externe HTTP-Checks
#
# Sektionen:
#   A  Ollama-Container-Triage   (welcher Container, welches Modell, welche Bindung)
#   B  Port 11434 Exposure       (lokal vs. öffentlich, Firewall)
#   C  Traefik-Routing           (aktive Router + Container-Labels)
#   D  Reachability              (externe HTTPS-Endpoints)
#   E  Host-Inventory            (Container-Liste, Netzwerke, Disk, Memory)
#
# Exit-Codes:
#   0  Diagnose lief durch (sagt nichts über Health der Komponenten aus)
#   2  falsche Argumente
#   3  docker nicht verfügbar — auf falschem Host ausgeführt

set -u  # set -e absichtlich NICHT — Diagnose soll alle Sektionen durchlaufen

PUBLIC_IP="${PUBLIC_IP:-187.77.89.1}"
APEX_DOMAIN="${APEX_DOMAIN:-realsyncdynamicsai.de}"
RUN_CURL=1
ONLY_SECTION=""

while [ $# -gt 0 ]; do
  case "$1" in
    --section)  ONLY_SECTION="${2:-}"; shift 2 ;;
    --no-curl)  RUN_CURL=0; shift ;;
    -h|--help)  sed -n '2,20p' "$0"; exit 0 ;;
    *)          echo "unbekanntes Argument: $1" >&2; exit 2 ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "FEHLER: docker nicht im PATH. Skript läuft auf dem VPS, nicht in der Sandbox." >&2
  exit 3
fi
if ! docker info >/dev/null 2>&1; then
  echo "FEHLER: docker-Daemon nicht erreichbar (/var/run/docker.sock fehlt oder Permission)." >&2
  echo "Hinweis: dieses Skript ist für den VPS gedacht, nicht für die Cloud-Sandbox." >&2
  exit 3
fi

want()    { [ -z "$ONLY_SECTION" ] || [ "$ONLY_SECTION" = "$1" ]; }
header()  { printf '\n──── %s ────\n' "$1"; }

printf '════════════════════════════════════════════════════════════════\n'
printf '  RealSync VPS-Diagnose · %s\n' "$(date -u +%FT%TZ)"
printf '  host: %s · ip: %s\n' "$(hostname)" "$(hostname -I 2>/dev/null | awk '{print $1}')"
printf '════════════════════════════════════════════════════════════════\n'

# ─── A · Ollama-Container-Triage ────────────────────────────────────────────
if want A; then
  header 'A · Ollama-Container-Triage'
  CANDIDATES=$(docker ps -a --format '{{.Names}}' | grep -Ei 'ollama' || true)
  if [ -z "$CANDIDATES" ]; then
    echo '(keine Container mit "ollama" im Namen)'
  else
    for c in $CANDIDATES; do
      printf '\n▸ %s\n' "$c"
      docker inspect "$c" --format '  image:    {{.Config.Image}}
  state:    {{.State.Status}}  (health: {{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}})
  ports:    {{range $p,$b := .NetworkSettings.Ports}}{{$p}}->{{range $b}}{{.HostIp}}:{{.HostPort}} {{end}}{{end}}
  networks: {{range $n,$v := .NetworkSettings.Networks}}{{$n}} {{end}}
  started:  {{.State.StartedAt}}' 2>/dev/null
      # OLLAMA_HOST aus Env extrahieren
      docker inspect "$c" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null \
        | grep -E '^OLLAMA_' | sed 's/^/  env:      /'
      # Modelle im Container
      printf '  models:\n'
      docker exec "$c" ollama list 2>/dev/null | sed 's/^/    /' | head -8 \
        || echo '    (ollama list im Container nicht ausführbar)'
    done
  fi
fi

# ─── B · Port 11434 Exposure ────────────────────────────────────────────────
if want B; then
  header 'B · Port 11434 (Ollama-API) — Exposure-Check'

  echo '· lokal hörende Sockets auf 11434:'
  ss -ltnp 2>/dev/null | awk 'NR==1 || /:11434[[:space:]]/' || echo '  (ss nicht verfügbar)'

  if [ "$RUN_CURL" = "1" ]; then
    echo
    echo "· externer Reachability-Test gegen http://$PUBLIC_IP:11434/api/tags"
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://$PUBLIC_IP:11434/api/tags" 2>/dev/null || echo "TIMEOUT")
    if [ "$code" = "200" ]; then
      echo "  ⚠⚠⚠ HTTP 200 — Port 11434 ist ÖFFENTLICH OHNE AUTH erreichbar"
      echo "       Sofort handeln: Firewall + OLLAMA_HOST=127.0.0.1"
    elif [ "$code" = "TIMEOUT" ] || [ "$code" = "000" ]; then
      echo "  ✓ extern nicht erreichbar (timeout/refused) — gut"
    else
      echo "  HTTP $code — manuell prüfen ob Auth davor sitzt"
    fi
  fi

  echo
  echo '· Firewall:'
  if command -v ufw >/dev/null 2>&1; then
    ufw status 2>/dev/null | head -10 || echo '  ufw nicht aktiv'
  fi
  if command -v iptables >/dev/null 2>&1; then
    echo '  iptables INPUT-Policy + 11434-Regeln:'
    iptables -L INPUT -n 2>/dev/null | awk '/^Chain INPUT/ || /11434/' | sed 's/^/    /'
  fi
fi

# ─── C · Traefik-Routing ────────────────────────────────────────────────────
if want C; then
  header 'C · Traefik-Routing'
  TRAEFIK=$(docker ps --format '{{.Names}}' | grep -i traefik | head -1)
  if [ -z "$TRAEFIK" ]; then
    echo '⚠ Kein Traefik-Container gefunden — Repo erwartet Traefik als Web-Proxy'
  else
    echo "· traefik-container: $TRAEFIK"
    # Versuch: Traefik-API lokal abfragen (api.insecure=true Voraussetzung)
    API_RAW=$(docker exec "$TRAEFIK" sh -c \
      'wget -qO- http://localhost:8080/api/http/routers 2>/dev/null || \
       curl -sf http://localhost:8080/api/http/routers 2>/dev/null' 2>/dev/null)
    if [ -n "$API_RAW" ]; then
      echo '· aktive Router (rule → service [status]):'
      if command -v jq >/dev/null 2>&1; then
        echo "$API_RAW" | jq -r '.[] | "  \(.rule)  →  \(.service)  [\(.status)]"' 2>/dev/null | head -40
      else
        echo "$API_RAW" | head -c 1000
        echo '  …(jq nicht installiert — Roh-JSON gekürzt)'
      fi
    else
      echo '  Traefik-API nicht erreichbar (api.insecure nicht aktiv?). Fallback: Container-Labels.'
    fi
  fi

  echo
  echo '· traefik-Labels aller laufenden Container:'
  for cid in $(docker ps -q); do
    name=$(docker inspect -f '{{.Name}}' "$cid" 2>/dev/null | tr -d '/')
    labels=$(docker inspect "$cid" --format \
      '{{range $k,$v := .Config.Labels}}{{if ge (len $k) 7}}{{if eq (slice $k 0 7) "traefik"}}{{$k}}={{$v}}|{{end}}{{end}}{{end}}' \
      2>/dev/null)
    if [ -n "$labels" ]; then
      printf '  %s:\n' "$name"
      echo "$labels" | tr '|' '\n' | sed 's/^/    /' | grep -E '\.rule=|\.entrypoints=|loadbalancer\.server\.port=' | head -8
    fi
  done
fi

# ─── D · Externe Reachability ───────────────────────────────────────────────
if want D && [ "$RUN_CURL" = "1" ]; then
  header 'D · Externe HTTPS-Reachability'
  for url in \
    "https://$APEX_DOMAIN/" \
    "https://www.$APEX_DOMAIN/" \
    "https://ollama.$APEX_DOMAIN/" \
    "https://chat.$APEX_DOMAIN/" \
    "https://n8n.$APEX_DOMAIN/" \
    "https://$APEX_DOMAIN/_kodee/ollama/"
  do
    line=$(curl -sI --max-time 6 "$url" 2>/dev/null | awk 'NR==1 {print $0; exit}')
    printf '  %-50s %s\n' "$url" "${line:-(keine Antwort)}"
  done
fi

# ─── E · Host-Inventory ─────────────────────────────────────────────────────
if want E; then
  header 'E · Host-Inventory'
  echo '· laufende Container (Top 20):'
  docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | head -21

  echo
  echo '· Netzwerke:'
  docker network ls

  echo
  echo '· Volumes (kodee/ollama/n8n/realsync):'
  docker volume ls | grep -Ei 'kodee|ollama|n8n|webui|realsync|openclaw' \
    || echo '  (keine matches)'

  echo
  echo '· Disk-Belegung:'
  df -h | awk 'NR==1 || $NF=="/" || /docker/' | head -5

  echo
  echo '· Memory:'
  free -h | head -3
fi

printf '\n──── ENDE ────\n'
