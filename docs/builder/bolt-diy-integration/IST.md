# IST-Zustand — RealSync Web App Builder (main @ 066a155, 2026-10-29)

## Wichtigster Befund
Die bolt.diy-Integration existiert bereits auf `main` (PR #1429 gemerged, Folge-PR #1822). Sie liegt als **additiver Adapter** in
`src/features/app-builder/` (~1.900 LOC in `bolt/`). Es wird also KEINE zweite Engine gebraucht – Ausbau statt Neubau.

## Wo der Builder lebt
| Ebene | Pfad |
|---|---|
| Einstieg (Studio) | `/build` → `src/features/build-studio/` (`entry.ts`, `legacyBuilderRedirect.tsx`); `/builder`, `/app/bauen` → Redirect |
| Visueller Editor (Puck/SiteOS) | `/builder/:slug` → `src/features/siteos/workspace/AppBuilderWorkspacePage.tsx` |
| Code-Workbench (bolt.diy) | `/builder/:slug/code` → `src/features/app-builder/BoltCodeBuilderPage.tsx`, `BoltWorkbench.tsx` |
| bolt-Protokoll/Mechanik | `src/features/app-builder/bolt/` (message-parser, action-runner, file-store, preview, error-recovery, diagnostics, context-pack, system-prompt, engine) |
| LLM-Zugang | `src/features/app-builder/gateway.ts` → `src/core/ai-gateway/gateway.ts` → Edge Fn `supabase/functions/ai-gateway` (`op: stream`, keine Browser-Keys) |
| Persistenz | `src/features/app-builder/persist/` → Edge Fn `supabase/functions/siteos/handlers/code-persist.ts` → Tabelle `app_builder_projects` (Migration `supabase/migrations/20260917000000_app_builder_projects.sql`, Status: REVIEW ONLY) |
| SiteOS-Kern | `packages/siteos-core/` (blueprint, pipeline, rebuild); `/app/siteos*` Routen in `src/App.tsx` |
| Python-Orchestrator | `platform/builder_orchestrator/` (FastAPI; Governance-Registrierung, Task-Graph, Budget, audit_log) + `platform/nextjs_frontend/app/builder/` |
| Tests | `test/app-builder/*` (engine, route, gateway-stream, persist-isolation, production-path, runtime-capability, slug) |
| Lizenz | `docs/builder/BOLT_DIY_LICENSE.txt` (MIT), `src/features/app-builder/bolt/VENDOR.md` |

## MUST-KEEP (RealSync-spezifisch, nicht durch bolt.diy ersetzen)
- **Auth**: `src/features/supabase/SupabaseAuthContext.tsx`, `src/core/access/{Gate,RequireAal2,aal2-policy,mfa}.tsx/ts`, `AppGate` in `src/App.tsx`; Orchestrator `platform/builder_orchestrator/app/auth.py`.
- **Tenant**: `src/core/access/TenantProvider.tsx`, `src/lib/useCurrentTenant.ts`; RLS-Migrationen `20260430160000_rename_organizations_to_tenants.sql`, `20260430180000_tenant_rls_and_webhook_events.sql`; Edge Fns `provision-tenant`, `tenant-*`. Regel: `tenant_id` nie aus URL.
- **Entitlements**: `src/core/billing/useEntitlements`, `src/features/siteos/builderEntitlements.ts` (`canOpenAppBuilder`, Feature `siteos.builder`), `src/core/access/RouteEntitlementGate.tsx`.
- **Governance**: `src/features/app-builder/bolt/governance-gate.ts` (fail-closed, EU-AI-Act-Risikoklassen), `bolt/path-guard.ts` (Secret-Leak, Prod-Shell-Block), `bolt/runtime-capability.ts`; Backend `supabase/functions/governance-*` (approvals, decide, router, risk-score …); `src/lib/governance/`.
- **Audit**: AuditRecord im Gate → `app_builder_projects.audit` (append-only); Edge Fns `api-audit`, `tenant-audit`, `export-audit`; Orchestrator `app/services/audit_log.py`.
- **Evidence**: `bolt/hash.ts` + Merkle (`FileStore.snapshot`, `merkle`/`prev_hash`), `supabase/functions/_shared/merkle.ts`; Edge Fns `evidence-vault`, `evidence-anchor`, `evidence-export`, `governance-evidence-handler`; Typen `src/types/governance/evidence.ts`.
- **Weitere**: Puck-Editor unter `/builder/:slug`, CSP (`test/security/spa-csp.test.ts`, PR #1433), Build-Studio-Flow (Idee→Bau→Vorschau→Konto→Übernahme).

## Bewusst NICHT aktiv (Infra-Freigabe nötig)
WebContainer, COOP/COEP-Header, wrangler/KV, Migration-Apply, Deploy von `siteos`/`ai-gateway`. Preview = sandboxed `srcDoc` (HTML/CSS/lokales JS). Sandpack-React-Preview (PR #1823) wurde geschlossen.
