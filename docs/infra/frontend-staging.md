# Frontend-Staging: Cloudflare-Pages-Previews

Stand: 2026-11-13. Kein neues Hosting, kein neuer Workflow.

## Festlegung

Das offizielle Frontend-Staging sind die **Preview-Deployments von Cloudflare Pages**.
Ein zweites Staging-Host (Vercel, eigener VPS, zweites Pages-Projekt) wird dafür
nicht eingeführt.

| Oberfläche | Pages-Projekt | Branch | Rolle |
|---|---|---|---|
| Apex `realsyncdynamicsai.de` und `www` | `realsync-landing` | `landing-live` | statische Landing, eigene Git-Historie |
| Vite/React-SPA | `realsyncdynamics-ai` | `main` → `realsyncdynamics-ai.pages.dev` | App |
| Staging der SPA | dasselbe Projekt | Preview je PR/Branch | `https://<branch>.realsyncdynamics-ai.pages.dev` |

`www` leitet auf den Apex (gemessen 2026-11-13: `https://www.realsyncdynamicsai.de/pricing` → `301` auf `https://realsyncdynamicsai.de/pricing`).

## Welcher Workflow das schon tut

`.github/workflows/deploy-cloudflare-pages.yml` (`Deploy to Cloudflare Pages`):

- `pull_request` baut die SPA (Lint, `npm run build:full`). Der Job
  `Deploy to Cloudflare Pages` hat `if: github.event_name != 'pull_request'`
  und lädt einen PR **nicht** auf den Production-Branch `main`.
- Sind `CLOUDFLARE_API_TOKEN` und `CLOUDFLARE_ACCOUNT_ID` nicht gesetzt und
  `CLOUDFLARE_ACTIONS_DEPLOY` nicht `true`, überspringt der Workflow den
  Upload. Ausgeliefert wird dann die **Cloudflare-Git-Integration**.
- Deren Beleg ist der Check-Run `Cloudflare Pages` (App „Cloudflare Workers
  and Pages“), nicht der gleichnamige Actions-Workflow. Herleitung:
  `docs/runbooks/deployment-kette-messen.md`.

Branch-Previews dieser Git-Integration sind der Staging-Stand der SPA.
Ein grüner Actions-Haken ohne den Check-Run `Cloudflare Pages` ist kein Deploy.

## Was ein Preview nicht ist

- Nicht die Runtime (`apps/agent-runtime`, VPS). Dafür gilt `Backend Services CI`.
- Nicht die Produktions-Landing. `realsync-landing` veröffentlicht nur
  `landing-live`. Preview-Builds sind aus (`preview_deployment_setting: none`,
  gesetzt 2026-11-13): Pushes auf `main` und andere Branches erzeugen dort
  keinen Deploy und keinen Check. Rollback: dieselbe Einstellung wieder `all`.
- Nicht Supabase. Es gibt kein zweites Frontend-Projekt für Staging.
