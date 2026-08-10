#!/usr/bin/env bash
###############################################################################
# hpanel-console-bootstrap.sh
#
# Einmal-Bootstrap fuer den Hostinger-VPS, gedacht zum EINFUEGEN IN DIE
# BROWSER-KONSOLE IM HPANEL. Die braucht kein SSH — deshalb funktioniert das
# auch dann, wenn Port 22 von aussen gesperrt ist (Stand 2026-08: genau so).
#
#   hPanel -> VPS -> Browser-Konsole -> als root einloggen -> dieses Skript
#   komplett hineinkopieren und Enter.
#
# Das Skript ist in zwei Haelften geteilt:
#
#   TEIL A — DIAGNOSE (aendert nichts)
#     Beantwortet die offenen Fragen: laeuft sshd, auf welchem Port, blockiert
#     die Firewall, ist Docker da, ist 8090 frei, laeuft openclaw-app-1.
#
#   TEIL B — EINRICHTUNG (legt Verzeichnis, Repo und .env an)
#     Nur anlegend, nichts Bestehendes wird ueberschrieben oder gestoppt.
#
# Was das Skript BEWUSST NICHT TUT:
#   - die Firewall aendern (Port 22 oeffnen ist eine Sicherheitsentscheidung —
#     der fertige Befehl wird am Ende ausgegeben, ausgefuehrt wird er nicht)
#   - openclaw-app-1 oder irgendeinen laufenden Container anfassen
#   - eine vorhandene .env ueberschreiben
#   - den Container starten, solange die .env noch Platzhalter enthaelt
###############################################################################

set -Eeuo pipefail

REPO_URL="https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI.git"
REPO_PATH="/var/www/realsyncdynamicsai-frontend"
COMPOSE_DIR="$REPO_PATH/deploy/frontend-vps-deploy-v2"
ENV_FILE="$COMPOSE_DIR/.env"
FRONTEND_PORT=8090

DOCKER_OK=no
R='\033[0;31m'; G='\033[0;32m'; Y='\033[1;33m'; B='\033[0;34m'; N='\033[0m'
TODO=()

say()  { printf '%b\n' "$*"; }
ok()   { printf '%b\n' "  ${G}✓${N} $*"; }
warn() { printf '%b\n' "  ${Y}!${N} $*"; }
bad()  { printf '%b\n' "  ${R}✗${N} $*"; }

say "${B}═══ TEIL A — DIAGNOSE ═══${N}"
say ""

# ── sshd ─────────────────────────────────────────────────────────────────────
say "${Y}SSH-Dienst${N}"
if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet ssh 2>/dev/null; then
  ok "sshd laeuft (Unit: ssh)"
elif command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet sshd 2>/dev/null; then
  ok "sshd laeuft (Unit: sshd)"
else
  bad "sshd laeuft NICHT — deshalb ist Port 22 von aussen tot"
  TODO+=("sshd starten:  systemctl enable --now ssh")
fi

# Auf welchem Port lauscht sshd wirklich?
SSH_PORTS="$(ss -ltnp 2>/dev/null | grep -i sshd | grep -oE ':[0-9]+' | tr -d ':' | sort -u | tr '\n' ' ' || true)"
if [ -n "${SSH_PORTS// /}" ]; then
  ok "sshd lauscht auf Port(s): ${SSH_PORTS}"
  case " $SSH_PORTS " in
    *" 22 "*) : ;;
    *) TODO+=("sshd laeuft NICHT auf 22 -> GitHub-Secret VPS_SSH_PORT auf ${SSH_PORTS%% *} setzen") ;;
  esac
else
  warn "kein lauschender sshd gefunden (ss lieferte nichts)"
fi

