# AP11 — Aufräumen: Messung, erster Schnitt, offene Entscheidungen

**Stand 2026-09-04.** Gemessen am Import-Graphen von `src` (statische und
dynamische Imports, `export … from`, `require`, Alias `@/`), auf `main`
`6c8e98c`; Gegenprobe gegen `test/`, `tests/`, `e2e/`, `scripts/` per
String-Suche. Der Plan (`implementierungsplan-paketmodell.md` AP11) nannte
„sieben Dashboards ohne Route, 20 doppelte Komponenten-Dateinamen, ein
veralteter Kommentar". Gemessen: **60 verwaiste `.tsx`-Dateien**, **25
doppelte Basenamen**, der Kommentar.

Freigabe des Eigentümers: „go" auf die drei Fragen vom 2026-09-02 (CLAUDE.md
§10, Eintrag 2026-09-04).

## 1. Entfernt (52 Dateien)

**1a — Duplikate, deren gerouteter Zwilling existiert (6)**

| entfernt | genutzter Zwilling |
|---|---|
| `features/governance/CustomFrameworkBuilder.tsx` | `features/governance/frameworks/CustomFrameworkBuilder.tsx` |
| `features/governance/EvidenceVaultView.tsx` | `features/governance/evidence/EvidenceVaultView.tsx` |
| `features/governance/RiskCenterView.tsx` | `features/governance/risks/RiskCenterView.tsx` |
| `features/governance/WebhooksView.tsx` | `features/governance/webhooks/WebhooksView.tsx` |
| `features/site/SiteOsDashboardView.tsx` | `features/siteos/SiteOsDashboardView.tsx` |
| `enterprise-os/pages/PricingPage.tsx` | `features/billing/PricingPage.tsx` |

**1b — abgelöst durch einen gerouteten Nachfolger (5)**

| entfernt | Nachfolger |
|---|---|
| `features/api/ApiKeysView.tsx` | `features/governance/GovernanceApiKeysView.tsx` (`/app/governance/api-keys`) |
| `features/governance/dashboard/FreeTierDashboard.tsx` | `GovernanceAiWorkspace` über `DashboardRouter` (`/app/dashboard`) |
| `components/pricing/CheckoutPlanPage.tsx` | `CheckoutPage` (`/checkout/:plan`) |
| `features/api/WebhookConfiguration.tsx`, `features/integrations/WebhookConfigView.tsx` | `features/governance/webhooks/WebhooksView.tsx` (`/app/webhooks`) |

**1c — Mock-, Stub- und Hüllen-Views (20)**: `features/governance/ReportBuilderView.tsx`
(gerouteter Report Builder ist `reporting/AdvancedReportingView`),
`features/governance/collaboration/TeamManagementView.tsx`,
`features/bulk/AdvancedBulkScannerView.tsx`, `enterprise-os/components/EvidenceVault.tsx`,
`components/AssistentQuickChatModal.tsx`, `features/demo/DemoAuthContext.tsx`,
`features/assets/AssetsView.tsx`, `features/agents/AgentsOverviewPage.tsx`,
`features/governance/analytics/ComplianceTrendsDashboard.tsx`,
`components/DemoDashboard.tsx`, `components/governance-os/GovernanceAssistantPanel.tsx`,
`components/governance-os/ModuleUpgradeGate.tsx`, `components/governance/GovernanceTierGate.tsx`,
`features/governance/navigation/AdaptiveGovernanceNav.tsx`,
`components/evidence/EvidenceExport.tsx`, `components/provenance/EvidenceSnapshotCard.tsx`,
`features/seo-marketing-dashboard/index.tsx` (Barrel), und die drei Sechszeiler
`pages/WebsiteBuilderWowFlow.tsx`, `unified-entry/WowPreviewRoute.tsx`,
`unified-entry/pages/WebsitePreviewRoute.tsx`.

**1d — ungenutzte Landing-Bausteine (21)**: alle 15 Dateien in
`components/sections/`, `components/governance-frontend/{GlobeVisual,GovernanceHero,SpaceBackdrop}.tsx`,
`components/motion/{FadeIn,ScrollReveal}.tsx`, `components/pricing/unified/UnifiedPricingGrid.tsx`.
Die eingefrorene Startseite (`339b08e7`) rendert keinen davon — am Design
ändert sich nichts.

**Kommentar**: `src/App.tsx` behauptete, `DashboardRouter` zeige
`FreeTierDashboard` oder `CeoCockpitView`; er rendert `GovernanceAiWorkspace`.
Korrigiert.

## 2. Bewusst stehengelassen

