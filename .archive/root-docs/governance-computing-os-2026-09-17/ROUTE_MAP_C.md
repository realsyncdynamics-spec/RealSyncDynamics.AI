# Plan C — Route Map

**Quelle:** `src/App.tsx` auf `main` (Stand Abruf 2026-09-18).  
**Nicht vollständig:** öffentliche Marketing-/SEO-Routen sind nur als Klasse erfasst.

## Gates

| Wrapper | Rolle |
| --- | --- |
| `AppGate` | Session + Tenant-Eintritt |
| `ProtectedRoute` | älteres Guard (noch auf `/app/intelligence`, `/app/risk`) |
| `GovernanceBrowserShell` | OS-Chrome |
| `RequireAal2` | Frontend-MFA; Edge observe-only (Plan A) |
| `Navigate` | Alias → Kanon |

Inkonsistenz: viele `/app/governance/*`-Routen haben Shell **ohne** AppGate. `/app/company` ebenfalls ohne AppGate. Kommentar in App.tsx (Admin, 2026-09-01): AppGate dort additiv nachgezogen — nicht überall.

## Kanonische App-Einstiege

| Pfad | View | Gate |
| --- | --- | --- |
| `/app` | → `/app/dashboard` | — |
| `/app/dashboard` | `DashboardRouter` | AppGate + Shell |
| `/app/cockpit` | `CeoCockpitView` | AppGate + Shell |
| `/app/cockpit/brief` | `CeoBriefPrintView` | AppGate |
| `/app/assistant` | `GovernanceAiWorkspace` | AppGate |
| `/app/intelligence` | `DashboardView` | AppGate + ProtectedRoute |
| `/app/mein-geschaeft` | `SmbDashboardView` | AppGate |

Aliase: `/app/home`, `/app/overview`, `/assistant`, `/dashboard`, `/governance` → App-Kanon.

## Work / Runtime

| Pfad | View |
| --- | --- |
| `/app/approvals` | `GovernanceApprovalsView` |
| `/app/workflows` | `WorkflowsView` |
| `/app/automations` | `AutomationSkillsView` |
| `/app/scheduler` | `SchedulerView` |
| `/app/terminal` | `GovernanceTerminalView` + AppGate |
| `/app/optimize` | `OptimizationView` |
| `/operations/*` | Inventory/WWS — **ohne** Shell, eigener Einstieg |

## CRM / Company / People

| Pfad | View | Hinweis |
| --- | --- | --- |
| `/app/company` | `CompanyView` | kein AppGate in Route |
| `/app/team` | `TenantAdminConsole` | RequireAal2 |
| `/app/settings/team` | dasselbe |
| `/app/admin/members` | `AdminMembersPage` | AppGate |
| `/tenant/invites` | `InvitesView` | außerhalb `/app` |

Kein `/app/crm`, `/app/contacts`, `/app/pipeline`.

## Documents / Knowledge

| Pfad | View |
| --- | --- |
| `/app/documents` | `GovernanceDocumentsView` |
| `/app/legal-rag` | `LegalRagView` + AppGate |
| `/app/datasets` | `AiActDataGovernanceView` |

## Agents / AI Systems

| Pfad | View |
| --- | --- |
| `/app/agents` | `GovernanceAgentsCenterView` |
| `/app/agents/automation\|support\|susi\|screenshot` | Spezialseiten |
| `/app/ai-systems` | `AiSystemRegistryView` |
| `/app/ai-systems/agents` | `AgentRegistryView` |
| `/kodee` | `KodeeView` + AppGate (Gateway-Aufruf) |

## Governance / Risk / Evidence

Dichte `/app/governance/*`-Familie (AI-Register, DSGVO-Directory, AI-Act, NIS2, ISO27001, ISO42001-Hub+Library+Auditors+Reports+Evidence+Gaps+Remediation+Maintenance+Control-Detail, Gaps, Frameworks, Custom Frameworks, Analytics, Calendar, Audit-Trail, Team-Collab, Gates, Start, Evidence-Integrity, Connectors, Microsoft365, Shadow, Router, …).

Weitere Kanon-Pfade: `/app/policy-packs`, `/app/risks`, `/app/risk`, `/app/risk-inventory`, `/app/dpia`, `/app/dsr`, `/app/incidents`, `/app/remediation`, `/app/evidence`, `/app/evidence-vault`, `/app/evidence/auditor` (AAL2), `/app/vvt`, `/app/vendors`, `/app/compliance`, `/app/reports`, `/app/audit`, `/app/scans`.

Legacy `/governance/*` → Navigate auf `/app/*`.

## Connectors / Admin

| Pfad | View |
| --- | --- |
| `/app/connectors` | `GovernanceConnectorsView` |
| `/app/governance/connectors` | `GovernanceConnectorRegistryView` |
| `/app/governance/integrations` | `IntegrationsView` |
| `/app/settings/integrations/telegram` | AppGate |
| `/app/settings` | `SettingsView` |
| `/app/billing` | `BillingView` + AAL2 |
| `/app/admin` … | AppGate + Shell/Pages |
| `/app/keys`, `/app/webhooks`, `/app/costs`, `/app/admin-log` | Shell |

## Public / Marketing (Klasse)

`/`, `/pricing`, `/audit`, `/docs`, `/optimizer/*`, `/demo-*`, Branchen-Landings, Tools (`/cookie-scanner`, …), `/governance-browser` als **Public-Page**, nicht App-OS.

## Route-Regeln für spätere Expansion

1. Neue OS-Module nur unter `/app/{workspace}/…`.
2. Alte URLs per `Navigate`, nicht löschen.
3. Keine zweite Registrierung desselben Pfads (App.tsx-Kommentar 2026-08-23 zu `/app/agents`).
4. Print-Views ohne Shell.
5. Vor neuer CRM-Route: Plan H + Freeze-Schritt Auth/Tenant.