# ── Firewall ─────────────────────────────────────────────────────────────────
say ""
say "${Y}Firewall${N}"
if command -v ufw >/dev/null 2>&1; then
  UFW_STATE="$(ufw status 2>/dev/null | head -1 || true)"
  say "  ufw: ${UFW_STATE:-unbekannt}"
  if ufw status 2>/dev/null | grep -qE '^22[/ ]|^OpenSSH'; then
    ok "ufw hat eine Regel fuer 22/OpenSSH"
  elif printf '%s' "${UFW_STATE:-}" | grep -qi inactive; then
    ok "ufw inaktiv — blockiert also nichts"
  else
    bad "ufw aktiv, aber KEINE Regel fuer Port 22 gefunden"
    TODO+=("Port 22 in ufw freigeben (Befehl unten)")
  fi
else
  say "  ufw nicht installiert"
fi
if command -v iptables >/dev/null 2>&1; then
  DROPS="$(iptables -S INPUT 2>/dev/null | grep -cE 'DROP|REJECT' || true)"
  say "  iptables INPUT: ${DROPS:-0} DROP/REJECT-Regeln"
fi
say "  Hinweis: Hostinger hat zusaetzlich eine Firewall im hPanel (VPS -> Firewall)."
say "  Die ist hier NICHT sichtbar und muss dort separat geprueft werden."

# ── Docker ───────────────────────────────────────────────────────────────────
say ""
say "${Y}Docker${N}"
if command -v docker >/dev/null 2>&1; then
  ok "$(docker --version 2>/dev/null || echo 'docker vorhanden')"
  if docker compose version >/dev/null 2>&1; then
    ok "$(docker compose version 2>/dev/null | head -1)"
  else
    bad "docker compose (V2-Plugin) fehlt"
    TODO+=("Compose-Plugin installieren:  apt-get update && apt-get install -y docker-compose-plugin")
  fi
  if docker ps >/dev/null 2>&1; then
    ok "Docker-Daemon antwortet"
    DOCKER_OK=yes
  else
    bad "Docker-Daemon antwortet nicht"
    TODO+=("Docker starten:  systemctl enable --now docker")
  fi
else
  bad "Docker ist nicht installiert"
  TODO+=("Docker installieren:  curl -fsSL https://get.docker.com | sh")
fi

# ── Bestand, der unangetastet bleiben muss ───────────────────────────────────
say ""
say "${Y}Laufender Bestand${N}"
if command -v docker >/dev/null 2>&1 && docker ps >/dev/null 2>&1; then
  RUNNING="$(docker ps --format '{{.Names}} ({{.Status}})' 2>/dev/null || true)"
  if [ -n "$RUNNING" ]; then
    printf '%s\n' "$RUNNING" | sed 's/^/    /'
  else
    say "    (keine laufenden Container)"
  fi
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^openclaw-app-1$'; then
    ok "openclaw-app-1 laeuft — dieses Skript fasst ihn NICHT an"
  fi
else
  say "    (nicht pruefbar, Docker nicht verfuegbar)"
fi

# ── Zielport ─────────────────────────────────────────────────────────────────
say ""
say "${Y}Zielport ${FRONTEND_PORT}${N}"
if ss -ltn 2>/dev/null | grep -qE "[:.]${FRONTEND_PORT}\b"; then
  bad "Port ${FRONTEND_PORT} ist belegt"
  TODO+=("FRONTEND_HOST_PORT in ${ENV_FILE} auf einen freien Port aendern")
else
  ok "Port ${FRONTEND_PORT} ist frei"
fi

say ""
say "${B}═══ TEIL B — EINRICHTUNG ═══${N}"
say ""

# ── Repo ─────────────────────────────────────────────────────────────────────
mkdir -p "$REPO_PATH"
if [ -d "$REPO_PATH/.git" ]; then
  say "Repository vorhanden, hole Aktualisierungen..."
  git -C "$REPO_PATH" fetch --quiet origin main && git -C "$REPO_PATH" reset --hard --quiet origin/main
  ok "Repository auf Stand von origin/main"
else
  say "Klone Repository..."
  git clone --quiet --depth=1 "$REPO_URL" "$REPO_PATH"
  ok "Repository geklont nach $REPO_PATH"
fi

