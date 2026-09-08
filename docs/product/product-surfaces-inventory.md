# Produkt-Oberflächen — Inventar (Phase 0)

**Gemessen am 2026-09-08** auf `main` @ `9587905`:

```
find src -name '*.tsx' \( -name '*Dashboard*' -o -name '*Workspace*' \
  -o -name '*CommandCenter*' -o -name '*Shell*' \)
```

**47 Treffer.** Das ist die Zahl hinter dem Satz „der Kunde soll RealSync als
ein Produkt erleben" (§0 des Auftrags).

---

## 1. Die drei konkurrierenden Hauptflächen

Siehe `docs/product/dashboard-consolidation.md`. Kurz: `/assistant`,
`/app/dashboard`, `/app/intelligence` — alle drei auf `main`, alle drei vor
jedem offenen PR entstanden.

---

## 2. Vollständige Liste

```
src/components/PageShell.tsx
src/components/governance-os/GovernanceBrowserShell.tsx
src/components/landing/LandingShell.tsx
src/components/runtime/RuntimeShell.tsx
src/enterprise-os/layout/AppShell.tsx
src/features/admin/SuperAdminDashboard.tsx
src/features/admin/pages/AdminDashboard.tsx
src/features/ai-governance/AiGovernanceDashboard.tsx
src/features/ai-governance/RuntimeDashboard.tsx
src/features/api/AdvancedMonitoringDashboard.tsx
src/features/api/ApiMonitoringDashboard.tsx
src/features/audit/AuditDashboardView.tsx
src/features/dashboard/DashboardView.tsx
src/features/finance/FinanceDashboard.tsx
src/features/finance/FinanceShell.tsx
src/features/governance/AgentWidget/AuditCopilotShell.tsx
src/features/governance/CertificationReadinessDashboard.tsx
src/features/governance/ComplianceMonitoringDashboard.tsx
src/features/governance/GovernanceDashboardView.tsx
src/features/governance/GovernanceRuntimeDashboard.tsx
src/features/governance/analytics/DashboardAnalyticsView.tsx
src/features/governance/dashboard/DashboardRouter.tsx
src/features/governance/dashboard/GovernanceAiWorkspace.tsx
src/features/governance/dashboard/GovernanceOsDashboard.tsx
src/features/governance/terminal/TerminalSessionDashboard.tsx
src/features/operations/OperationsDashboardView.tsx
src/features/operations/OperationsShell.tsx
src/features/seo-marketing-dashboard/SEOMarketingDashboard.tsx
src/features/siteos/SiteOsDashboardView.tsx
src/features/smb/SmbDashboardView.tsx
src/features/website-operations/MaintenanceDashboard.tsx
src/features/website-operations/WebsiteOperationsDashboard.tsx
src/features/workspace/WorkspaceEmbed.tsx
src/features/workspace/WorkspaceHome.tsx
src/features/workspace/WorkspaceShell.tsx
src/pages/AiCommandCenterShowcase.tsx
src/pages/BusinessDashboard.tsx
src/pages/CreatorDashboard.tsx
src/pages/DemoGovernanceDashboard.tsx
src/pages/DemoTourDashboard.tsx
src/pages/EnterpriseAiOsDashboard.tsx
src/pages/PublicWorkspacePreview.tsx
src/pages/RiskDashboard.tsx
src/pages/optimizer/OptimizerDashboard.tsx
src/pages/seo/SeoPageShell.tsx
src/unified-entry/UnifiedEntryShell.tsx
src/unified-entry/pages/DashboardPreviewPage.tsx
```

---

## 3. Einordnung

Nicht jede dieser 47 Dateien ist ein „Dashboard" im Sinne einer konkurrierenden
Produktoberfläche. Der Suchbegriff fängt drei verschiedene Dinge:

| Klasse | Beispiele | Bewertung |
|---|---|---|
| **Konkurrierende Hauptflächen** | `CreatorDashboard`, `GovernanceAiWorkspace`, `DashboardView` | **Konsolidierung nötig** |
| **Layout-Rahmen** (`*Shell`) | `GovernanceBrowserShell`, `AppShell`, `LandingShell`, `PageShell`, `RuntimeShell`, `FinanceShell`, `OperationsShell`, `WorkspaceShell`, `UnifiedEntryShell`, `SeoPageShell` | **10 Rahmen** — für sich legitim, in der Zahl auffällig |
| **Fachflächen** | `FinanceDashboard`, `RiskDashboard`, `SEOMarketingDashboard`, `AuditDashboardView`, … | richtig so, gehören unter **eine** Shell |
| **Demo / Showcase** | `DemoTourDashboard`, `DemoGovernanceDashboard`, `AiCommandCenterShowcase`, `PublicWorkspacePreview`, `DashboardPreviewPage` | **5 Attrappen** — §14 („kein Element vortäuschen") |

**Der eigentliche Befund sind nicht die Fachflächen, sondern die zehn
Layout-Rahmen.** Eine Fachfläche pro Fachthema ist richtig; zehn verschiedene
Rahmen bedeuten, dass Navigation, Kopfzeile und Mandantenkontext zehnmal
ausgelegt wurden. Genau das erzeugt beim Kunden den Eindruck mehrerer Produkte
— nicht die Zahl der Unterseiten.

---

## 4. Attrappen und §14

CLAUDE.md §14 verlangt: „Kein Element vortäuschen, das nichts tut", und
verweist für das *Entfernen* ausdrücklich auf die Fragepflicht nach §10.

Die fünf Demo-/Showcase-Flächen sind damit **gemeldet, nicht angetastet**.
Für jede ist zu entscheiden, ob sie Vertriebsmittel (behalten), Testfläche
(nach `test/` oder hinter ein Flag) oder Rest (entfernen) ist.

`AiCommandCenterShowcase` verdient besondere Aufmerksamkeit: Der Name
überschneidet sich mit dem Command Center aus PR #1261, ohne mit ihm
zusammenzuhängen. Zwei Dinge gleichen Namens sind in einem Repo, das
Namensautorität beansprucht, ein Folgefehler in Wartezustellung.

---

## 5. Was hier **nicht** gemessen wurde

- **Kein gerendertes Bild.** Die Einordnung beruht auf Dateinamen und Imports.
  CLAUDE.md §10 (2026-09-01 (3)) hält fest, dass zwei Befunde erst im Browser
  sichtbar wurden und die Messwerte allein zur falschen Lösung geführt hätten.
- **Keine Erreichbarkeitsprüfung.** Welche der 47 Flächen tatsächlich über eine
  Route erreichbar sind, ist `UNKNOWN`. §14 („Unsichtbares sichtbar machen")
  verlangt genau diese Prüfung — sie gehört in Phase 2, zusammen mit der
  Route-Zuordnung aus `docs/architecture/route-inventory.md`.
