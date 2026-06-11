# DNS / Domain Status — RealSyncDynamics.AI

**Erstellt:** 2026-05-26
**Modus:** Read-only Audit aus dem Repo. Keine DNS-Lookups, kein Panel-Zugriff. Was hier steht, ist **das, was das Repo deklariert** — die operative Wahrheit muss extern verifiziert werden (siehe Operator-Checkliste am Ende).

---

## 1. Domain-Inventar

| Domain / Subdomain | Zeigt (laut Repo) auf | SSL-Quelle | Quelle | Status |
|---|---|---|---|---|
| `realsyncdynamicsai.de` (Apex) | Traefik auf VPS `187.77.89.1` → 301 zu GitHub Pages | Let's Encrypt (Traefik) + Let's Encrypt (nginx, parallel) | `deploy/ollama-traefik/docker-compose.yml`, `deploy/nginx/realsyncdynamicsai.de.conf` | Production |
| `www.realsyncdynamicsai.de` | 301 → Apex | Let's Encrypt (nginx) | `deploy/nginx/realsyncdynamicsai.de.conf` | Production |
| `api.realsyncdynamicsai.de` | OpenClaw-Agent auf `127.0.0.1:3001` (VPS, nginx-reverse-proxy) | Let's Encrypt (nginx + certbot) | `deploy/nginx/api.realsyncdynamicsai.de.conf`, `services/openclaw-agent/README.md` | In Rollout (PR #402) |
| `chat.realsyncdynamicsai.de` | `kodee-chat` Container (Open WebUI) | Let's Encrypt (Traefik) | `deploy/ollama-traefik/docker-compose.yml` | Production |
| `ollama.realsyncdynamicsai.de` | `kodee-ollama` Container (`127.0.0.1:11434`) | Let's Encrypt (Traefik) | `deploy/ollama-traefik/docker-compose.yml` | Production, BasicAuth |
| `n8n.realsyncdynamicsai.de` | `kodee-n8n` Container (`127.0.0.1:5678`) | Let's Encrypt (Traefik) | `deploy/ollama-traefik/docker-compose.yml` | Production, n8n-Auth |
| `scanner.realsyncdynamicsai.de` | `kodee-scanner` Container (Playwright) | Let's Encrypt (Traefik) | `services/playwright-scanner/docker-compose.yml` | Production, BasicAuth |
| `vps.realsyncdynamicsai.de` | (nur erwaehnt, nicht im Repo konfiguriert) | — | `services/playwright-scanner/README.md` | Reference only |
| `realsyncdynamics-spec.github.io/RealSyncDynamics.AI/` | GitHub Pages (Fastly CDN) | GitHub-managed | `.github/workflows/deploy-pages.yml` | Frontend-Artefakt-Quelle |

---

## 2. IPs

| IP | Hostname | Quelle | Status |
|---|---|---|---|
| `187.77.89.1` | Hostinger VPS `srv1622293` — Kodee-Stack (Traefik, Ollama, Chat, n8n) + OpenClaw | `services/openclaw-agent/README.md`, `deploy/ollama-traefik/README.md`, `.github/workflows/deploy-frontend.yml` (Header-Kommentar) | **Aktive Production** |
| `72.61.89.191` | Alte Frontend-VPS | `deploy/README.md` (Zeile 6, „Target VPS"), `.github/workflows/deploy-frontend.yml` (Kommentar: „older value … obsolete") | **Veraltet — Doku-Inkonsistenz** |
| `194.163.130.123` | DNS-Beispiel in Ollama-Doku | `deploy/ollama-traefik/README.md` | **Stale Reference** |
| `185.199.108-111.153` | GitHub Pages CDN | `deploy/RUNBOOK-spa-fallback.md` | Externer Static-Block |

---

## 3. Redirects

