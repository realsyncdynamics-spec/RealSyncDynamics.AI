# Ist-Zustand — RealSync Web App Builder

**Stand:** 2026-09-16  
**Ref:** `main` `7449166d0064428d60f5708238d0b6b6f7d7c40b`  
**Snapshot-Branch:** `backup/pre-bolt-diy-2026-09-16`  
**Arbeitsbranch:** `feat/bolt-diy-builder-integration`

Kein Deploy, keine Secrets, keine Produktiv-Infra in dieser Lieferung.

## 1. Was heute existiert

| Fläche | Pfad | Rolle | Reife |
|---|---|---|---|
| SiteOS Workspace | `/builder/:slug` · `AppBuilderWorkspacePage` | Puck-Editor, Preview, Publish-Gate, Governance-Panel | Produktiv-UI, LLM-Assistent noch nicht (PR C) |
| Build Studio | `/build` | Prompt → Website-Blueprint, ohne Konto | Preview, kein Publish |
| SiteOS Core | `packages/siteos-core` | Blueprint, Analyse, Renderer, Gate | Kanonisch für Websites |
| Orchestrator | `platform/builder_orchestrator` | FastAPI Task-Graph, Agenten, fail-closed Governance | Eigene Engine, nicht bolt.diy |
| Platform-Frontend | `platform/nextjs_frontend` | Zweite Schale „AI App Builder mit Governance-Gate“ | Nicht die öffentliche SPA |
| AI Gateway | `src/core/ai-gateway` | Geloggte Modell-Calls | Nicht vom Builder genutzt |

Es gibt **keinen** bolt.diy-Import. Eine zweite Code-Gen-Engine im Orchestrator weiterzubauen wäre Doppelarbeit.

## 2. Schichten, die erhalten bleiben müssen

1. **Auth** — `SupabaseAuthContext`. Workspace prüft die Sitzung selbst (`next` bleibt). Keine Service-Role, keine Secrets im Browser.
2. **Mandant** — `TenantProvider`. `tenant_id` kommt aus der Sitzung, nie aus der URL.
3. **Entitlements** — `siteos.builder` / `siteos.publish` / `limit.sites`. Kein zweiter Preis, kein erfundenes `builderRunsPerMonth`.
4. **Governance** — Orchestrator: `register_project` fail-closed. SiteOS: Publish-Gate, Evaluations, Custody.
5. **Prüfpfad** — append-only Agent-Runs, Audit-Export, Builder-Orchestrator `/audit`.
6. **Evidence** — Vault, SHA-256 der Blueprints, Merkle künftig für den Dateibaum.
7. **SiteOS / Puck** — visueller Website-Editor. Wird **nicht** durch bolt.diy ersetzt.
8. **Vorschau-Isolation** — `SandboxedPreviewFrame` + CSP. Kein ungesandboxter iframe.

## 3. Was bolt.diy mitbringt (und was nicht)

Aus [stackblitz-labs/bolt.diy](https://github.com/stackblitz-labs/bolt.diy) (MIT):

- Artefakt-Protokoll `<boltArtifact>` / `<boltAction>`
- Streaming-Parser
- Dateiaktionen, Shell/Start/Build-Loop, Fehlerbehandlung
- Workbench: Dateibaum, Preview, Terminal
- LLM-Provider-Registry (Vercel AI SDK)

Nicht übernehmen ohne eigene Entscheidung:

- Remix-App als zweite Frontend-Schale (verstößt gegen ARCHITECTURE_CURRENT §6)
- API-Keys im Browser
- WebContainer (braucht COOP/COEP = Produktionsinfra)
- Netlify/Vercel-Deploy aus dem Chat
- Supabase-Query gegen eine Datenbank

## 4. Backstop

- Kein Push auf `main`
- Kein Cloudflare/Worker/KV, kein `wrangler`
- Keine destruktive Migration
- Policy-Worker bleibt aus (separater Freeze)
- Orchestrator-Auth-Modell nicht auf Token-Listen zurückbauen