# ── .env ─────────────────────────────────────────────────────────────────────
if [ -f "$ENV_FILE" ]; then
  ok ".env existiert bereits — wird NICHT ueberschrieben"
else
  cat > "$ENV_FILE" <<'ENVEOF'
# Werte aus dem Supabase-Dashboard: Settings -> API
# Literale Werte eintragen, KEINE ${VAR}-Referenzen.
VITE_SUPABASE_URL="https://<project>.supabase.co"
VITE_SUPABASE_ANON_KEY="<anon-key>"
VITE_SENTRY_DSN=""

FRONTEND_HOST_BIND=127.0.0.1
FRONTEND_HOST_PORT=8090
FRONTEND_IMAGE_TAG=latest
COMPOSE_PROJECT_NAME=realsync
ENVEOF
  chmod 600 "$ENV_FILE"
  ok ".env angelegt (chmod 600)"
fi

# Enthaelt die .env noch Platzhalter?
ENV_READY=yes
if grep -q '<project>\|<anon-key>' "$ENV_FILE" 2>/dev/null; then
  ENV_READY=no
  TODO+=(".env mit den echten Supabase-Werten fuellen:  nano ${ENV_FILE}")
fi

# ── Build & Start, nur wenn alles bereit ist ─────────────────────────────────
say ""
if [ "$ENV_READY" = yes ] && [ "$DOCKER_OK" = yes ] && docker compose version >/dev/null 2>&1; then
  say "${Y}Baue und starte den Container (1-2 Minuten)...${N}"
  cd "$COMPOSE_DIR"
  if docker compose --env-file "$ENV_FILE" up -d --build; then
    ok "Container gestartet"
    say "  Warte auf healthy..."
    HEALTHY=no
    for _ in $(seq 1 30); do
      ST="$(docker inspect -f '{{.State.Health.Status}}' realsync-frontend 2>/dev/null || echo missing)"
      if [ "$ST" = healthy ]; then HEALTHY=yes; break; fi
      sleep 2
    done
    if [ "$HEALTHY" = yes ]; then
      ok "Container ist healthy"
      if curl -fsS "http://127.0.0.1:${FRONTEND_PORT}/healthz" >/dev/null 2>&1; then
        ok "Smoke-Test bestanden: /healthz antwortet"
      else
        bad "/healthz antwortet nicht"
      fi
    else
      bad "Container wurde nicht healthy"
      docker compose logs --tail=40 frontend || true
    fi
  else
    bad "Build fehlgeschlagen — Ausgabe oben pruefen"
  fi
else
  if [ "$ENV_READY" != yes ]; then
    warn "Build uebersprungen — .env enthaelt noch Platzhalter"
  else
    warn "Build uebersprungen — Docker ist nicht einsatzbereit (siehe Diagnose oben)"
  fi
fi

# ── Zusammenfassung ──────────────────────────────────────────────────────────
say ""
say "${B}═══ WAS JETZT NOCH ZU TUN IST ═══${N}"
say ""
if [ ${#TODO[@]} -eq 0 ]; then
  ok "Nichts. Der Server ist eingerichtet."
else
  i=1
  for t in "${TODO[@]}"; do
    say "  ${i}. ${t}"
    i=$((i + 1))
  done
fi
say ""
say "${Y}Port 22 fuer die CI-Deploys oeffnen${N} — bewusst NICHT automatisch ausgefuehrt,"
say "weil das eine Sicherheitsentscheidung ist. Wenn gewollt:"
say ""
say "    ufw allow 22/tcp && ufw reload"
say ""
say "Zusaetzlich im hPanel unter VPS -> Firewall pruefen: GitHub-Runner haben"
say "wechselnde IPs, eine Allowlist auf einzelne Adressen sperrt sie aus."
say ""
say "Danach den Deploy testen: GitHub -> Actions -> 'Deploy Frontend to"
say "Hostinger VPS' -> Run workflow. (Der Push-Trigger ist stillgelegt.)"
say ""
