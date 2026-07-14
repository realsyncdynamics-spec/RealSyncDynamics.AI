# RealSyncDynamics.AI Frontend — Staging Deployment

Test-Deployment für `test.realsyncdynamicsai.de` (oder `staging.realsyncdynamicsai.de`).

## Automatisches Deployment

Diese Setup wird automatisch deployed von GitHub Actions bei **jedem Push zu einer Feature-Branch** (außer `main`).

```
Feature-Branch Push
  ↓
GitHub Actions triggers
  ↓
docker/realsync-web-staging/ built & deployed
  ↓
https://test.realsyncdynamicsai.de aktualisiert
```

## Manuelle Deployment (Debug/Updates)

```bash
ssh user@vps-ip
cd /home/deploy/realsync/docker/realsync-web-staging

# .env Setup (einmalig)
cp .env.example .env
nano .env  # Supabase-Keys eintragen

# Deploy
docker compose build
docker compose up -d

# Verify
docker compose ps  # Should be "Up (healthy)"
curl -I https://test.realsyncdynamicsai.de
```

## Unterschiede zu Production

| Aspekt | Staging | Production |
|--------|---------|------------|
| Domain | `test.realsyncdynamicsai.de` | `realsyncdynamicsai.de` |
| Container Name | `realsync-frontend-staging` | `realsync-frontend` |
| Stripe Keys | TEST (`pk_test_`) | LIVE (`pk_live_`) |
| Traefik Router | `realsync-frontend-staging` | `realsync-frontend` |
| Auto-Deploy | Nach jedem Push | Nur bei Merge zu `main` |

## Tipps

- **Stripe in Staging**: Verwende `pk_test_*` Keys für Kartentests ohne echte Transaktionen
- **Supabase**: Kann gleich sein wie Production oder separates Projekt
- **DNS**: Muss A-Record haben: `test.realsyncdynamicsai.de A <VPS-IP>`
- **Logs**: `docker compose logs -f frontend`

Sonst identisch zur Production-Setup — siehe `docker/realsync-web/README.md` für Details.
