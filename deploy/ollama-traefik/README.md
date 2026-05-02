# Kodee Ollama-Stack (Traefik-Variante)

EU-lokale AI-Inferenz für RealSyncDynamics.AI, hinter dem bestehenden
Host-Traefik auf dem Kodee-VPS (187.77.89.1, Hostinger srv1622293).

## Architektur

```
[internet] ─TLS─→ Host-Traefik ─http─→ kodee-ollama-proxy (caddy:8080)
                                            │ (Bearer-Auth, Pfad-Whitelist)
                                            ▼
                                       kodee-ollama (ollama:11434)
                                            │
                                            ▼
                                       qwen2.5:7b-instruct-q4_K_M
                                       (~4.7 GB, persistent volume)
```

- **Caddy** terminiert die Bearer-Auth und proxiet nur `/`, `/api/chat`, `/api/tags`.
- **Ollama** läuft im internen Docker-Netz, hat **keine veröffentlichten Ports** —
  Modell-Management (`/api/pull`, `/api/delete`) ist nur über `docker exec`
  möglich, niemals von außen.
- **Host-Traefik** wird per Labels entdeckt (kein Restart der Traefik-Instanz
  nötig) und routet `https://realsyncdynamicsai.de/_kodee/ollama` an Caddy.

## Voraussetzungen

- Docker + docker-compose v2 (`docker compose version`)
- Bestehender Host-Traefik mit aktivem Docker-Provider und Let's-Encrypt-Resolver
- Docker-Netz, an dem Host-Traefik schon hängt — Name in `.env` als
  `TRAEFIK_NETWORK` setzen
- DNS für `realsyncdynamicsai.de` zeigt auf den VPS (heute auf 187.77.89.1)

## Setup (5 Min auf dem VPS)

```bash
cd /root/RealSyncDynamics.AI/deploy/ollama-traefik

# 1. Docker-Netz von Host-Traefik finden (typisch: traefik_proxy / web / proxy)
docker network ls | grep -iE 'traefik|proxy|web'

# 2. .env anlegen
cp .env.example .env
sed -i "s/^OLLAMA_AUTH_TOKEN=.*/OLLAMA_AUTH_TOKEN=$(openssl rand -hex 32)/" .env
# TRAEFIK_NETWORK=... auf den Namen aus Schritt 1 setzen, falls nicht traefik_proxy
# TRAEFIK_CERT_RESOLVER=... auf euren Resolver-Namen setzen, falls nicht letsencrypt
nano .env

# 3. Stack starten
docker compose up -d

# 4. Modell pullen (~4.7 GB, einmalig, ~5-15 Min)
docker exec -it kodee-ollama ollama pull qwen2.5:7b-instruct-q4_K_M

# 5. Selbsttest
TOKEN=$(grep '^OLLAMA_AUTH_TOKEN=' .env | cut -d= -f2)

curl -sf -o /dev/null -w 'mit-bearer: %{http_code}\n' \
  -H "Authorization: Bearer $TOKEN" \
  https://realsyncdynamicsai.de/_kodee/ollama/

curl -s -o /dev/null -w 'ohne-bearer: %{http_code}\n' \
  https://realsyncdynamicsai.de/_kodee/ollama/

# Echte Inferenz (30-60s auf 16GB CPU)
curl -sf --max-time 180 -X POST \
  https://realsyncdynamicsai.de/_kodee/ollama/api/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen2.5:7b-instruct-q4_K_M","messages":[{"role":"user","content":"Antworte mit genau einem Wort: ok"}],"stream":false}'
```

Erwartung:
- `mit-bearer: 200`
- `ohne-bearer: 401`
- Inferenz: `{"model":"qwen2.5:...","message":{"role":"assistant","content":"ok"},...}`

## Supabase Edge-Function Secrets

Sobald der Stack läuft, im Supabase-Dashboard
[Settings → Edge Functions → Secrets](https://supabase.com/dashboard/project/ebljyceifhnlzhjfyxup/settings/functions)
zwei Werte setzen:

```
OLLAMA_URL        = https://realsyncdynamicsai.de/_kodee/ollama
OLLAMA_AUTH_TOKEN = <Wert aus deploy/ollama-traefik/.env>
```

Danach kann der Endbenutzer in `/settings/ai-residency` auf "EU-lokal"
schalten, und `ai-invoke` routet automatisch über den lokalen Stack.

## Troubleshooting

**`docker network ... not found`** beim `compose up` —
Du hast den falschen `TRAEFIK_NETWORK` in der `.env`. Den richtigen Namen aus
`docker network ls` nehmen.

**`ohne-bearer` liefert 200 oder eine andere Seite, nicht 401** —
Traefik sieht den Router noch nicht. Check:
- `docker compose ps` — beide Container „Up (healthy)"?
- `docker network inspect $TRAEFIK_NETWORK` — `kodee-ollama-proxy` sollte gelistet sein
- Host-Traefik-Logs: `docker logs traefik 2>&1 | grep -i kodee`

**`mit-bearer` liefert 502** —
Caddy unreachable oder Ollama down. `docker compose logs caddy ollama` checken.

**Inferenz dauert >2 Min und timed out** —
Modell ist nicht warm. Erste Inferenz nach Start kann lang dauern; danach hält
`OLLAMA_KEEP_ALIVE=30m` das Modell im RAM.

## Stack stoppen / aufräumen

```bash
docker compose down              # Container weg, Modelle bleiben
docker compose down -v           # auch das Modell-Volume löschen (4.7 GB frei)
```