| Datei | Warum |
|---|---|
| `components/landing/FrankfurtSkyline.tsx` | wird nirgends gerendert, aber `test/landing/frankfurt-skyline.test.ts` schützt ihre Form ausdrücklich („Die Skyline muss Frankfurt bleiben"). Ein Design-Element mit Wächter, das niemand sieht — Route oder Löschung ist eine Entscheidung, keine Aufräumfrage |
| `features/api/OAuth2ConfigView.tsx` | Mock-View ohne Route; `test/edge/entitlement-gates.test.ts` in PR #1196 liest die Datei. Nach dem Merge von #1196 gemeinsam mit dem Test entscheiden |
| `features/integrations/IntegrationMarketplaceView.tsx` | echtes Backend (4 Aufrufe), keine Route. Für diese View wurde am 2026-08-31 `integrations_catalog_read_access` gebaut — der Fix hat eine Fläche repariert, die kein Kunde öffnen kann |
| `features/admin/UnknownTrackersView.tsx`, `features/agents/AgentsView.tsx`, `features/api/ApiUsageStats.tsx`, `components/NewsletterForm.tsx`, `components/governance/PolicyPackAutoActivator.tsx` | echtes Backend, keine Route — Frage 2 der Liste, unbeantwortet |

## 3. Folge-Waisen (14) — zweite Runde, nicht gelöscht

Diese Dateien hatten vor dem Schnitt genau einen Importeur, und der ist jetzt
weg. Sie waren also schon vorher nicht erreichbar, nur mittelbar:

- `components/evidence/EvidenceExportDocument.tsx` (nur von `EvidenceExport` genutzt)
- `components/governance-frontend/Button.tsx` (nur von `GovernanceHero`; das genutzte `Button` liegt in `enterprise-os/components/`)
- `components/pricing/unified/UnifiedPlanCard.tsx` (nur von `UnifiedPricingGrid`)
- `core/billing/ScanActionGuard.tsx`
- `features/agents/components/AgentCard.tsx` (nur von `AgentsOverviewPage`; das genutzte `AgentCard` liegt in `features/governance/agents/`)
- `features/assets/AssetDetailModal.tsx`, `features/assets/AssetWorkflowModal.tsx`
- `features/seo-marketing-dashboard/{AdvancedFilters,CollaborationPanel,ComplianceReportPanel,ExportButton,ForecastPanel,IntegrationSettings}.tsx` — nur über das entfernte Barrel exportiert; `SEOMarketingDashboard` importiert sie nicht. `ComplianceReportPanel` ist der einzige Aufrufer von `generate-compliance-report` mit dem richtigen Body-Format; `IntegrationSettings` wird von `test/security/oauth-state.test.ts` gelesen
- `unified-entry/pages/WowPreviewEntryPage.tsx` (nur von den beiden Sechszeilern)

## 4. Doppelte Basenamen in Gebrauch (19 Paare)

Beide Varianten importiert, meist ein Paar aus `enterprise-os/` und
`components/ui/` bzw. `pages/`: Badge (17 : 9), Button (29 : 1), Card (29 : 15),
Modal, Navbar (11 : 1), Sidebar, Timeline (4 : 1), ScoreGauge (6 : 3),
TrendChart, AgentCard, ModuleStatusBadge, AVVTemplate, AiGovernancePage,
EvidencePage, MonitoringPage, FeatureDetailPage, OnboardingView,
OptimizerScan, EvidenceVaultAdvancedView. Das ist Konsolidierung je Paar,
kein Löschthema — eigener Schritt.

## 5. Nebenbefunde

- `e2e/phase2-week3-free-tier.spec.ts` beschreibt `FreeTierDashboard` in
  Testnamen und Erwartungen; die View wurde schon vor diesem Schnitt nicht
  mehr gerendert. Die Spezifikation ist damit Prosa über einen Zustand, den es
  nicht gibt.
- `scripts/offer-price-baseline.json` duldet `enterprise-os/mock/data.ts:324`
  mit Verweis auf die jetzt entfernte `enterprise-os/pages/PricingPage.tsx`;
  die Mock-Daten selbst bleiben und der Eintrag bleibt gültig.
- Ältere Statusdokumente (`PRICING_ARCHITECTURE.md`, `IMPLEMENTATION_SPEC.md`,
  `PHASE5_IMPLEMENTATION_SUMMARY.md`, `PHASE-5-PLAN.md`, `TEAM_ONBOARDING.md`,
  `PLATFORM_MVP_IMPLEMENTATION.md`) nennen entfernte Dateien in Prosa. Nach
  CLAUDE.md §9 sind erledigte Statusdokumente selbst Löschkandidaten.
