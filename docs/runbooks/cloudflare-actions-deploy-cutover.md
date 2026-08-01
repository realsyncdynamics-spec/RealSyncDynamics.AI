# Runbook: Deploy-Pfad-Umstellung — Cloudflare-Git-Integration → GitHub-Actions

Stand: 2026-07-21 · Ziel: Frontend-Deploy von `realsyncdynamicsai.de` läuft
**ausschließlich** über den GitHub-Actions-`wrangler`-Deploy statt über
Cloudflares native Git-Integration.

## Warum

Heute deployt Cloudflare Pages direkt aus dem Repo über die **Git-Integration**
(kein Repo-Secret nötig). Der Workflow `deploy-cloudflare-pages.yml` enthält
zusätzlich einen `deploy`-Job (`wrangler pages deploy`), der nur läuft, wenn die
Repo-Secrets gesetzt sind — sonst wird er sauber übersprungen.

Zwei aktive Deploy-Pfade auf demselben Projekt sind unerwünscht (widersprüchliche
Builds, doppelte Build-Minuten). Diese Umstellung macht **Actions** zum
kanonischen Pfad und schaltet die Git-Integration ab.

## Reihenfolge ist kritisch

Wird die Git-Integration **vor** dem Setzen der Secrets deaktiviert, deployt
**nichts** mehr (der `deploy`-Job überspringt mangels Secrets). Darum genau
diese Reihenfolge:

### Schritt 1 — Actions-Deploy aktivieren (Repo-Secrets setzen)

Repo → **Settings → Secrets and variables → Actions → Secrets → New repository secret**:

| Secret | Wert | Scopes des API-Tokens |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare-API-Token | **Account → Cloudflare Pages: Edit** (für den reinen Deploy ausreichend) |
| `CLOUDFLARE_ACCOUNT_ID` | Account-ID (Cloudflare-Dashboard, rechte Seitenleiste) | — |

Danach den Workflow auslösen (Push auf `main` mit Frontend-Änderung **oder**
Actions → „Deploy to Cloudflare Pages" → **Run workflow**) und prüfen, dass die
Jobs **`Deploy to Cloudflare Pages`** und **`Smoke test live routes`** grün
laufen (statt „skipped"). Erst wenn der Actions-Deploy nachweislich grün ist,
weiter zu Schritt 2.

### Schritt 2 — Cloudflare-Git-Integration deaktivieren

Cloudflare-Dashboard → **Workers & Pages → `realsyncdynamics-ai` → Settings →
Builds & deployments**:

- **Git-Integration trennen / Auto-Deploys pausieren** (je nach Dashboard:
  „Disconnect" oder „Manage" → Repo entfernen). Danach baut Cloudflare nicht
  mehr selbst aus dem Repo — der einzige Deploy-Pfad ist der Actions-Job.

### Schritt 3 — Umstellung im Repo verankern (Sicherheitsnetz)

Repo → **Settings → Secrets and variables → Actions → Variables → New repository
variable**:

| Variable | Wert |
|---|---|
| `CLOUDFLARE_ACTIONS_DEPLOY` | `true` |

Damit wird ein **fehlendes** Cloudflare-Secret im Build-Job zu einem harten
Fehler (statt eines stillen Skips) — so fällt sofort auf, wenn der einzige
Deploy-Pfad nicht mehr deployen kann. Ohne diese Variable bleibt das bisherige
Verhalten (Skip mit Hinweis) erhalten.

## Verifikation

1. Beliebige Frontend-Änderung auf `main` pushen.
2. Actions → „Deploy to Cloudflare Pages": `build` → `deploy` → `smoke-test`
   alle grün.
3. Live prüfen: `curl -I https://realsyncdynamicsai.de/` → `HTTP/2 200`, und die
   Änderung ist sichtbar.
4. Im Cloudflare-Dashboard darf **kein** neuer Git-getriggerter Build mehr
   erscheinen — nur der per `wrangler` gepushte Deploy.

## Rollback

- Repo-Variable `CLOUDFLARE_ACTIONS_DEPLOY` entfernen (oder auf `false`), **und**
- Cloudflare-Git-Integration wieder verbinden (Dashboard → Settings → Builds &
  deployments → Repo verbinden).

Der Actions-`deploy`-Job überspringt dann wieder sauber, und Cloudflare deployt
wie zuvor direkt aus dem Repo.

## Referenzen

- `.github/workflows/deploy-cloudflare-pages.yml` — Build-Validierung + optionaler `deploy`-Job
- `docs/infra/hosting-consolidation-cloudflare-pages.md` — Warum Cloudflare Pages einziges Frontend-Hosting ist
- `wrangler.toml` — `pages_build_output_dir = "dist"`