| Quelle | Ziel | Typ | Quelle im Repo |
|---|---|---|---|
| `http://realsyncdynamicsai.de/*` | `https://realsyncdynamicsai.de/*` | 301 | `deploy/nginx/realsyncdynamicsai.de.conf:23` |
| `https://www.realsyncdynamicsai.de/*` | `https://realsyncdynamicsai.de/*` | 301 | `deploy/nginx/realsyncdynamicsai.de.conf:91` |
| `http://api.realsyncdynamicsai.de/*` | `https://api.realsyncdynamicsai.de/*` | 301 | `deploy/nginx/api.realsyncdynamicsai.de.conf` (PR #402) |
| `https://realsyncdynamicsai.de/*` (Traefik) | `https://realsyncdynamics-spec.github.io/RealSyncDynamics.AI/$path` | 301 permanent | `deploy/ollama-traefik/docker-compose.yml` (kodee-apex Middleware) |

---

## 4. Staging vs Production

Im Repo gibt es **kein deklariertes Staging-Environment**. Alle deployten Endpoints zeigen auf Production:

- Production Frontend: `realsyncdynamicsai.de` (GitHub Pages via Traefik-Redirect)
- Production Backend: `ebljyceifhnlzhjfyxup.supabase.co` (Frankfurt)
- Production Kodee-Stack: `*.realsyncdynamicsai.de` auf `187.77.89.1`
- Lokale Dev: `localhost:3000` (Vite), `supabase start`

→ Es existiert aktuell **keine Trennung**, gegen die man Deploys vorab testen koennte. Das ist ein gelistetes Risiko (siehe `deployment-chain.md` und `observability-gap-analysis.md`).

---

## 5. Widersprueche und Unklarheiten

Diese muessen extern (DNS-Lookup, Hostinger-Panel, SSH auf VPS) verifiziert werden — ich kann sie aus dem Repo allein nicht aufloesen.

### 5.1 Apex-Frontend: GitHub Pages oder VPS?

Das Repo enthaelt zwei parallele Frontend-Deploy-Pfade:

- `.github/workflows/deploy-pages.yml` → GitHub Pages (canonical, aktiv)
- `.github/workflows/deploy-frontend.yml` → rsync `dist/` zu `/var/www/realsyncdynamicsai.de/dist` auf VPS

Die `docker-compose.yml` auf dem VPS definiert keinen `kodee-frontend`-Container, aber der nginx-Vhost `deploy/nginx/realsyncdynamicsai.de.conf` setzt `root /var/www/realsyncdynamicsai.de/dist;`. Gleichzeitig hat Traefik in `kodee-apex` ein 301-Redirect zu GitHub Pages.

**Frage an den Operator:**
- Welche Komponente serviert auf `realsyncdynamicsai.de:443` heute den Apex? Traefik mit 301 oder nginx mit static files?
- Falls Traefik mit 301: `deploy-frontend.yml` und der nginx-Vhost sind toter Code und sollten in einem separaten PR entfernt werden.
- Falls nginx static: dann fehlt der `kodee-frontend`-Service in der `docker-compose.yml` — er ist auf dem VPS live, aber nicht im Repo.

**Verifikation:**
```bash
curl -sI https://realsyncdynamicsai.de/ | grep -i server
# Erwartung A: "server: GitHub.com" → Traefik-Redirect aktiv, deploy-frontend.yml ist tot
# Erwartung B: "server: nginx" → static files vom VPS, kodee-frontend fehlt im Repo
```

### 5.2 IP `72.61.89.191`

`deploy/README.md:6` bezeichnet `72.61.89.191` als "Target VPS". `.github/workflows/deploy-frontend.yml` markiert dieselbe IP im Kommentar als "obsolete". Aktuelle Production ist `187.77.89.1`. → `deploy/README.md` ist veraltet.

### 5.3 IP `194.163.130.123`

`deploy/ollama-traefik/README.md` zeigt DNS-Beispiele mit dieser IP. Sie ist in keinem aktiven Config-File referenziert. Vermutlich Copy-Paste-Rest aus einem vorherigen Setup. → Doku-Pflege, keine Auswirkung auf Production.

### 5.4 Doppelte SSL-Cert-Verwaltung

`realsyncdynamicsai.de` hat sowohl einen Let's-Encrypt-Cert via certbot-nginx (`deploy/nginx/realsyncdynamicsai.de.conf` referenziert `/etc/letsencrypt/live/...`) als auch einen Let's-Encrypt-Cert via Traefik-ACME (`deploy/ollama-traefik/docker-compose.yml`). Welcher wird tatsaechlich serviert, haengt davon ab, welcher Prozess Port 443 haelt. Auf dem VPS muss das exakt einer sein, sonst Race-Condition beim Renewal.

### 5.5 Vercel-Erwaehnungen

`docs/runtime/production-runtime.md` dokumentiert, dass `vercel.json` geloescht wurde. Es gibt aber MCP-Tools fuer Vercel im Repo — vermutlich nur fuer ehemaliges Deploy-Target. Verifizieren, ob die Vercel-Org noch zahlende Projekte hat (Stripe-Bill).

---

## 6. Operator-Checkliste — externe Verifikation

Schritte, die jemand mit DNS-Panel-Zugriff + SSH-Zugriff einmal durchgehen muss. Output an dieses Doc anhaengen, dann ist die Single-Source-of-Truth komplett.

```bash
# 6.1 DNS-Records pro Subdomain
for d in '' www. api. chat. ollama. n8n. scanner.; do
  echo "${d}realsyncdynamicsai.de: $(dig +short ${d}realsyncdynamicsai.de A)"
done

# 6.2 Wer servt den Apex?
curl -sI https://realsyncdynamicsai.de/ | grep -iE 'server|location'

# 6.3 Cert-Ablaufdatum pro Subdomain
for d in '' api. chat. ollama. n8n.; do
  echo -n "${d}realsyncdynamicsai.de: "
  echo | openssl s_client -servername ${d}realsyncdynamicsai.de \
      -connect ${d}realsyncdynamicsai.de:443 2>/dev/null \
    | openssl x509 -noout -enddate
done

# 6.4 Wer haelt Port 443 auf der VPS?
ssh deploy@187.77.89.1 'sudo lsof -iTCP:443 -sTCP:LISTEN -nP'

# 6.5 Cert-Renewal-Mechanismus aktiv?
ssh deploy@187.77.89.1 'sudo systemctl list-timers | grep -i certbot; docker logs traefik 2>&1 | grep -i acme | tail -20'
```

Erst wenn diese fuenf Outputs vorliegen, ist klar, ob `deploy-frontend.yml` lebendig oder tot ist und ob das Cert-Renewal sauber laeuft.

---

## 7. Keine Aenderungen aus dieser Analyse

Dieses Dokument ist Read-Only-Inventur. Aenderungen (Workflows entfernen, nginx-Configs aufraeumen, Doku updaten) erfolgen erst nach Operator-Verifikation und in separaten PRs.
