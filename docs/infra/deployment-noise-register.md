# Deployment-Noise-Register — RealSyncDynamics.AI

> Zweck: bekannte, **nicht-blockierende** Deployment-Signale dokumentieren, damit Bot-Rauschen
> von ungenutzten/legacy/fehlkonfigurierten Projekten nicht als P0 behandelt wird.
> Stand: 2026-06-22 (QA-Audit, PR #668).

## Klassifikation: `NON_BLOCKING_DEPLOYMENT_NOISE`

### Eintrag 1 — Vercel `real-sync-dynamics-ai` (Team `-c3f4cfdf`) / `real-sync-dynamics-ai-remu`
| Feld | Wert |
|---|---|
| **Project** | `real-sync-dynamics-ai` (realsynchost-c3f4cfdf), `real-sync-dynamics-ai-remu` |
| **Platform** | Vercel |
| **Status** | **Non-blocking** |
| **Reason** | Separates Legacy-/fehlkonfiguriertes Vercel-Projekt. Nicht Teil des aktuellen Cloudflare-Pages-Deployments. |
| **Affected path / Root Directory** | `services/realsync-runtime-core` |
| **Impact** | Keiner auf Landingpage oder Cloudflare-Deployment. Schlägt unabhängig von Code-Änderungen fehl (auch vor diesem PR). |
| **Action** | Ignorieren, bis das `runtime-core`-Deployment bewusst aktiviert wird. Dann Root-Directory/Build-Command in Vercel korrigieren oder Projekt entfernen. |

### Eintrag 2 — Vercel `real-sync-dynamics-ai` / `-9ue5` (Team `realsynchost`)
| Feld | Wert |
|---|---|
| **Project** | `real-sync-dynamics-ai`, `real-sync-dynamics-ai-9ue5` |
| **Platform** | Vercel |
| **Status** | **Non-blocking** (deployt i. d. R. „Ready", transiente Erst-Fehler bei paralleren Builds) |
| **Reason** | Mehrere parallele Vercel-Projekte am selben Repo; transiente „Error→Ready"-Übergänge bei gleichzeitigen Builds. |
| **Impact** | Keiner — Canonical-Frontend deployt erfolgreich. |
| **Action** | Redundante Vercel-Projekte konsolidieren (1 Frontend-Projekt genügt), um Rauschen zu reduzieren. |

## Triage-Regel (ab sofort, PR-Watching)

**Aufmerksamkeit erzeugen NUR:**
- echte GitHub-Actions-Fehler (`build`, `playwright`, `Forbidden CTA`, `Migration validation`, …)
- **Cloudflare-Pages**-Deployment-Fehler (das ist die produktive Pipeline)
- Build-/Typecheck-Fehler
- Playwright-Fehler
- **menschliche** Review-Kommentare
- Produktionsausfälle (z. B. Custom-Domain 5xx — siehe Reachability-Befunde unten)
- Stripe-/Auth-/Supabase-Fehler

**Alles andere** (Vercel-Legacy-/Parallel-Projekt-Bots, Cloudflare-„building…"-Updates) →
klassifizieren als **`NON_BLOCKING_DEPLOYMENT_NOISE`**, nicht beantworten, keinen Fokuswechsel auslösen.

## Verwandte (NICHT als Noise klassifizierte) Reachability-Befunde — siehe `infrastructure-tour.md`
> Diese sind **echte** Befunde, kein Rauschen:
1. **Custom-Domain `realsyncdynamicsai.de` → HTTP 500** (alle Pfade, Edge = Cloudflare). Produktions-Health-Signal.
2. **Cloudflare-Pages SPA-Deep-Links → HTTP 404** (`/pricing`, `/audit`) auf prod + preview; Root `/` = 200. Funktioniert nur via `404.html`-JS-Redirect (GitHub-Pages-Shim), nicht via sauberen `_redirects`-200-Rewrite.
