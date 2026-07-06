/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { NotFoundPage } from './pages/NotFoundPage';
import { SEOHead } from './components/SEOHead';
import { RequireAal2 } from './core/access/RequireAal2';
import { SupabaseAuthProvider } from './features/supabase/SupabaseAuthContext';
import { ProtectedRoute } from './features/demo/ProtectedRoute';
import { AppGate } from './features/auth/AppGate';
import { DemoLoginPage } from './pages/DemoLoginPage';
import { DemoGovernanceDashboard } from './pages/DemoGovernanceDashboard';
import { DemoLandingPage } from './pages/DemoLandingPage';
// ── Public entry: Governance-OS Workspace Preview (replaces Marketing Landing on /)
// ── Public entry: MainLanding (Unternehmenshauptseite, Earth-at-Night) auf /
import { MainLanding } from './pages/MainLanding';
// ── AetherOS Landing (3D-Konzept) — weiterhin als eigene Route verfügbar
import { AetherOSLanding } from './pages/AetherOSLanding';
// ── RealSyncDynamics Landing Page (eigene Route /realsync-landing) ──
import { RealSyncDynamicsLanding } from './marketing/landing/RealSyncDynamicsLanding';
// ── Governance-OS Workspace Preview (moved to /preview) ──
import { PublicWorkspacePreview } from './pages/PublicWorkspacePreview';
import { GovernanceBrowserPage } from './pages/GovernanceBrowserPage';
// ── Legacy marketing landing — kept for reuse / SEO sub-paths ──
import { Landing } from './pages/Landing';
import { AgenciesLanding } from './pages/AgenciesLanding';
import { AuditLanding } from './pages/AuditLanding';
import { AutomationsLanding } from './pages/AutomationsLanding';
import { AuditResultPage } from './pages/AuditResultPage';
import { DsgvoKiChecklist } from './pages/DsgvoKiChecklist';
import { AuditShare } from './pages/AuditShare';
import { AiActFaq } from './pages/AiActFaq';
import { SchremsIIErklaert } from './pages/SchremsIIErklaert';
import { BaitMaRiskGuide } from './pages/BaitMaRiskGuide';
import { NewsletterConfirm } from './pages/NewsletterConfirm';
import { CaseStudies } from './pages/CaseStudies';
import { Resources } from './pages/Resources';
import { Blog } from './pages/Blog';
import { Roadmap } from './pages/Roadmap';
import { GovernanceRuntimePage } from './pages/GovernanceRuntimePage';
import { GovernanceDocs } from './pages/GovernanceDocs';
import { RuntimePage } from './pages/RuntimePage';
import { MonitoringPage, MonitoringSurface } from './pages/MonitoringPage';
import { AgentsPage } from './pages/AgentsPage';
import { AiActPage } from './pages/AiActPage';
import { AiDsgvoBotPage } from './pages/AiDsgvoBotPage';
import { ClaudeCodeOptimizer } from './pages/ClaudeCodeOptimizer';
import { DocsRuntimePage } from './pages/DocsRuntimePage';
import { EvidencePage } from './pages/EvidencePage';
import { DigitalSovereignty } from './pages/DigitalSovereignty';
import { GovernanceScorePage } from './pages/GovernanceScorePage';
import { FixPaket } from './pages/FixPaket';
import { PreConsentTracking } from './pages/seo/PreConsentTracking';
import { GoogleAnalyticsConsent } from './pages/seo/GoogleAnalyticsConsent';
import { ContinuousCompliance } from './pages/seo/ContinuousCompliance';
import { AiActReadiness } from './pages/seo/AiActReadiness';
import { MatomoDsgvoKonfiguration } from './pages/seo/MatomoDsgvoKonfiguration';
import { CookieConsentSdk } from './pages/CookieConsentSdk';
import { AuditPro } from './pages/AuditPro';
import { DsgvoToolVergleich } from './pages/DsgvoToolVergleich';
import { ContactSales } from './pages/ContactSales';
import { EnterpriseAiOs } from './pages/EnterpriseAiOs';
import { EnterpriseAiOsFoundingAccess } from './pages/EnterpriseAiOsFoundingAccess';
import { EnterpriseAiOsDashboard } from './pages/EnterpriseAiOsDashboard';
import { AiCommandCenterShowcase } from './pages/AiCommandCenterShowcase';
import { EnterpriseAiOsDiscovery } from './pages/EnterpriseAiOsDiscovery';
import { EnterpriseLanding } from './pages/EnterpriseLanding';
import { SaaSSolution } from './pages/solutions/SaaSSolution';
import { AgenciesSolution } from './pages/solutions/AgenciesSolution';
import { GovernanceOnboarding } from './pages/GovernanceOnboarding';
import { GovernanceRecommendation } from './pages/GovernanceRecommendation';
// ── Geführter, seitenbasierter Flow (/flow/*) ──
import { FlowProvider } from './flow/FlowContext';
import { FlowStepRoute } from './flow/FlowStepRoute';
// BusinessDashboard zieht recharts → aus dem Landing-Critical-Path lazyen.
const BusinessDashboard = lazy(() => import('./pages/BusinessDashboard').then((m) => ({ default: m.BusinessDashboard })));
// CreatorDashboard ist auth-gated → lazy
const CreatorDashboard = lazy(() => import('./pages/CreatorDashboard').then((m) => ({ default: m.CreatorDashboard })));
// Compliance Tools (Free)
import { AvvGenerator } from './pages/AvvGenerator';
import { CookieScanner } from './pages/CookieScanner';
import { DokumenteBundle } from './pages/DokumenteBundle';
import { AiActWorkflows } from './pages/AiActWorkflows';
import { SaasLanding } from './pages/niche/SaasLanding';
import { AgenturenLanding } from './pages/niche/AgenturenLanding';
import { AgenturenConversionLanding } from './pages/niche/AgenturenConversionLanding';
import { PraxenLanding } from './pages/niche/PraxenLanding';
import { KanzleienLanding } from './pages/niche/KanzleienLanding';
import { ArztpraxenLanding } from './pages/niche/ArztpraxenLanding';
import { WordpressDsgvoLanding } from './pages/niche/WordpressDsgvoLanding';
import { ChatgptDsgvoLanding } from './pages/niche/ChatgptDsgvoLanding';
import { ShopifyDsgvoLanding } from './pages/niche/ShopifyDsgvoLanding';
import { VvtWizard } from './pages/VvtWizard';
import { AiActClassifier } from './pages/AiActClassifier';
import { TomGenerator } from './pages/TomGenerator';
import { MeldepflichtTimer } from './pages/MeldepflichtTimer';
import { DatenschutzGenerator } from './pages/DatenschutzGenerator';
import { DsfaWizard } from './pages/DsfaWizard';
import { BusseldRechner } from './pages/BusseldRechner';
import { ToolsHub } from './pages/ToolsHub';
// Industry + Competitor Doorways
import { HealthTechLanding } from './pages/HealthTechLanding';
import { Branchen } from './pages/Branchen';
import { IndustryDetail } from './pages/branchen/IndustryDetail';
import { LegalTechLanding } from './pages/LegalTechLanding';
import { OneTrustAlternative } from './pages/OneTrustAlternative';
import { FinTechLanding } from './pages/FinTechLanding';
import { PublicSectorLanding } from './pages/PublicSectorLanding';
import { UsercentricsAlternative } from './pages/UsercentricsAlternative';
import { DataGuardAlternative } from './pages/DataGuardAlternative';
import { BorlabsAlternative } from './pages/BorlabsAlternative';
import { CookiebotAlternative } from './pages/CookiebotAlternative';
import { ProlianceAlternative } from './pages/ProlianceAlternative';
import { InsuranceLanding } from './pages/InsuranceLanding';
import { EcommerceLanding } from './pages/EcommerceLanding';
import { About } from './pages/About';
import { Manifest } from './pages/Manifest';
import { SkillsPage } from './pages/SkillsPage';
import { Press } from './pages/Press';
import { Security } from './pages/Security';
import { Trust } from './pages/Trust';
import { PilotReadiness } from './pages/PilotReadiness';
import { ShopifyIntegrationPage } from './pages/integrations/Shopify';
import { ShopifySuccessPage } from './pages/integrations/ShopifySuccess';
import { ShopifyErrorPage } from './pages/integrations/ShopifyError';
import { TelegramIntegrationPage } from './pages/integrations/TelegramIntegration';
import { Developers } from './pages/Developers';
import { AiActGovernancePage } from './pages/content/AiActGovernancePage';
import { AgentGovernancePage } from './pages/content/AgentGovernancePage';
import { GovernanceGraphPage } from './pages/content/GovernanceGraphPage';
import { EvidenceVaultPage } from './pages/content/EvidenceVaultPage';
import { PolicyEnginePage } from './pages/content/PolicyEnginePage';
import { DeploymentGovernancePage } from './pages/content/DeploymentGovernancePage';
import { Status } from './pages/Status';
import { Faq } from './pages/Faq';
import { Changelog } from './pages/Changelog';
import { SaasAnbieterLanding } from './pages/SaasAnbieterLanding';
import { Marktanalyse } from './pages/Marktanalyse';
import { EducationLanding } from './pages/EducationLanding';
import { HrSoftwareLanding } from './pages/HrSoftwareLanding';
import { IubendaAlternative } from './pages/IubendaAlternative';
import { ApiDocs } from './pages/ApiDocs';
import { Integrations } from './pages/Integrations';
import { SteuerberaterLanding } from './pages/SteuerberaterLanding';
import { Welcome } from './pages/Welcome';
import { PartnersPage } from './pages/PartnersPage';
import { BaitCompliance } from './pages/seo/BaitCompliance';
import { MariskAudit } from './pages/seo/MariskAudit';
import { EuAiActCheck } from './pages/seo/EuAiActCheck';
import { CookieCompliance } from './pages/seo/CookieCompliance';
// Public Legal-Pages bleiben eager (SEO + small bundle)
import { PricingPage } from './features/billing/PricingPage';
import { CheckoutPage } from './features/billing/CheckoutPage';
import { CheckoutSuccessPage } from './features/billing/CheckoutSuccessPage';
import { CheckoutCancelledPage } from './features/billing/CheckoutCancelledPage';
// Pricing detail pages — new detail routes for plans/features/checkout
import { PricingDetailPageWrapper } from './pages/pricing/PricingDetailPage';
import { FeatureDetailPageWrapper } from './pages/pricing/FeatureDetailPage';
import { PrivacyPolicy } from './features/legal/PrivacyPolicy';
import { SubProcessors } from './features/legal/SubProcessors';
import { Impressum } from './features/legal/Impressum';
import { AVVTemplate } from './features/legal/AVVTemplate';
import { ComplianceMatrix } from './features/legal/ComplianceMatrix';
import { LegalMethodology } from './features/legal/LegalMethodology';
import { LegalTerms } from './features/legal/LegalTerms';
import { Widerrufsbelehrung } from './features/legal/Widerrufsbelehrung';

