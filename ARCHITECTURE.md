# RealSyncDynamics.AI — Code-Architektur (Ordner & Schichten)

> **Positionierung:** EU-souveräne **Realtime-Governance- &
> Compliance-Infrastruktur**. Jedes Business-Event wird zu einem
> Governance-Event mit Evidence → Severity → Remediation.
>
> Verbindlich für Ziel/Scope/Reifegrad:
> - `docs/PROJECT_GOALS.md` — Ziel · Ist-Stand · Bedarf
> - `docs/PRODUCT_FOCUS.md` — Scope-Disziplin (Kern vs. Connector vs. Nicht-Kern)
> - `docs/runtime-status-matrix.md` — Reifegrad je Modul (gewinnt bei Widerspruch)
> - `docs/ARCHITECTURE.md` — Ziel-Architektur (Continuous-Compliance-Infrastructure)
>
> **Historisch/überholt:** Frühere Framings als „RealSync Agent OS" bzw.
> „SaaS für Creator mit C2PA-Provenienz" sind nicht mehr die Produktposition.
> C2PA/CreatorSeal ist eine separate, spätere Positionierung.

## Ordner-Architektur (Feature-Sliced Design)

Damit das Projekt mit hunderten Komponenten und Ansichten maintainable bleibt,
nutzen wir ein Domain-Driven / Feature-Sliced Design.

### Struktur
- `/src/core/`: Framework-agnostische Geschäftslogik — Governance-Runtime
  (`runtime/governanceEvents.ts`, `runtime/evidence.ts`,
  `runtime/remediation.ts`, `runtime/types.ts`), AI-Gateway, Entitlements,
  Auth-Logik.
- `/src/features/`: Die Domänen der Anwendung — alles zu einem Feature liegt
  eng beieinander (UI, Modale, lokale State-Hooks), z. B.:
  - `/features/audit/` (Scan, Findings, Score)
  - `/features/governance/`, `/features/ai-governance/` (Events, Risk, Agenten)
  - `/features/workflows/` (DPIA, DSR, Automation)
  - `/features/billing/`, `/features/settings/`, `/features/tenants/`
- `/src/components/`: Globale UI-Komponenten (Landingpage-Sections, Buttons).
- `/src/pages/`: Reines Routing/Struktur, das Features zu Ansichten
  orchestriert (z. B. `BusinessDashboard.tsx`, `RiskDashboard.tsx`).
- `/supabase/functions/`: Edge Functions (Deno) — `gdpr-audit`, `cookie-scan`,
  `ai-act-classify`, `governance-*`, `evidence-*`, `stripe-*`, `gdpr-*` u. a.
- `/supabase/migrations/`: additive, RLS-sichere DB-Migrationen.
- `/connectors/`, `/services/`, `/worker/`: Backend-Integrationen und
  Background-Jobs.
- `/deploy/`, `/infra/`: VPS-Stack (Traefik, Ollama, n8n) und Nginx-Config.
- `/extension*/`: Browser-Extensions (Konsolidierung auf eine kanonische
  Variante ist offen — siehe `docs/runtime-status-matrix.md`).

## Status

Reifegrad je Modul ist nicht hier, sondern verbindlich in
`docs/runtime-status-matrix.md` gepflegt (🟢 produktiv · 🟡 beta · 🔴 roadmap ·
⚪ vision). Externe Kommunikation richtet sich ausschließlich nach dieser
Matrix.

(Ziel-Architektur und Migrationspfad: `docs/ARCHITECTURE.md` + `docs/adr/`.)
