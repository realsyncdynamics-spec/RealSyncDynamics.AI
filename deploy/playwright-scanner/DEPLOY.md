# Playwright Scanner — VPS Deployment Guide

Vollständige Deploy-Anleitung für den Playwright-Microservice auf dem Hostinger VPS.
Danach: Supabase Vault Secrets setzen (Schritt 2).

---

## SCHRITT 1 — VPS: Playwright-Scanner deployen

### 1.1 SSH auf VPS

```bash
ssh root@DEINE_VPS_IP
```

### 1.2 Repo auf dem VPS holen / aktualisieren

```bash
# Falls noch nicht geklont:
cd /opt
git clone https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI.git
cd RealSyncDynamics.AI

# Falls bereits vorhanden — auf neuesten Stand bringen:
cd /opt/RealSyncDynamics.AI
git pull origin main
```

### 1.3 In das Scanner-Verzeichnis wechseln

```bash
cd /opt/RealSyncDynamics.AI/deploy/playwright-scanner
```

### 1.4 API-Key generieren (sicher, 32 Byte hex)

```bash
openssl rand -hex 32
# Beispiel-Output: a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1
# Diesen Key merken — wird in Schritt 2 (Supabase Vault) eingetragen!
```

### 1.5 BasicAuth-Hash generieren (Traefik-Schutzschicht)

```bash
# htpasswd installieren falls nötig:
apt-get install -y apache2-utils

# Hash generieren (DEIN_PASSWORT ersetzen):
htpasswd -nb realsyncdynamics DEIN_PASSWORT
# Output: realsyncdynamics:$apr1$xyz...abc
# WICHTIG: In .env wird jedes $ durch $$ ersetzt (docker-compose quirk)
```

### 1.6 .env Datei anlegen

```bash
cp .env.example .env
nano .env
```

Inhalt der .env (Werte ersetzen):

```env
SCANNER_API_KEY=<output aus openssl rand -hex 32>
TRAEFIK_BASIC_AUTH=realsyncdynamics:$$apr1$$<rest des htpasswd outputs — $ durch $$ ersetzen>
MAX_CONCURRENT=3
```

### 1.7 Traefik proxy-Netzwerk sicherstellen

```bash
# Prüfen ob proxy-Netzwerk existiert:
docker network ls | grep proxy

# Falls nicht vorhanden:
docker network create proxy
```

### 1.8 Docker-Image bauen und starten

```bash
# Im Verzeichnis /opt/RealSyncDynamics.AI/deploy/playwright-scanner:
docker compose build --no-cache
docker compose up -d

# Status prüfen:
docker compose ps
docker compose logs -f playwright-scanner
```

### 1.9 Health-Check (lokal auf VPS)

```bash
# Direkt auf Port 3001 (ohne Auth, da nur intern):
curl http://localhost:3001/health
# Erwartete Antwort: {"ok":true,"version":"2026.05.0","active_scans":0}
```

### 1.10 Health-Check über Traefik (von außen)

```bash
# Mit BasicAuth:
curl -u realsyncdynamics:DEIN_PASSWORT \
  -H "x-api-key: DEIN_SCANNER_API_KEY" \
  https://scanner.realsyncdynamicsai.de/health
# Erwartete Antwort: {"ok":true,"version":"2026.05.0","active_scans":0}
```

### 1.11 Test-Scan durchführen

```bash
curl -u realsyncdynamics:DEIN_PASSWORT \
  -H "x-api-key: DEIN_SCANNER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}' \
  https://scanner.realsyncdynamicsai.de/scan/full | jq .
```

---

## SCHRITT 2 — Supabase Vault: Secrets setzen

### 2.1 Supabase Dashboard öffnen

URL: https://supabase.com/dashboard/project/ebljyceifhnlzhjfyxup/settings/vault

### 2.2 Secrets anlegen (SQL Editor)

Im Supabase SQL Editor ausführen:

```sql
-- Playwright Scanner URL
SELECT vault.create_secret(
  'https://scanner.realsyncdynamicsai.de',
  'PLAYWRIGHT_SCANNER_URL',
  'Public URL des Playwright-Scanner-Microservice'
);

-- Playwright Scanner API Key (aus Schritt 1.4)
SELECT vault.create_secret(
  'DEIN_SCANNER_API_KEY_AUS_SCHRITT_1_4',
  'PLAYWRIGHT_SCANNER_KEY',
  'API-Key fuer den Playwright-Scanner-Microservice'
);
```

### 2.3 Verify: Secrets in Edge Functions verfügbar

```sql
-- Prüfen ob Secrets angelegt:
SELECT name, description, created_at
FROM vault.secrets
WHERE name IN ('PLAYWRIGHT_SCANNER_URL', 'PLAYWRIGHT_SCANNER_KEY');
```

### 2.4 Edge Function neu deployen (falls bereits deployed)

```bash
# In deinem lokalen Repo-Verzeichnis:
npx supabase functions deploy cookie-scan-deep --project-ref ebljyceifhnlzhjfyxup
```

---

## SCHRITT 3 — End-to-End-Test

### 3.1 cookie-scan-deep Edge Function testen

```bash
curl -X POST \
  https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/cookie-scan-deep \
  -H "Authorization: Bearer DEIN_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://realsyncdynamicsai.de","scan_depth":1}' | jq .
```

Erwartete Antwort enthält:
- `riskScore`: 0-100
- `trackers`: Array erkannter Tracker
- `preConsentTrackers`: Tracker die vor Consent gefeuert haben (Consent-Timing)
- `issues`: Liste der DSGVO-Verstösse

---

## TROUBLESHOOTING

### Docker baut nicht

```bash
# Chromium-Download-Fehler? Node-Version prüfen:
docker compose build --progress=plain 2>&1 | tail -50
```

### Traefik erkennt Container nicht

```bash
# Netzwerk prüfen:
docker network inspect proxy | grep playwright

# Container muss im proxy-Netzwerk sein:
docker compose down && docker compose up -d
```

### SSL-Zertifikat fehlt

```bash
# Traefik-Logs prüfen:
docker logs traefik 2>&1 | grep scanner
# Ggf. warten (Let's Encrypt braucht 30-60s)
```

### 429 Too Many Scans

```bash
# MAX_CONCURRENT in .env erhöhen oder warten
# Status prüfen:
curl http://localhost:3001/health | jq .active_scans
```

---

## MAINTENANCE

### Update deployen

```bash
cd /opt/RealSyncDynamics.AI
git pull origin main
cd deploy/playwright-scanner
docker compose build --no-cache
docker compose up -d
```

### Logs anzeigen

```bash
docker compose logs -f playwright-scanner
# Letzte 100 Zeilen:
docker compose logs --tail=100 playwright-scanner
```

### Ressourcen prüfen

```bash
docker stats playwright-scanner
```