// Auth-gated Features → lazy. Reduzieren Initial-Bundle für public Audit-Page.
const KodeeView = lazy(() => import('./features/kodee/KodeeView').then((m) => ({ default: m.KodeeView })));
const ConnectionsView = lazy(() => import('./features/kodee/connections/ConnectionsView').then((m) => ({ default: m.ConnectionsView })));
const UsageView = lazy(() => import('./features/billing/UsageView').then((m) => ({ default: m.UsageView })));
const BillingView = lazy(() => import('./features/billing/BillingView').then((m) => ({ default: m.BillingView })));
const GovernanceAlertsView = lazy(() => import('./features/governance/AlertsView').then((m) => ({ default: m.AlertsView })));
const OptimizationView = lazy(() => import('./features/governance/OptimizationView').then((m) => ({ default: m.OptimizationView })));
const MonitoringSourcesView = lazy(() => import('./features/governance/MonitoringSourcesView').then((m) => ({ default: m.MonitoringSourcesView })));
const InvitesView = lazy(() => import('./features/tenants/InvitesView').then((m) => ({ default: m.InvitesView })));
const AcceptInviteView = lazy(() => import('./features/tenants/AcceptInviteView').then((m) => ({ default: m.AcceptInviteView })));
const GovernanceKeysView = lazy(() => import('./features/governance/KeysView').then((m) => ({ default: m.KeysView })));
const RuntimeVvtView = lazy(() => import('./features/governance/vvt/RuntimeVvtView').then((m) => ({ default: m.RuntimeVvtView })));
const AgentRegistryView = lazy(() => import('./features/governance/agents/AgentRegistryView').then((m) => ({ default: m.AgentRegistryView })));
const AiSystemRegistryView = lazy(() => import('./features/governance/ai-registry/AiSystemRegistryView').then((m) => ({ default: m.AiSystemRegistryView })));
const GovernanceAgentsCenterView = lazy(() => import('./features/governance/agents/AgentsCenterView').then((m) => ({ default: m.AgentsCenterView })));
const GovernanceDocumentsView = lazy(() => import('./features/governance/documents/DocumentsView').then((m) => ({ default: m.DocumentsView })));
const GovernanceAuditExportView = lazy(() => import('./features/governance/audit/AuditExportView').then((m) => ({ default: m.AuditExportView })));
const AutomationSkillsView = lazy(() => import('./features/automations/AutomationSkillsView').then((m) => ({ default: m.AutomationSkillsView })));
const ProvenanceView = lazy(() => import('./features/provenance/ProvenanceView').then((m) => ({ default: m.ProvenanceView })));
const BulkJobsView = lazy(() => import('./features/bulk/BulkJobsView').then((m) => ({ default: m.BulkJobsView })));
const SchedulerView = lazy(() => import('./features/scheduler/SchedulerView').then((m) => ({ default: m.SchedulerView })));
const EvidenceVaultAdvancedView = lazy(() => import('./features/evidence-vault/EvidenceVaultAdvancedView').then((m) => ({ default: m.EvidenceVaultAdvancedView })));
const PolicyPacksView = lazy(() => import('./features/policy-packs/PolicyPacksView').then((m) => ({ default: m.PolicyPacksView })));
const LegalRagView = lazy(() => import('./features/legal-rag/LegalRagView').then((m) => ({ default: m.LegalRagView })));
const AgentOsAdminPage = lazy(() => import('./features/agent-os-admin/AgentOsAdminPage').then((m) => ({ default: m.AgentOsAdminPage })));
const GovernanceDashboardView = lazy(() => import('./features/governance/GovernanceDashboardView').then((m) => ({ default: m.GovernanceDashboardView })));
const WebsiteGovernanceView = lazy(() => import('./features/governance/websites/WebsiteGovernanceView').then((m) => ({ default: m.WebsiteGovernanceView })));
const GovernanceWebhooksView = lazy(() => import('./features/governance/WebhooksView').then((m) => ({ default: m.WebhooksView })));
const GovernanceOnboardingView = lazy(() => import('./features/governance/OnboardingView').then((m) => ({ default: m.OnboardingView })));
const GovernanceMappingsView = lazy(() => import('./features/governance/MappingsView').then((m) => ({ default: m.MappingsView })));
const GovernanceEventDetailView = lazy(() => import('./features/governance/EventDetailView').then((m) => ({ default: m.EventDetailView })));
const GovernanceAssetDetailView = lazy(() => import('./features/governance/AssetDetailView').then((m) => ({ default: m.AssetDetailView })));
const GovernanceApprovalsView = lazy(() => import('./features/governance/ApprovalsView').then((m) => ({ default: m.ApprovalsView })));
const GovernanceAdminLogView = lazy(() => import('./features/governance/AdminLogView').then((m) => ({ default: m.AdminLogView })));
const GovernancePolicyTemplatesView = lazy(() => import('./features/governance/PolicyTemplatesView').then((m) => ({ default: m.PolicyTemplatesView })));
const GovernanceComplianceReportView = lazy(() => import('./features/governance/ComplianceReportView').then((m) => ({ default: m.ComplianceReportView })));
const GovernanceDpiasView = lazy(() => import('./features/governance/DpiasView').then((m) => ({ default: m.DpiasView })));
const GovernanceDsrTrackerView = lazy(() => import('./features/governance/DsrTrackerView').then((m) => ({ default: m.DsrTrackerView })));
const GovernanceIncidentsView = lazy(() => import('./features/governance/IncidentsView').then((m) => ({ default: m.IncidentsView })));
const RiskCenterView = lazy(() => import('./features/governance/risks/RiskCenterView').then((m) => ({ default: m.RiskCenterView })));
const SecuritySignalsView = lazy(() => import('./features/governance/security-signals/SecuritySignalsView').then((m) => ({ default: m.SecuritySignalsView })));
const GovernanceConnectorsView = lazy(() => import('./features/governance/ConnectorsView').then((m) => ({ default: m.ConnectorsView })));
const GovernanceVendorInventoryView = lazy(() => import('./features/governance/VendorInventoryView').then((m) => ({ default: m.VendorInventoryView })));
const GovernanceCostTrackingView = lazy(() => import('./features/governance/CostTrackingView').then((m) => ({ default: m.CostTrackingView })));
const GovernanceAuditorConsoleView = lazy(() => import('./features/governance/AuditorConsoleView').then((m) => ({ default: m.AuditorConsoleView })));
const DashboardAnalyticsView = lazy(() => import('./features/governance/analytics/DashboardAnalyticsView').then((m) => ({ default: m.DashboardAnalyticsView })));
const EvidenceVaultView = lazy(() => import('./features/governance/evidence/EvidenceVaultView').then((m) => ({ default: m.EvidenceVaultView })));
const GovernanceScansListView = lazy(() => import('./features/governance/scans/ScansListView').then((m) => ({ default: m.ScansListView })));
const GovernanceScanDetailView = lazy(() => import('./features/governance/scans/ScanDetailView').then((m) => ({ default: m.ScanDetailView })));
const AiActRiskInventoryView = lazy(() => import('./features/governance/AiActRiskInventoryView').then((m) => ({ default: m.AiActRiskInventoryView })));
const AiActDataGovernanceView = lazy(() => import('./features/governance/data-governance/AiActDataGovernanceView').then((m) => ({ default: m.AiActDataGovernanceView })));
const MonitoringRuntimeView = lazy(() => import('./features/governance/monitoring/MonitoringRuntimeView').then((m) => ({ default: m.MonitoringRuntimeView })));
const AdminSocialPreviewPage = lazy(() => import('./features/admin/social/SocialPreviewPage').then((m) => ({ default: m.AdminSocialPreviewPage })));
const RemediationPlansView      = lazy(() => import('./features/governance/remediation/RemediationPlansView').then((m) => ({ default: m.RemediationPlansView })));
const RemediationPlanDetailView = lazy(() => import('./features/governance/remediation/RemediationPlanDetailView').then((m) => ({ default: m.RemediationPlanDetailView })));
const OperationsDashboardView   = lazy(() => import('./features/operations/OperationsDashboardView').then((m) => ({ default: m.OperationsDashboardView })));
const OperationsItemsView       = lazy(() => import('./features/operations/InventoryItemsView').then((m) => ({ default: m.InventoryItemsView })));
const BotsView                  = lazy(() => import('./features/bots/BotsView').then((m) => ({ default: m.BotsView })));
const BotBuilderView            = lazy(() => import('./features/bots/BotBuilderView').then((m) => ({ default: m.BotBuilderView })));
const BotInboxView              = lazy(() => import('./features/bots/BotInboxView').then((m) => ({ default: m.BotInboxView })));
const OperationsStockMovements  = lazy(() => import('./features/operations/StockMovementsView').then((m) => ({ default: m.StockMovementsView })));
const OperationsSuppliersView   = lazy(() => import('./features/operations/SuppliersView').then((m) => ({ default: m.SuppliersView })));
const OperationsLocationsView   = lazy(() => import('./features/operations/LocationsView').then((m) => ({ default: m.LocationsView })));
const OperationsBarcodesView    = lazy(() => import('./features/operations/BarcodesView').then((m) => ({ default: m.BarcodesView })));
const OperationsReportsView     = lazy(() => import('./features/operations/OperationsReportsView').then((m) => ({ default: m.OperationsReportsView })));
// Finance / Tax Evidence Runtime — auth-gated, prepares documentation only.
const FinanceDashboard   = lazy(() => import('./features/finance/FinanceDashboard').then((m) => ({ default: m.FinanceDashboard })));
const TaxEvidenceView    = lazy(() => import('./features/finance/TaxEvidenceView').then((m) => ({ default: m.TaxEvidenceView })));
const TaxDocumentsView   = lazy(() => import('./features/finance/TaxDocumentsView').then((m) => ({ default: m.TaxDocumentsView })));
const TaxYearView        = lazy(() => import('./features/finance/TaxYearView').then((m) => ({ default: m.TaxYearView })));
const TaxExportsView     = lazy(() => import('./features/finance/TaxExportsView').then((m) => ({ default: m.TaxExportsView })));
const TaxRemindersView   = lazy(() => import('./features/finance/TaxRemindersView').then((m) => ({ default: m.TaxRemindersView })));
const TaxReviewsView     = lazy(() => import('./features/finance/TaxReviewsView').then((m) => ({ default: m.TaxReviewsView })));
const AiResidencySettings = lazy(() => import('./features/settings/AiResidencySettings').then((m) => ({ default: m.AiResidencySettings })));
const AccountSettings = lazy(() => import('./features/settings/AccountSettings').then((m) => ({ default: m.AccountSettings })));
const ApiKeysSettings = lazy(() => import('./features/settings/ApiKeysSettings').then((m) => ({ default: m.ApiKeysSettings })));
const BrandingSettings = lazy(() => import('./features/settings/BrandingSettings').then((m) => ({ default: m.BrandingSettings })));
const SettingsView = lazy(() => import('./features/settings/SettingsView').then((m) => ({ default: m.SettingsView })));
const SecuritySettings = lazy(() => import('./features/settings/SecuritySettings').then((m) => ({ default: m.SecuritySettings })));
const TenantAdminConsole = lazy(() => import('./features/tenants/TenantAdminConsole').then((m) => ({ default: m.TenantAdminConsole })));
const WorkspaceHome = lazy(() => import('./features/workspace/WorkspaceHome').then((m) => ({ default: m.WorkspaceHome })));
const GovernanceOsDashboard = lazy(() => import('./features/governance/dashboard/GovernanceOsDashboard').then((m) => ({ default: m.GovernanceOsDashboard })));
const CeoCockpitView = lazy(() => import('./features/governance/cockpit/CeoCockpitView').then((m) => ({ default: m.CeoCockpitView })));
const CeoBriefPrintView = lazy(() => import('./features/governance/cockpit/CeoBriefPrintView').then((m) => ({ default: m.CeoBriefPrintView })));
const WorkspaceEmbed = lazy(() => import('./features/workspace/WorkspaceEmbed').then((m) => ({ default: m.WorkspaceEmbed })));
const CompanyView = lazy(() => import('./features/company/CompanyView').then((m) => ({ default: m.CompanyView })));
const WorkflowsView = lazy(() => import('./features/workflows/WorkflowsView').then((m) => ({ default: m.WorkflowsView })));
const MarketGapsView = lazy(() => import('./features/market/MarketGapsView').then((m) => ({ default: m.MarketGapsView })));
const OutreachView = lazy(() => import('./features/outreach/OutreachView').then((m) => ({ default: m.OutreachView })));
const AnalyticsView = lazy(() => import('./features/analytics/AnalyticsView').then((m) => ({ default: m.AnalyticsView })));
const AuditDashboardView = lazy(() => import('./features/audit/AuditDashboardView').then((m) => ({ default: m.AuditDashboardView })));
const LeadsView = lazy(() => import('./features/admin/LeadsView').then((m) => ({ default: m.LeadsView })));
const SystemHealthView = lazy(() => import('./features/admin/SystemHealthView').then((m) => ({ default: m.SystemHealthView })));
const CustomersView = lazy(() => import('./features/admin/CustomersView').then((m) => ({ default: m.CustomersView })));
const OnboardingView = lazy(() => import('./features/admin/OnboardingView').then((m) => ({ default: m.OnboardingView })));
const RebuildsView = lazy(() => import('./features/admin/RebuildsView').then((m) => ({ default: m.RebuildsView })));
// ── Tenant Admin Panel (Phase 1) ──
const AdminDashboard = lazy(() => import('./features/admin/pages/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const AdminMembersPage = lazy(() => import('./features/admin/pages/AdminMembersPage').then((m) => ({ default: m.AdminMembersPage })));
const AdminSettingsPage = lazy(() => import('./features/admin/pages/AdminSettingsPage').then((m) => ({ default: m.AdminSettingsPage })));
const AdminBillingPage = lazy(() => import('./features/admin/pages/AdminBillingPage').then((m) => ({ default: m.AdminBillingPage })));
const AdminAPIKeysPage = lazy(() => import('./features/admin/pages/AdminAPIKeysPage').then((m) => ({ default: m.AdminAPIKeysPage })));
const AdminAuditPage = lazy(() => import('./features/admin/pages/AdminAuditPage').then((m) => ({ default: m.AdminAuditPage })));
// ── Platform Super-Admin (Phase 2) ──
const SuperAdminDashboard = lazy(() => import('./features/admin/SuperAdminDashboard').then((m) => ({ default: m.SuperAdminDashboard })));
// ── Enterprise OS Prototype (/os, /os/app/*) — Phase 1 Foundation:
// neues Designsystem + Enterprise-Shell, Mockdaten, kein Backend-Zugriff. ──
const EnterpriseLandingPage = lazy(() => import('./enterprise-os/pages/LandingPage').then((m) => ({ default: m.LandingPage })));
const EnterpriseAppShell = lazy(() => import('./enterprise-os/layout/AppShell').then((m) => ({ default: m.AppShell })));
const EnterpriseAppHomePage = lazy(() => import('./enterprise-os/pages/AppHomePage').then((m) => ({ default: m.AppHomePage })));
const EnterprisePlaceholderPage = lazy(() => import('./enterprise-os/pages/PlaceholderPage').then((m) => ({ default: m.PlaceholderPage })));
// Phase 2 — Public Pages (Pricing, Audit, AI Governance, Agenturen, Auth, Legal, Checkout)
const EnterpriseAuthPage = lazy(() => import('./enterprise-os/pages/AuthPage').then((m) => ({ default: m.AuthPage })));
const EnterpriseAuditLandingPage = lazy(() => import('./enterprise-os/pages/AuditLandingPage').then((m) => ({ default: m.AuditLandingPage })));
const EnterpriseAiGovernancePage = lazy(() => import('./enterprise-os/pages/AiGovernancePage').then((m) => ({ default: m.AiGovernancePage })));
const EnterpriseAgenciesPage = lazy(() => import('./enterprise-os/pages/AgenciesPage').then((m) => ({ default: m.AgenciesPage })));
const EnterpriseDatenschutzPage = lazy(() => import('./enterprise-os/pages/LegalPage').then((m) => ({ default: m.DatenschutzPage })));
const EnterpriseImpressumPage = lazy(() => import('./enterprise-os/pages/LegalPage').then((m) => ({ default: m.ImpressumPage })));
const EnterpriseCheckoutEntryPage = lazy(() => import('./enterprise-os/pages/CheckoutEntryPage').then((m) => ({ default: m.CheckoutEntryPage })));
const EnterpriseCheckoutPageWrapper = lazy(() => import('./enterprise-os/pages/CheckoutPageWrapper').then((m) => ({ default: m.CheckoutPageWrapper })));
const EnterpriseWelcomeWizardPage = lazy(() => import('./enterprise-os/pages/WelcomeWizardPage').then((m) => ({ default: m.WelcomeWizardPage })));

// Phase 4 — App Workspace (Websites, Risiken, Compliance, Evidence, Monitoring)
const EnterpriseWebsitesPage = lazy(() => import('./enterprise-os/pages/WebsitesPage').then((m) => ({ default: m.WebsitesPage })));
const EnterpriseRisksPage = lazy(() => import('./enterprise-os/pages/RisksPage').then((m) => ({ default: m.RisksPage })));
const EnterpriseCompliancePage = lazy(() => import('./enterprise-os/pages/CompliancePage').then((m) => ({ default: m.CompliancePage })));
const EnterpriseEvidencePage = lazy(() => import('./enterprise-os/pages/EvidencePage').then((m) => ({ default: m.EvidencePage })));
const EnterpriseMonitoringPage = lazy(() => import('./enterprise-os/pages/MonitoringPage').then((m) => ({ default: m.MonitoringPage })));

const AgentsOverviewPage = lazy(() => import('./features/agents/AgentsOverviewPage').then((m) => ({ default: m.AgentsOverviewPage })));
const AutomationAgentPage = lazy(() => import('./features/agents/AutomationAgentPage').then((m) => ({ default: m.AutomationAgentPage })));
const SupportAgentPage = lazy(() => import('./features/agents/SupportAgentPage').then((m) => ({ default: m.SupportAgentPage })));
const CallAgentSusiPage = lazy(() => import('./features/agents/CallAgentSusiPage').then((m) => ({ default: m.CallAgentSusiPage })));
const ScreenshotAgentPage = lazy(() => import('./features/agents/ScreenshotAgentPage').then((m) => ({ default: m.ScreenshotAgentPage })));
const DashboardView = lazy(() => import('./features/dashboard/DashboardView').then((m) => ({ default: m.DashboardView })));
import { Limits } from './pages/Limits';
import { AiGovernancePage } from './pages/AiGovernancePage';
// CheckoutPage already imported at line 112 (PR #290) — duplicate removed.
import { CookieConsent } from './components/CookieConsent';
import { ScrollToTop } from './components/ScrollToTop';
import { GovernanceBrowserShell } from './components/governance-os/GovernanceBrowserShell';
import { RemediationPlaceholder } from './components/governance-os/RemediationPlaceholder';
const AssistentChip = lazy(() => import('./components/AssistentChip').then((m) => ({ default: m.AssistentChip })));
import { TenantProvider } from './core/access/TenantProvider';
import { DemoModeProvider } from './core/demo/DemoModeProvider';
import { EnvironmentProvider } from './features/governance/EnvironmentContext';
import { useTrackPageview } from './lib/track';
import { initMarketingPixels } from './lib/pixels';

const ROUTER_BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined;

function LazyFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-obsidian-950 text-titanium-400 text-sm">
      Lade …
    </div>
  );
}

