# Plan B — Target Architecture on Current Surfaces

**Stand:** 2026-09-18  
**Basis:** `main` `src/App.tsx` + Plan A  
**Modus:** Docs-only. Keine neuen Routen implementieren, bis dieser Plan und H abgenommen sind.

## Prinzip

Nicht 80 neue Mini-Apps. Bestehende `/app/*`-Flächen unter **eine** Navigation und **ein** Gate legen.

Shell bleibt `GovernanceBrowserShell` (TopBar + Tabs + Canvas + AssistantPanel + StatusBar).  
Gate bleibt `AppGate` + bestehendes Auth/Tenant. `RequireAal2` nur wo schon fachlich nötig (Billing, Team, Evidence-Export, Compliance-Rules).

## Soll-Nav → vorhandene Route

| Soll | Kanonische Ist-Route | Aktion |
| --- | --- | --- |
| Home / CEO Command Center | `/app/cockpit` (`CeoCockpitView`) + `/app/dashboard` (`DashboardRouter`) | Cockpit zur Home-Kanon; Dashboard als Widget-Quelle. `/app` redirected schon auf Dashboard — später auf Cockpit, nach KPI-Regel `NO DATA` |
| AI Brief / Workspace | `/app/assistant` (`GovernanceAiWorkspace`) | Behalten; Modi ASK…EXECUTE erst nach Gateway-Vereinheitlichung |
| Work / Approvals | `/app/approvals`, `/app/workflows`, `/app/automations`, `/app/scheduler` | Gruppieren unter Work, nicht verdoppeln |
| CRM | `/app/company` (`CompanyView`) + `sales-lead` Edge | Company ist Keim. Pipeline-Objekte **nicht** anlegen, bevor H und Tenant-Semantik klar sind |
| People | `/app/team`, `/app/settings/team`, `/app/admin/members` | Membership, kein Employee-Graph. Person ≠ Permission bleibt |
| Documents | `/app/documents` (`GovernanceDocumentsView`), `/app/legal-rag` | Knowledge-Ausbau erst nach ACL-Retrieval-Regel |
| Intelligence | `/app/intelligence`, `/app/analytics`, `/app/seo-marketing-dashboard` | Unter Intelligence sammeln |
| Agents | `/app/agents`, `/app/ai-systems`, `/app/ai-systems/agents` | Ein Agent-Center, Unterrouten lassen |
| Governance | `/app/governance/*`, `/app/policy-packs`, `/app/dpia`, `/app/dsr`, `/app/risks`, `/app/incidents` | Bleibt first-class, nicht die ganze App |
| Evidence | `/app/evidence`, `/app/evidence-vault`, `/app/evidence/auditor` | Eine Evidence-Nav, Aliase behalten |
| Connectors | `/app/connectors`, `/app/governance/connectors`, `/app/governance/integrations`, `/app/governance/microsoft365` | Eine Connector-Registry; Tool-Allowlist ist Modell (F/G), nicht neue UI-Galerie |
| Administration | `/app/settings`, `/app/billing`, `/app/admin/*`, `/app/admin-log` | AppGate additiv beibehalten |
| Browser Workspace | `/governance-browser` public + Shell im App | Public Page ≠ App-Shell; nicht zweiten Browser bauen |

## Was nicht passiert

- Keine parallele `/os/*`-Routebene.
- Keine Next.js-Migration.
- Keine neuen Auth-Wrapper neben AppGate.
- `/governance/*` bleibt Redirect auf `/app/*` (bereits so in App.tsx).
- Marketing-Routen (`/`, `/pricing`, `/audit`, Branchen) bleiben außerhalb des OS.

## Konsolidierungsregeln (wenn Implementierung je freigegeben)

1. Jede neue OS-Seite: `AppGate` + `GovernanceBrowserShell`, außer Print-Views.
2. Fehlendes AppGate an bestehenden Shell-Routen ist ein **Security-Fix**, kein Feature — eigener Scope, eigener Branch.
3. Doppelte Views (zwei Evidence-Vault-Komponenten, zwei ISO-42001-Hubs) nur dokumentieren, nicht in diesem Auftrag mergen.
4. KPI im Cockpit: anbinden oder `NO DATA / NOT CONNECTED`. Offen: PRs #1420/#1421 (KPI IDOR) zuerst, nicht Cockpit-UI.

## Abhängigkeiten vor Code

H Permission-Modell (3 Rollen-Vokabulare).  
Policy-Query-Semantik (Freeze Schritt 3).  
Ein AI-Gateway-Pfad (heute zwei).