function RoutesWithTracking() {
  useTrackPageview();
  return (
    <>
      <SEOHead />
      <Suspense fallback={<LazyFallback />}>
        <Routes>
          {/* Demo Routes — Mock Auth + Governance Dashboard */}
          <Route path="/demo-landing" element={<DemoLandingPage />} />
          <Route path="/demo-login" element={<DemoLoginPage />} />
          <Route
            path="/demo-app"
            element={
              <ProtectedRoute>
                <DemoGovernanceDashboard />
              </ProtectedRoute>
            }
          />
      {/* Public — Startseite ist die Governance-OS-Workspace-Vorschau;
          die Marketing-Landing bleibt unter /landing erreichbar. */}
      <Route path="/" element={<MainLanding />} />
      <Route path="/aetheros" element={<AetherOSLanding />} />
      <Route path="/preview" element={<PublicWorkspacePreview />} />
      <Route path="/landing" element={<Landing />} />
      <Route path="/realsync-landing" element={<RealSyncDynamicsLanding />} />
      <Route path="/governance-browser" element={<GovernanceBrowserPage />} />
      <Route path="/runtime"    element={<RuntimePage />} />
      <Route path="/monitoring" element={<MonitoringPage />} />
      <Route path="/governance" element={<Navigate to="/app" replace />} />
      <Route path="/agents"     element={<AgentsPage />} />
      <Route path="/evidence"   element={<EvidencePage />} />
      <Route path="/digitale-souveraenitaet" element={<DigitalSovereignty />} />
      <Route path="/digital-sovereignty"     element={<DigitalSovereignty />} />
      <Route path="/governance-score"              element={<GovernanceScorePage />} />
      <Route path="/governance-complexity-score"   element={<GovernanceScorePage />} />
      <Route path="/ai-act"     element={<AiActPage />} />
      <Route path="/ai-governance" element={<Navigate to="/ai-act" replace />} />
      <Route path="/ai-dsgvo-bot" element={<AiDsgvoBotPage />} />
      <Route path="/docs"       element={<DocsRuntimePage />} />
      <Route path="/agencies" element={<AgenciesLanding />} />
      <Route path="/audit" element={<AuditLanding />} />
      <Route path="/automations" element={<AutomationsLanding />} />
      <Route path="/cookie-scanner" element={<CookieScanner />} />
      <Route path="/tools/cookie-scanner" element={<CookieScanner />} />
      <Route path="/dokumente-bundle" element={<DokumenteBundle />} />
      <Route path="/tools/dokumente-bundle" element={<DokumenteBundle />} />
      <Route path="/ai-act-workflows" element={<AiActWorkflows />} />
      <Route path="/tools/ai-act-workflows" element={<AiActWorkflows />} />
      <Route path="/fuer-saas"      element={<SaasLanding />} />
      <Route path="/fuer-agenturen" element={<AgenturenLanding />} />
      <Route path="/fuer-praxen"    element={<PraxenLanding />} />
      {/* GTM-Konversionsseiten — schärfere Conversion-Fokus */}
      <Route path="/agenturen"       element={<AgenturenConversionLanding />} />
      <Route path="/kanzleien"       element={<KanzleienLanding />} />
      <Route path="/arztpraxen"      element={<ArztpraxenLanding />} />
      <Route path="/wordpress-dsgvo" element={<WordpressDsgvoLanding />} />
      <Route path="/chatgpt-dsgvo"   element={<ChatgptDsgvoLanding />} />
      <Route path="/shopify-dsgvo"   element={<ShopifyDsgvoLanding />} />
      <Route path="/audit/share/:token" element={<AuditShare />} />
      <Route path="/audit/result/:auditId" element={<AuditResultPage />} />
      {/* Guided post-scan onboarding flow — Phase 2 */}
      <Route path="/onboarding/:scanId" element={<GovernanceOnboarding />} />
      <Route path="/recommendation/:scanId" element={<GovernanceRecommendation />} />
      <Route path="/dsgvo-ki-checkliste" element={<DsgvoKiChecklist />} />
      <Route path="/ai-act-faq" element={<AiActFaq />} />
      <Route path="/schrems-ii-erklaert" element={<SchremsIIErklaert />} />
      <Route path="/bait-marisk-compliance-guide" element={<BaitMaRiskGuide />} />
      <Route path="/newsletter/confirm" element={<NewsletterConfirm />} />
      <Route path="/case-studies" element={<CaseStudies />} />
      <Route path="/ressourcen" element={<Resources />} />
      <Route path="/resources" element={<Resources />} />
      <Route path="/blog" element={<Blog />} />
      <Route path="/roadmap" element={<Roadmap />} />
      <Route path="/governance-runtime" element={<GovernanceRuntimePage />} />
      <Route path="/docs/governance" element={<GovernanceDocs />} />
      <Route path="/fix-paket" element={<FixPaket />} />
      <Route path="/pre-consent-tracking" element={<PreConsentTracking />} />
      <Route path="/google-analytics-consent" element={<GoogleAnalyticsConsent />} />
      <Route path="/continuous-compliance" element={<ContinuousCompliance />} />
      <Route path="/ai-act-readiness" element={<AiActReadiness />} />
      <Route path="/resources/matomo-dsgvo-konfiguration" element={<MatomoDsgvoKonfiguration />} />
      <Route path="/cookie-consent-sdk" element={<CookieConsentSdk />} />
      <Route path="/audit-pro" element={<AuditPro />} />
      <Route path="/dsgvo-tool-vergleich" element={<DsgvoToolVergleich />} />
      <Route path="/contact-sales" element={<ContactSales />} />
      <Route path="/enterprise" element={<EnterpriseLanding />} />
      {/* Enterprise AI OS — Founding Access + Dashboard */}
      <Route path="/enterprise-ai-os" element={<EnterpriseAiOs />} />
      <Route path="/enterprise-ai-os/founding-access" element={<EnterpriseAiOsFoundingAccess />} />
      <Route path="/dashboard/enterprise-ai-os" element={<EnterpriseAiOsDashboard />} />
      {/* AI Command Center — kompakte Operating-Layer-UI (frontend-only, no backend) */}
      <Route path="/command-center" element={<Navigate to="/assistant" replace />} />
      <Route path="/ai-command-center" element={<Navigate to="/assistant" replace />} />
      <Route path="/command-center/showcase" element={<AiCommandCenterShowcase />} />
      <Route path="/dashboard/enterprise-ai-os/discovery" element={<EnterpriseAiOsDiscovery />} />
      {/* Onboarding nach Stripe-Checkout */}
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/setup" element={<Welcome />} />
      {/* Tools Hub */}
      <Route path="/tools" element={<ToolsHub />} />
      {/* Industry-Doorways */}
      <Route path="/branchen" element={<Branchen />} />
      <Route path="/branchen/:slug" element={<IndustryDetail />} />
      <Route path="/healthtech" element={<HealthTechLanding />} />
      <Route path="/legal-tech" element={<LegalTechLanding />} />
      {/* Competitor-Alternative-Doorways */}
      <Route path="/onetrust-alternative" element={<OneTrustAlternative />} />
      <Route path="/fintech" element={<FinTechLanding />} />
      <Route path="/oeffentliche-verwaltung" element={<PublicSectorLanding />} />
      <Route path="/behoerden" element={<PublicSectorLanding />} />
      <Route path="/usercentrics-alternative" element={<UsercentricsAlternative />} />
      <Route path="/dataguard-alternative" element={<DataGuardAlternative />} />
      <Route path="/borlabs-alternative" element={<BorlabsAlternative />} />
      <Route path="/cookiebot-alternative" element={<CookiebotAlternative />} />
      <Route path="/proliance-alternative" element={<ProlianceAlternative />} />
      {/* More Industry-Doorways */}
      <Route path="/versicherungen" element={<InsuranceLanding />} />
      <Route path="/insurance" element={<InsuranceLanding />} />
      <Route path="/ecommerce" element={<EcommerceLanding />} />
      <Route path="/online-shops" element={<EcommerceLanding />} />
      {/* Trust / Press / Security */}
      <Route path="/about" element={<About />} />
      <Route path="/manifest" element={<Manifest />} />
      <Route path="/skills" element={<SkillsPage />} />
      <Route path="/ueber-uns" element={<About />} />
      <Route path="/press" element={<Press />} />
      <Route path="/presse" element={<Press />} />
      <Route path="/security" element={<Security />} />
      <Route path="/trust" element={<Trust />} />
      <Route path="/pilot-readiness" element={<PilotReadiness />} />
      <Route path="/integrations/shopify" element={<ShopifyIntegrationPage />} />
      <Route path="/shopify/success" element={<ShopifySuccessPage />} />
      <Route path="/shopify/error" element={<ShopifyErrorPage />} />
      <Route path="/app/settings/integrations/telegram" element={<TelegramIntegrationPage />} />
      <Route path="/developers" element={<Developers />} />
      <Route path="/ai-act-governance" element={<AiActGovernancePage />} />
      <Route path="/agent-governance" element={<AgentGovernancePage />} />
      <Route path="/governance-graph" element={<GovernanceGraphPage />} />
      <Route path="/evidence-vault" element={<EvidenceVaultPage />} />
      <Route path="/policy-engine" element={<PolicyEnginePage />} />
      <Route path="/deployment-governance" element={<DeploymentGovernancePage />} />
      <Route path="/status" element={<Status />} />
      <Route path="/sicherheit" element={<Security />} />
      <Route path="/faq" element={<Faq />} />
      <Route path="/haeufige-fragen" element={<Faq />} />
      <Route path="/changelog" element={<Changelog />} />
      <Route path="/release-notes" element={<Changelog />} />
      <Route path="/saas-anbieter" element={<SaasAnbieterLanding />} />
      <Route path="/saas-providers" element={<SaasAnbieterLanding />} />
      <Route path="/marktanalyse" element={<Marktanalyse />} />
      <Route path="/market-analysis" element={<Marktanalyse />} />
      {/* Education + HR Doorways */}
      <Route path="/bildung" element={<EducationLanding />} />
      <Route path="/education" element={<EducationLanding />} />
      <Route path="/schulen" element={<EducationLanding />} />
      <Route path="/hr-software" element={<HrSoftwareLanding />} />
      <Route path="/personalwesen" element={<HrSoftwareLanding />} />
      {/* Industry-landing aliases for obvious-URL discovery. Same fix
          shape as Bußgeld-Rechner / Meldepflicht-Timer: the canonical
          German routes already exist, but visitors who guess the
          single-word or English variant land on 404. Aliases route
          to the same component without touching SEO canonicals. */}
      <Route path="/legaltech"    element={<LegalTechLanding />} />
      <Route path="/publicsector" element={<PublicSectorLanding />} />
      <Route path="/public-sector" element={<PublicSectorLanding />} />
      <Route path="/hr"           element={<HrSoftwareLanding />} />
      {/* More Competitor-Alternatives */}
      <Route path="/iubenda-alternative" element={<IubendaAlternative />} />
      {/* API + Integrations + Niche */}
      <Route path="/api" element={<ApiDocs />} />
      <Route path="/api-docs" element={<ApiDocs />} />
      <Route path="/integrations" element={<Integrations />} />
      <Route path="/integrationen" element={<Integrations />} />
      <Route path="/steuerberater" element={<SteuerberaterLanding />} />
      <Route path="/steuerkanzlei" element={<SteuerberaterLanding />} />
      {/* Service-sales doorways (dsgvo-website, website-as-a-service, danke) are
          intentionally unrouted as part of the Product Clarity Cleanup. The
          page components remain in src/pages/ for future re-purpose, but are
          no longer reachable from the public site. */}
      {/* SEO Doorways — Framework-spezifisch */}
      <Route path="/bait-compliance" element={<BaitCompliance />} />
      <Route path="/marisk-audit" element={<MariskAudit />} />
      <Route path="/eu-ai-act-check" element={<EuAiActCheck />} />
      <Route path="/cookie-compliance" element={<CookieCompliance />} />
      {/* Compliance Tools (Free) */}
      <Route path="/avv-generator" element={<AvvGenerator />} />
      <Route path="/tools/avv-generator" element={<AvvGenerator />} />
      <Route path="/vvt-wizard" element={<VvtWizard />} />
      <Route path="/tools/vvt-wizard" element={<VvtWizard />} />
      <Route path="/ai-act-klassifikator" element={<AiActClassifier />} />
      <Route path="/tools/ai-act-classifier" element={<AiActClassifier />} />
      <Route path="/tom-generator" element={<TomGenerator />} />
      <Route path="/tools/tom-generator" element={<TomGenerator />} />
      <Route path="/datenpanne-meldung" element={<MeldepflichtTimer />} />
      <Route path="/tools/meldepflicht-timer" element={<MeldepflichtTimer />} />
      <Route path="/datenschutz-generator" element={<DatenschutzGenerator />} />
      <Route path="/tools/datenschutz-generator" element={<DatenschutzGenerator />} />
      <Route path="/dsfa-wizard" element={<DsfaWizard />} />
      <Route path="/tools/dsfa-wizard" element={<DsfaWizard />} />
      <Route path="/busseld-rechner" element={<BusseldRechner />} />
      <Route path="/tools/busseld-rechner" element={<BusseldRechner />} />
      {/* Bußgeld-Rechner: aliases for the correct-spelling URLs.
          Canonical /busseld-rechner stays the SEO target. */}
      <Route path="/bussgeld-rechner"  element={<BusseldRechner />} />
      <Route path="/bussgeldrechner"   element={<BusseldRechner />} />
      <Route path="/meldepflicht-timer" element={<MeldepflichtTimer />} />
      {/* DSB-Kanzlei Partner-Programm */}
      <Route path="/partners"         element={<PartnersPage />} />
      <Route path="/partner-programm" element={<PartnersPage />} />
      <Route path="/dsb-partner"      element={<PartnersPage />} />
      {/* Dashboard */}
      {/* ── Kanonische Workspace-Routen (/app/*) — Governance OS ──
          Wiederverwendung bestehender Views; alte Pfade redirecten unten.
          Chat (CreatorDashboard) bleibt als Assistent unter /assistant. */}
      {/* ── Governance OS Browser Shell — alle /app/* Routen ──
          GovernanceBrowserShell: TopBar + Tabs + Canvas + AssistantPanel + StatusBar.
          Auth Guards bleiben in den View-Komponenten selbst (AuthGate / RequireAal2). */}
      {/* Onboarding-First-Routing: /app kanonisiert auf das gegatete Dashboard.
          Kein Onboarding-Zwang (kein Hard-Lockout) — nur Kanonisierung. */}
      <Route path="/app" element={<Navigate to="/app/dashboard" replace />} />
      {/* Kanonisches, auth-gegatetes Dashboard-Ziel nach Checkout/Onboarding.
          Behebt die 404 auf /app/dashboard; nicht eingeloggte Besucher springen
          ueber AppGate nach /welcome?next=… und von dort zurueck (Login-Ruecksprung).
          Die View-eigenen Guards (AuthGate/RequireAal2) bleiben zusaetzlich aktiv. */}
      <Route path="/app/dashboard" element={<AppGate><GovernanceBrowserShell><CeoCockpitView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/intelligence" element={<AppGate><ProtectedRoute><DashboardView /></ProtectedRoute></AppGate>} />
      <Route path="/app/cockpit/brief" element={<CeoBriefPrintView />} />
      <Route path="/app/overview" element={<GovernanceBrowserShell><GovernanceOsDashboard /></GovernanceBrowserShell>} />
      <Route path="/app/home" element={<GovernanceBrowserShell><WorkspaceHome /></GovernanceBrowserShell>} />
      <Route path="/app/company" element={<GovernanceBrowserShell><CompanyView /></GovernanceBrowserShell>} />
      <Route path="/app/websites" element={<GovernanceBrowserShell><WebsiteGovernanceView /></GovernanceBrowserShell>} />
      <Route path="/app/ai-systems" element={<GovernanceBrowserShell><AiSystemRegistryView /></GovernanceBrowserShell>} />
      <Route path="/app/ai-systems/agents" element={<GovernanceBrowserShell><AgentRegistryView /></GovernanceBrowserShell>} />
      <Route path="/app/automations" element={<GovernanceBrowserShell><AutomationSkillsView /></GovernanceBrowserShell>} />
      <Route path="/app/provenance" element={<GovernanceBrowserShell><ProvenanceView /></GovernanceBrowserShell>} />
      <Route path="/app/bulk" element={<GovernanceBrowserShell><BulkJobsView /></GovernanceBrowserShell>} />
      <Route path="/app/scheduler" element={<GovernanceBrowserShell><SchedulerView /></GovernanceBrowserShell>} />
      <Route path="/app/evidence-vault" element={<GovernanceBrowserShell><EvidenceVaultAdvancedView /></GovernanceBrowserShell>} />
      <Route path="/app/policy-packs" element={<GovernanceBrowserShell><PolicyPacksView /></GovernanceBrowserShell>} />
      <Route path="/app/bots" element={<GovernanceBrowserShell><BotsView /></GovernanceBrowserShell>} />
      <Route path="/app/bots/inbox" element={<GovernanceBrowserShell><BotInboxView /></GovernanceBrowserShell>} />
      <Route path="/app/bots/:botId" element={<GovernanceBrowserShell><BotBuilderView /></GovernanceBrowserShell>} />
      <Route path="/app/risks" element={<GovernanceBrowserShell><RiskCenterView /></GovernanceBrowserShell>} />
      <Route path="/app/compliance" element={<GovernanceBrowserShell><GovernanceComplianceReportView /></GovernanceBrowserShell>} />
      <Route path="/app/evidence" element={<GovernanceBrowserShell><EvidenceVaultView /></GovernanceBrowserShell>} />
      <Route path="/app/evidence/audit" element={<GovernanceBrowserShell><RequireAal2 action="Evidence-Export"><GovernanceAuditorConsoleView /></RequireAal2></GovernanceBrowserShell>} />
      <Route path="/app/monitoring" element={<GovernanceBrowserShell><MonitoringSourcesView /></GovernanceBrowserShell>} />
      <Route path="/app/monitoring/legacy" element={<GovernanceBrowserShell><MonitoringSurface embedded /></GovernanceBrowserShell>} />
      <Route path="/app/security-signals" element={<GovernanceBrowserShell><SecuritySignalsView /></GovernanceBrowserShell>} />
      <Route path="/app/legal-rag" element={<LegalRagView />} />
      <Route path="/app/workflows" element={<GovernanceBrowserShell><WorkflowsView /></GovernanceBrowserShell>} />
      <Route path="/app/risks" element={<GovernanceBrowserShell><RiskCenterView /></GovernanceBrowserShell>} />
      <Route path="/app/compliance" element={<GovernanceBrowserShell><GovernanceComplianceReportView /></GovernanceBrowserShell>} />
      <Route path="/app/evidence" element={<GovernanceBrowserShell><EvidenceVaultView /></GovernanceBrowserShell>} />
      <Route path="/app/evidence/auditor" element={<GovernanceBrowserShell><RequireAal2 action="Evidence-Export"><GovernanceAuditorConsoleView /></RequireAal2></GovernanceBrowserShell>} />
      <Route path="/app/monitoring" element={<GovernanceBrowserShell><MonitoringRuntimeView /></GovernanceBrowserShell>} />
      <Route path="/app/vendors" element={<GovernanceBrowserShell><GovernanceVendorInventoryView /></GovernanceBrowserShell>} />
      <Route path="/app/reports" element={<GovernanceBrowserShell><GovernanceComplianceReportView /></GovernanceBrowserShell>} />
      <Route path="/app/dpia" element={<GovernanceBrowserShell><GovernanceDpiasView /></GovernanceBrowserShell>} />
      <Route path="/app/dsr" element={<GovernanceBrowserShell><GovernanceDsrTrackerView /></GovernanceBrowserShell>} />
      <Route path="/app/incidents" element={<GovernanceBrowserShell><GovernanceIncidentsView /></GovernanceBrowserShell>} />
      <Route path="/app/remediation" element={<GovernanceBrowserShell><RemediationPlansView /></GovernanceBrowserShell>} />
      <Route path="/app/remediation/:planId" element={<GovernanceBrowserShell><RemediationPlanDetailView /></GovernanceBrowserShell>} />
      <Route path="/app/keys" element={<GovernanceBrowserShell><GovernanceKeysView /></GovernanceBrowserShell>} />
      <Route path="/app/vvt" element={<GovernanceBrowserShell><RuntimeVvtView /></GovernanceBrowserShell>} />
      <Route path="/app/webhooks" element={<GovernanceBrowserShell><GovernanceWebhooksView /></GovernanceBrowserShell>} />
      <Route path="/app/onboarding" element={<GovernanceBrowserShell><GovernanceOnboardingView /></GovernanceBrowserShell>} />
      <Route path="/app/mappings" element={<GovernanceBrowserShell><GovernanceMappingsView /></GovernanceBrowserShell>} />
      <Route path="/app/events/:eventId" element={<GovernanceBrowserShell><GovernanceEventDetailView /></GovernanceBrowserShell>} />
      <Route path="/app/assets/:assetId" element={<GovernanceBrowserShell><GovernanceAssetDetailView /></GovernanceBrowserShell>} />
      <Route path="/app/approvals" element={<GovernanceBrowserShell><GovernanceApprovalsView /></GovernanceBrowserShell>} />
      <Route path="/app/admin-log" element={<GovernanceBrowserShell><GovernanceAdminLogView /></GovernanceBrowserShell>} />
      <Route path="/app/policies/templates" element={<GovernanceBrowserShell><GovernancePolicyTemplatesView /></GovernanceBrowserShell>} />
      <Route path="/app/connectors" element={<GovernanceBrowserShell><GovernanceConnectorsView /></GovernanceBrowserShell>} />
      <Route path="/app/costs" element={<GovernanceBrowserShell><GovernanceCostTrackingView /></GovernanceBrowserShell>} />
      <Route path="/app/scans" element={<GovernanceBrowserShell><GovernanceScansListView /></GovernanceBrowserShell>} />
      <Route path="/app/scans/:scanId" element={<GovernanceBrowserShell><GovernanceScanDetailView /></GovernanceBrowserShell>} />
      <Route path="/app/risk-inventory" element={<GovernanceBrowserShell><AiActRiskInventoryView /></GovernanceBrowserShell>} />
      <Route path="/app/alerts" element={<GovernanceBrowserShell><GovernanceAlertsView /></GovernanceBrowserShell>} />
      <Route path="/app/optimize" element={<GovernanceBrowserShell><OptimizationView /></GovernanceBrowserShell>} />
      <Route path="/app/billing" element={<GovernanceBrowserShell><RequireAal2 action="Billing-Verwaltung"><BillingView /></RequireAal2></GovernanceBrowserShell>} />
      <Route path="/app/datasets" element={<GovernanceBrowserShell><AiActDataGovernanceView /></GovernanceBrowserShell>} />
      <Route path="/app/analytics" element={<GovernanceBrowserShell><Suspense fallback={<div>Loading...</div>}><DashboardAnalyticsView /></Suspense></GovernanceBrowserShell>} />
      <Route path="/app/monitoring/sources" element={<GovernanceBrowserShell><MonitoringSourcesView /></GovernanceBrowserShell>} />
      <Route path="/app/team" element={<GovernanceBrowserShell><RequireAal2 action="Team-Verwaltung"><TenantAdminConsole /></RequireAal2></GovernanceBrowserShell>} />
      <Route path="/app/settings/team" element={<GovernanceBrowserShell><RequireAal2 action="Team-Verwaltung"><TenantAdminConsole /></RequireAal2></GovernanceBrowserShell>} />
      {/* Admin Panel Routes */}
      <Route path="/app/admin" element={<AdminDashboard />} />
      <Route path="/app/admin/members" element={<AdminMembersPage />} />
      <Route path="/app/admin/settings" element={<AdminSettingsPage />} />
      <Route path="/app/admin/billing" element={<AdminBillingPage />} />
      <Route path="/app/admin/api-keys" element={<AdminAPIKeysPage />} />
      <Route path="/app/admin/audit" element={<AdminAuditPage />} />
      <Route path="/app/agents" element={<GovernanceBrowserShell><GovernanceAgentsCenterView /></GovernanceBrowserShell>} />
      <Route path="/app/documents" element={<GovernanceBrowserShell><GovernanceDocumentsView /></GovernanceBrowserShell>} />
      <Route path="/app/audit" element={<GovernanceBrowserShell><GovernanceAuditExportView /></GovernanceBrowserShell>} />
      <Route path="/app/settings" element={<GovernanceBrowserShell><SettingsView /></GovernanceBrowserShell>} />
      <Route path="/app/agents" element={<GovernanceBrowserShell><AgentsOverviewPage /></GovernanceBrowserShell>} />
      <Route path="/app/agents/automation" element={<GovernanceBrowserShell><AutomationAgentPage /></GovernanceBrowserShell>} />
      <Route path="/app/agents/support" element={<GovernanceBrowserShell><SupportAgentPage /></GovernanceBrowserShell>} />
      <Route path="/app/agents/susi" element={<GovernanceBrowserShell><CallAgentSusiPage /></GovernanceBrowserShell>} />
      <Route path="/app/agents/screenshot" element={<GovernanceBrowserShell><ScreenshotAgentPage /></GovernanceBrowserShell>} />

      {/* ── Redirects: konkurrierende Einstiege → kanonische Workspace-URL ──
          Alte URLs werden NICHT entfernt (keine 404 / keine toten Bookmarks).
          Chat bleibt als Assistent unter /assistant erreichbar. */}
      <Route path="/assistant" element={<CreatorDashboard />} />
      <Route path="/dashboard" element={<Navigate to="/app" replace />} />
      <Route path="/dashboard/business" element={<BusinessDashboard />} />
      <Route path="/dashboard/audit" element={<AuditDashboardView />} />
      <Route path="/dashboard/agents" element={<AgentOsAdminPage />} />
      <Route path="/business" element={<BusinessDashboard />} />
      <Route path="/kodee" element={<KodeeView />} />
      <Route path="/kodee/connections" element={<ConnectionsView />} />
      <Route path="/billing/usage" element={<RequireAal2 action="Billing-Verwaltung"><UsageView /></RequireAal2>} />
      <Route path="/pricing" element={<PricingPage />} />
      {/* Pricing Detail Routes */}
      <Route path="/pricing/:slug" element={<PricingDetailPageWrapper />} />
      <Route path="/features/:slug" element={<FeatureDetailPageWrapper />} />
      {/* Checkout routes - specific paths must come before parameterized routes */}
      <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
      <Route path="/checkout/cancelled" element={<CheckoutCancelledPage />} />
      <Route path="/checkout/:planKey" element={<CheckoutPage />} />
      {/* End of Pricing Detail Routes */}
      <Route path="/claude-code-optimizer" element={<ClaudeCodeOptimizer />} />
      {/* Konsolidiert auf eine kanonische Paket-Auswahl unter /pricing */}
      <Route path="/governance-os-pricing" element={<Navigate to="/pricing" replace />} />
      <Route path="/solutions/saas" element={<SaaSSolution />} />
      <Route path="/solutions/agencies" element={<AgenciesSolution />} />
      <Route path="/tenant/invites" element={<RequireAal2 action="Team-Verwaltung"><InvitesView /></RequireAal2>} />
      <Route path="/tenant/invite/:token" element={<AcceptInviteView />} />
      {/* Legacy /governance/* routes redirect to canonical /app/* paths (with shell wrapper).
          Backwards compatibility: old bookmarks/links continue to work. */}
      <Route path="/governance/admin" element={<Navigate to="/app/websites" replace />} />
      <Route path="/governance/keys" element={<Navigate to="/app/keys" replace />} />
      <Route path="/governance/vvt" element={<Navigate to="/app/vvt" replace />} />
      <Route path="/governance/agents" element={<Navigate to="/app/ai-systems" replace />} />
      <Route path="/governance/webhooks" element={<Navigate to="/app/webhooks" replace />} />
      <Route path="/governance/onboarding" element={<Navigate to="/app/onboarding" replace />} />
      <Route path="/governance/mappings" element={<Navigate to="/app/mappings" replace />} />
      <Route path="/governance/events/:eventId" element={<Navigate to="/app/events/:eventId" replace />} />
      <Route path="/governance/assets/:assetId" element={<Navigate to="/app/assets/:assetId" replace />} />
      <Route path="/governance/approvals" element={<Navigate to="/app/approvals" replace />} />
      <Route path="/governance/admin-log" element={<Navigate to="/app/admin-log" replace />} />
      <Route path="/governance/policies/templates" element={<Navigate to="/app/policies/templates" replace />} />
      <Route path="/governance/reports" element={<Navigate to="/app/compliance" replace />} />
      <Route path="/governance/dpias" element={<Navigate to="/app/dpia" replace />} />
      <Route path="/governance/dsr" element={<Navigate to="/app/dsr" replace />} />
      <Route path="/governance/incidents" element={<Navigate to="/app/incidents" replace />} />
      <Route path="/governance/connectors" element={<Navigate to="/app/connectors" replace />} />
      <Route path="/governance/vendors" element={<Navigate to="/app/vendors" replace />} />
      <Route path="/governance/remediation" element={<Navigate to="/app/remediation" replace />} />
      <Route path="/governance/remediation/:planId" element={<Navigate to="/app/remediation/:planId" replace />} />
      <Route path="/governance/costs" element={<Navigate to="/app/costs" replace />} />
      <Route path="/governance/auditor" element={<Navigate to="/app/evidence" replace />} />
      <Route path="/governance/scans" element={<Navigate to="/app/scans" replace />} />
      <Route path="/governance/scans/:scanId" element={<Navigate to="/app/scans/:scanId" replace />} />
      <Route path="/governance/risk-inventory" element={<Navigate to="/app/risk-inventory" replace />} />
      {/* Operations Runtime — auth-gated inventory / warenwirtschaft module.
          NOT linked from the public navbar; tenants reach it from the
          authenticated dashboard or directly via URL. */}
      <Route path="/operations" element={<OperationsDashboardView />} />
      <Route path="/operations/inventory" element={<OperationsItemsView />} />
      <Route path="/operations/items" element={<OperationsItemsView />} />
      <Route path="/operations/stock-movements" element={<OperationsStockMovements />} />
      <Route path="/operations/suppliers" element={<OperationsSuppliersView />} />
      <Route path="/operations/locations" element={<OperationsLocationsView />} />
      <Route path="/operations/barcodes" element={<OperationsBarcodesView />} />
      <Route path="/operations/reports" element={<OperationsReportsView />} />
      {/* Tax Evidence Runtime — auth-gated documentation prep.
          NOT public, no Steuerberatung. Disclaimer is rendered inside
          every /finance/* view. */}
      <Route path="/finance" element={<FinanceDashboard />} />
      <Route path="/finance/tax-evidence" element={<TaxEvidenceView />} />
      <Route path="/finance/documents" element={<TaxDocumentsView />} />
      <Route path="/finance/year/:year" element={<TaxYearView />} />
      <Route path="/finance/exports" element={<TaxExportsView />} />
      <Route path="/finance/reminders" element={<TaxRemindersView />} />
      <Route path="/finance/reviews" element={<TaxReviewsView />} />
      <Route path="/settings" element={<SettingsView />} />
      <Route path="/settings/ai-residency" element={<AiResidencySettings />} />
      <Route path="/settings/security" element={<SecuritySettings />} />
      <Route path="/settings/team" element={<RequireAal2 action="Team-Verwaltung"><TenantAdminConsole /></RequireAal2>} />
      <Route path="/settings/account" element={<AccountSettings />} />
      <Route path="/settings/api-keys" element={<ApiKeysSettings />} />
      <Route path="/settings/branding" element={<RequireAal2 action="White-Label Branding"><BrandingSettings /></RequireAal2>} />
      <Route path="/workflows" element={<WorkflowsView />} />
      <Route path="/market-gaps" element={<MarketGapsView />} />
      <Route path="/outreach" element={<OutreachView />} />
      {/* Admin */}
      <Route path="/admin" element={<SuperAdminDashboard />} />
      <Route path="/admin/analytics" element={<AnalyticsView />} />
      <Route path="/admin/leads" element={<LeadsView />} />
      <Route path="/admin/system" element={<SystemHealthView />} />
      <Route path="/admin/social" element={<AdminSocialPreviewPage />} />
      <Route path="/admin/customers" element={<CustomersView />} />
      <Route path="/admin/onboarding" element={<OnboardingView />} />
      <Route path="/admin/rebuilds" element={<RebuildsView />} />
      {/* Legal */}
      <Route path="/legal/privacy" element={<PrivacyPolicy />} />
      <Route path="/legal/sub-processors" element={<SubProcessors />} />
      <Route path="/impressum" element={<Impressum />} />
      <Route path="/legal/impressum" element={<Impressum />} />
      <Route path="/datenschutz" element={<PrivacyPolicy />} />
      <Route path="/legal/datenschutz" element={<PrivacyPolicy />} />
      <Route path="/legal/avv" element={<AVVTemplate />} />
      <Route path="/avv" element={<Navigate to="/legal/avv" replace />} />
      <Route path="/legal/terms" element={<LegalTerms />} />
      <Route path="/agb" element={<LegalTerms />} />
      <Route path="/legal/widerruf" element={<Widerrufsbelehrung />} />
      <Route path="/widerruf" element={<Widerrufsbelehrung />} />
      <Route path="/widerrufsbelehrung" element={<Widerrufsbelehrung />} />
      <Route path="/legal/compliance-matrix" element={<ComplianceMatrix />} />
      <Route path="/legal/methodology" element={<LegalMethodology />} />
      <Route path="/methodik" element={<LegalMethodology />} />
      <Route path="/grenzen" element={<Limits />} />
      <Route path="/limits" element={<Limits />} />

      {/* Common auth entry points users expect */}
      <Route path="/login" element={<Navigate to="/os/login" replace />} />
      <Route path="/signin" element={<Navigate to="/os/login" replace />} />
      <Route path="/signup" element={<Navigate to="/os/signup" replace />} />
      <Route path="/register" element={<Navigate to="/os/signup" replace />} />

      {/* ── Enterprise OS Prototype — neues Designsystem + IA (Phase 1 Foundation) ──
          Eigenständiger Klick-Prototyp mit Mockdaten unter /os, /os/app/*.
          Bestehende /, /app/* Routen bleiben unverändert (siehe oben). */}
      <Route path="/os" element={<EnterpriseLandingPage />} />
      {/* Phase 2 — Public Pages (eigenständig, Mockdaten, kein Backend) */}
      <Route path="/os/pricing" element={<Navigate to="/pricing" replace />} />
      <Route path="/os/audit" element={<EnterpriseAuditLandingPage />} />
      <Route path="/os/ai-act" element={<EnterpriseAiGovernancePage />} />
      <Route path="/os/agencies" element={<EnterpriseAgenciesPage />} />
      <Route path="/os/login" element={<EnterpriseAuthPage mode="login" />} />
      <Route path="/os/signup" element={<EnterpriseAuthPage mode="signup" />} />
      <Route path="/os/checkout" element={<EnterpriseCheckoutEntryPage />} />
      <Route path="/os/welcome" element={<EnterpriseWelcomeWizardPage />} />
      <Route path="/os/datenschutz" element={<EnterpriseDatenschutzPage />} />
      <Route path="/os/impressum" element={<EnterpriseImpressumPage />} />
      <Route
        path="/os/app"
        element={
          <EnterpriseAppShell title="Home" breadcrumb={['Übersicht']}>
            <EnterpriseAppHomePage />
          </EnterpriseAppShell>
        }
      />
      <Route
        path="/os/app/websites"
        element={
          <EnterpriseAppShell title="Websites" breadcrumb={['Übersicht']}>
            <EnterpriseWebsitesPage />
          </EnterpriseAppShell>
        }
      />
      <Route
        path="/os/app/risks"
        element={
          <EnterpriseAppShell title="Risiken" breadcrumb={['Übersicht']}>
            <EnterpriseRisksPage />
          </EnterpriseAppShell>
        }
      />
      <Route
        path="/os/app/compliance"
        element={
          <EnterpriseAppShell title="Compliance" breadcrumb={['Governance']}>
            <EnterpriseCompliancePage />
          </EnterpriseAppShell>
        }
      />
      <Route
        path="/os/app/evidence"
        element={
          <EnterpriseAppShell title="Evidence Vault" breadcrumb={['Governance']}>
            <EnterpriseEvidencePage />
          </EnterpriseAppShell>
        }
      />
      <Route
        path="/os/app/monitoring"
        element={
          <EnterpriseAppShell title="Monitoring" breadcrumb={['Governance']}>
            <EnterpriseMonitoringPage />
          </EnterpriseAppShell>
        }
      />
      <Route
        path="/os/app/ai-usecases"
        element={
          <EnterpriseAppShell title="AI Use Cases" breadcrumb={['Governance']}>
            <EnterprisePlaceholderPage title="AI Use Case Registry" description="Die vollständige Registry aller KI-Systeme inkl. Risikoklassifizierung nach EU AI Act folgt in Phase 3." />
          </EnterpriseAppShell>
        }
      />
      <Route
        path="/os/app/agents"
        element={
          <EnterpriseAppShell title="Agenten" breadcrumb={['Governance']}>
            <EnterprisePlaceholderPage title="Agenten" description="Die vollständige Agent-Verwaltung mit Konfiguration, Laufzeiten und Logs folgt in Phase 3." />
          </EnterpriseAppShell>
        }
      />
      <Route
        path="/os/app/reports"
        element={
          <EnterpriseAppShell title="Reports" breadcrumb={['Governance']}>
            <EnterprisePlaceholderPage title="Audit Reports" description="Die vollständige Report-Bibliothek mit Export- und Freigabe-Workflows folgt in Phase 3." />
          </EnterpriseAppShell>
        }
      />
      <Route
        path="/os/app/team"
        element={
          <EnterpriseAppShell title="Team" breadcrumb={['Organisation']}>
            <EnterprisePlaceholderPage title="Team & Rollen" description="Die vollständige Team-, Rollen- und Berechtigungsverwaltung folgt in Phase 3." />
          </EnterpriseAppShell>
        }
      />
      <Route
        path="/os/app/billing"
        element={
          <EnterpriseAppShell title="Billing" breadcrumb={['Organisation']}>
            <EnterprisePlaceholderPage title="Billing" description="Die vollständige Abrechnungs- und Plan-Verwaltung folgt in Phase 3." />
          </EnterpriseAppShell>
        }
      />
      <Route
        path="/os/app/settings"
        element={
          <EnterpriseAppShell title="Einstellungen" breadcrumb={['Organisation']}>
            <EnterprisePlaceholderPage title="Einstellungen" description="Die vollständigen Organisations- und Account-Einstellungen folgen in Phase 3." />
          </EnterpriseAppShell>
        }
      />

      {/* Geführter Flow — erklärt jeden Klick auf einer eigenen Seite.
          `/flow/*` fängt auch verschachtelte Slugs wie `checkout/starter`. */}
      <Route path="/flow" element={<Navigate to="/flow/start-scan" replace />} />
      <Route path="/flow/*" element={<FlowStepRoute />} />

      {/* 404 catch-all — must be last */}
      <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default function App() {
  useEffect(() => { initMarketingPixels(); }, []);
  return (
    <TenantProvider>
      <EnvironmentProvider>
        <DemoModeProvider>
          <SupabaseAuthProvider>
            <BrowserRouter basename={ROUTER_BASENAME}>
            <ScrollToTop />
            <FlowProvider>
            <RoutesWithTracking />
            </FlowProvider>
            <CookieConsent />
            <Suspense fallback={null}>
              <AssistentChip />
            </Suspense>
          </BrowserRouter>
          </SupabaseAuthProvider>
        </DemoModeProvider>
      </EnvironmentProvider>
    </TenantProvider>
  );
}
