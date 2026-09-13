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
import { DemoTourProvider } from './core/demo/DemoTourContext';
// ── Public entry: MainLanding (Unternehmenshauptseite) auf / — eager for LCP
import { MainLanding } from './pages/MainLanding';
import { LogoutPage } from './pages/LogoutPage';
import { Welcome } from './pages/Welcome';
// FlowProvider stays eager (wraps Routes at root); FlowStepRoute is lazy below.
import { FlowProvider } from './flow/FlowContext';
// ── Phase 1: Public/marketing/SEO/demo/unified-entry pages → lazy
// Keeps MainLanding + auth shell (Welcome/Logout/AppGate) eager for LCP / resume.
const DemoGovernanceDashboard = lazy(() => import('./pages/DemoGovernanceDashboard').then((m) => ({ default: m.DemoGovernanceDashboard })));
const DemoLandingPage = lazy(() => import('./pages/DemoLandingPage').then((m) => ({ default: m.DemoLandingPage })));
const DemoTourStartPage = lazy(() => import('./pages/DemoTourStartPage').then((m) => ({ default: m.DemoTourStartPage })));
const DemoTourSignupPage = lazy(() => import('./pages/DemoTourSignupPage').then((m) => ({ default: m.DemoTourSignupPage })));
const DemoTourCheckoutPage = lazy(() => import('./pages/DemoTourCheckoutPage').then((m) => ({ default: m.DemoTourCheckoutPage })));
const DemoTourDashboard = lazy(() => import('./pages/DemoTourDashboard').then((m) => ({ default: m.DemoTourDashboard })));
const DesignLedgerLanding = lazy(() => import('./pages/design/DesignLedgerLanding').then((m) => ({ default: m.DesignLedgerLanding })));
const DesignTribunalLanding = lazy(() => import('./pages/design/DesignTribunalLanding').then((m) => ({ default: m.DesignTribunalLanding })));
const ScanStartPage = lazy(() => import('./pages/product-entry-points/ScanStartPage').then((m) => ({ default: m.ScanStartPage })));
const ChatbotStartPage = lazy(() => import('./pages/product-entry-points/ChatbotStartPage').then((m) => ({ default: m.ChatbotStartPage })));
const PhonebotStartPage = lazy(() => import('./pages/product-entry-points/PhonebotStartPage').then((m) => ({ default: m.PhonebotStartPage })));
const AetherOSLanding = lazy(() => import('./pages/AetherOSLanding').then((m) => ({ default: m.AetherOSLanding })));
const RealSyncDynamicsLanding = lazy(() => import('./marketing/landing/RealSyncDynamicsLanding').then((m) => ({ default: m.RealSyncDynamicsLanding })));
const EnterpriseKonfigurator = lazy(() => import('./pages/EnterpriseKonfigurator'));
const PublicWorkspacePreview = lazy(() => import('./pages/PublicWorkspacePreview').then((m) => ({ default: m.PublicWorkspacePreview })));
const GovernanceBrowserPage = lazy(() => import('./pages/GovernanceBrowserPage').then((m) => ({ default: m.GovernanceBrowserPage })));
const Landing = lazy(() => import('./pages/Landing').then((m) => ({ default: m.Landing })));
const LandingPagesOverview = lazy(() => import('./pages/LandingPagesOverview').then((m) => ({ default: m.LandingPagesOverview })));
const AgenciesLanding = lazy(() => import('./pages/AgenciesLanding').then((m) => ({ default: m.AgenciesLanding })));
const AuditLanding = lazy(() => import('./pages/AuditLanding').then((m) => ({ default: m.AuditLanding })));
const AutomationsLanding = lazy(() => import('./pages/AutomationsLanding').then((m) => ({ default: m.AutomationsLanding })));
const AuditResultPage = lazy(() => import('./pages/AuditResultPage').then((m) => ({ default: m.AuditResultPage })));
const DsgvoKiChecklist = lazy(() => import('./pages/DsgvoKiChecklist').then((m) => ({ default: m.DsgvoKiChecklist })));
const AuditShare = lazy(() => import('./pages/AuditShare').then((m) => ({ default: m.AuditShare })));
const AiActFaq = lazy(() => import('./pages/AiActFaq').then((m) => ({ default: m.AiActFaq })));
const SchremsIIErklaert = lazy(() => import('./pages/SchremsIIErklaert').then((m) => ({ default: m.SchremsIIErklaert })));
const OnboardingErklaert = lazy(() => import('./pages/OnboardingErklaert').then((m) => ({ default: m.OnboardingErklaert })));
const BaitMaRiskGuide = lazy(() => import('./pages/BaitMaRiskGuide').then((m) => ({ default: m.BaitMaRiskGuide })));
const NewsletterConfirm = lazy(() => import('./pages/NewsletterConfirm').then((m) => ({ default: m.NewsletterConfirm })));
const CaseStudies = lazy(() => import('./pages/CaseStudies').then((m) => ({ default: m.CaseStudies })));
const Resources = lazy(() => import('./pages/Resources').then((m) => ({ default: m.Resources })));
const Blog = lazy(() => import('./pages/Blog').then((m) => ({ default: m.Blog })));
const Roadmap = lazy(() => import('./pages/Roadmap').then((m) => ({ default: m.Roadmap })));
const GovernanceRuntimePage = lazy(() => import('./pages/GovernanceRuntimePage').then((m) => ({ default: m.GovernanceRuntimePage })));
const GovernanceDocs = lazy(() => import('./pages/GovernanceDocs').then((m) => ({ default: m.GovernanceDocs })));
const RuntimePage = lazy(() => import('./pages/RuntimePage').then((m) => ({ default: m.RuntimePage })));
const MonitoringPage = lazy(() => import('./pages/MonitoringPage').then((m) => ({ default: m.MonitoringPage })));
const MonitoringSurface = lazy(() => import('./pages/MonitoringPage').then((m) => ({ default: m.MonitoringSurface })));
const AgentsPage = lazy(() => import('./pages/AgentsPage').then((m) => ({ default: m.AgentsPage })));
const AiActPage = lazy(() => import('./pages/AiActPage').then((m) => ({ default: m.AiActPage })));
const AiDsgvoBotPage = lazy(() => import('./pages/AiDsgvoBotPage').then((m) => ({ default: m.AiDsgvoBotPage })));
const WaitlistLanding = lazy(() => import('./pages/WaitlistLanding').then((m) => ({ default: m.WaitlistLanding })));
const DocsRuntimePage = lazy(() => import('./pages/DocsRuntimePage').then((m) => ({ default: m.DocsRuntimePage })));
const EvidencePage = lazy(() => import('./pages/EvidencePage').then((m) => ({ default: m.EvidencePage })));
const DigitalSovereignty = lazy(() => import('./pages/DigitalSovereignty').then((m) => ({ default: m.DigitalSovereignty })));
const GovernanceScorePage = lazy(() => import('./pages/GovernanceScorePage').then((m) => ({ default: m.GovernanceScorePage })));
const FixPaket = lazy(() => import('./pages/FixPaket').then((m) => ({ default: m.FixPaket })));
const PreConsentTracking = lazy(() => import('./pages/seo/PreConsentTracking').then((m) => ({ default: m.PreConsentTracking })));
const GoogleAnalyticsConsent = lazy(() => import('./pages/seo/GoogleAnalyticsConsent').then((m) => ({ default: m.GoogleAnalyticsConsent })));
const ContinuousCompliance = lazy(() => import('./pages/seo/ContinuousCompliance').then((m) => ({ default: m.ContinuousCompliance })));
const AiActReadiness = lazy(() => import('./pages/seo/AiActReadiness').then((m) => ({ default: m.AiActReadiness })));
const MatomoDsgvoKonfiguration = lazy(() => import('./pages/seo/MatomoDsgvoKonfiguration').then((m) => ({ default: m.MatomoDsgvoKonfiguration })));
const CookieConsentSdk = lazy(() => import('./pages/CookieConsentSdk').then((m) => ({ default: m.CookieConsentSdk })));
const AuditPro = lazy(() => import('./pages/AuditPro').then((m) => ({ default: m.AuditPro })));
const DsgvoToolVergleich = lazy(() => import('./pages/DsgvoToolVergleich').then((m) => ({ default: m.DsgvoToolVergleich })));
const ContactSales = lazy(() => import('./pages/ContactSales').then((m) => ({ default: m.ContactSales })));
const KontaktPage = lazy(() => import('./pages/KontaktPage').then((m) => ({ default: m.KontaktPage })));
const EnterpriseAiOs = lazy(() => import('./pages/EnterpriseAiOs').then((m) => ({ default: m.EnterpriseAiOs })));
const EnterpriseAiOsFoundingAccess = lazy(() => import('./pages/EnterpriseAiOsFoundingAccess').then((m) => ({ default: m.EnterpriseAiOsFoundingAccess })));
const EnterpriseAiOsDashboard = lazy(() => import('./pages/EnterpriseAiOsDashboard').then((m) => ({ default: m.EnterpriseAiOsDashboard })));
const AiCommandCenterShowcase = lazy(() => import('./pages/AiCommandCenterShowcase').then((m) => ({ default: m.AiCommandCenterShowcase })));
const EnterpriseAiOsDiscovery = lazy(() => import('./pages/EnterpriseAiOsDiscovery').then((m) => ({ default: m.EnterpriseAiOsDiscovery })));
const EnterpriseLanding = lazy(() => import('./pages/EnterpriseLanding').then((m) => ({ default: m.EnterpriseLanding })));
const SaaSSolution = lazy(() => import('./pages/solutions/SaaSSolution').then((m) => ({ default: m.SaaSSolution })));
const AgenciesSolution = lazy(() => import('./pages/solutions/AgenciesSolution').then((m) => ({ default: m.AgenciesSolution })));
const GovernanceOnboarding = lazy(() => import('./pages/GovernanceOnboarding').then((m) => ({ default: m.GovernanceOnboarding })));
const GovernanceRecommendation = lazy(() => import('./pages/GovernanceRecommendation').then((m) => ({ default: m.GovernanceRecommendation })));
const UnifiedEntryShell = lazy(() => import('./unified-entry/UnifiedEntryShell').then((m) => ({ default: m.UnifiedEntryShell })));
const ScanEntryPage = lazy(() => import('./unified-entry/pages/ScanEntryPage').then((m) => ({ default: m.ScanEntryPage })));
const DashboardPreviewPage = lazy(() => import('./unified-entry/pages/DashboardPreviewPage').then((m) => ({ default: m.DashboardPreviewPage })));
const TrialOfferPage = lazy(() => import('./unified-entry/pages/TrialOfferPage').then((m) => ({ default: m.TrialOfferPage })));
const RegisterPage = lazy(() => import('./unified-entry/pages/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const PostRegisterOnboardingPage = lazy(() => import('./unified-entry/pages/PostRegisterOnboardingPage').then((m) => ({ default: m.PostRegisterOnboardingPage })));
const SuccessPage = lazy(() => import('./unified-entry/pages/SuccessPage').then((m) => ({ default: m.SuccessPage })));
const PathChoicePage = lazy(() => import('./unified-entry/pages/PathChoicePage').then((m) => ({ default: m.PathChoicePage })));
const FlowStepRoute = lazy(() => import('./flow/FlowStepRoute').then((m) => ({ default: m.FlowStepRoute })));
const AvvGenerator = lazy(() => import('./pages/AvvGenerator').then((m) => ({ default: m.AvvGenerator })));
const CookieScanner = lazy(() => import('./pages/CookieScanner').then((m) => ({ default: m.CookieScanner })));
const ConsentTimingAnalysis = lazy(() => import('./pages/ConsentTimingAnalysis').then((m) => ({ default: m.ConsentTimingAnalysis })));
const Features = lazy(() => import('./pages/Features').then((m) => ({ default: m.Features })));
const RiskDashboard = lazy(() => import('./pages/RiskDashboard').then((m) => ({ default: m.RiskDashboard })));
const DokumenteBundle = lazy(() => import('./pages/DokumenteBundle').then((m) => ({ default: m.DokumenteBundle })));
const AiActWorkflows = lazy(() => import('./pages/AiActWorkflows').then((m) => ({ default: m.AiActWorkflows })));
const SaasLanding = lazy(() => import('./pages/niche/SaasLanding').then((m) => ({ default: m.SaasLanding })));
const AgenturenLanding = lazy(() => import('./pages/niche/AgenturenLanding').then((m) => ({ default: m.AgenturenLanding })));
const AgenturenConversionLanding = lazy(() => import('./pages/niche/AgenturenConversionLanding').then((m) => ({ default: m.AgenturenConversionLanding })));
const PraxenLanding = lazy(() => import('./pages/niche/PraxenLanding').then((m) => ({ default: m.PraxenLanding })));
const KanzleienLanding = lazy(() => import('./pages/niche/KanzleienLanding').then((m) => ({ default: m.KanzleienLanding })));
const ArztpraxenLanding = lazy(() => import('./pages/niche/ArztpraxenLanding').then((m) => ({ default: m.ArztpraxenLanding })));
const WordpressDsgvoLanding = lazy(() => import('./pages/niche/WordpressDsgvoLanding').then((m) => ({ default: m.WordpressDsgvoLanding })));
const ChatgptDsgvoLanding = lazy(() => import('./pages/niche/ChatgptDsgvoLanding').then((m) => ({ default: m.ChatgptDsgvoLanding })));
const ShopifyDsgvoLanding = lazy(() => import('./pages/niche/ShopifyDsgvoLanding').then((m) => ({ default: m.ShopifyDsgvoLanding })));
const VvtWizard = lazy(() => import('./pages/VvtWizard').then((m) => ({ default: m.VvtWizard })));
const AiActClassifier = lazy(() => import('./pages/AiActClassifier').then((m) => ({ default: m.AiActClassifier })));
const TomGenerator = lazy(() => import('./pages/TomGenerator').then((m) => ({ default: m.TomGenerator })));
const MeldepflichtTimer = lazy(() => import('./pages/MeldepflichtTimer').then((m) => ({ default: m.MeldepflichtTimer })));
const DatenschutzGenerator = lazy(() => import('./pages/DatenschutzGenerator').then((m) => ({ default: m.DatenschutzGenerator })));
const DsfaWizard = lazy(() => import('./pages/DsfaWizard').then((m) => ({ default: m.DsfaWizard })));
const BusseldRechner = lazy(() => import('./pages/BusseldRechner').then((m) => ({ default: m.BusseldRechner })));
const ToolsHub = lazy(() => import('./pages/ToolsHub').then((m) => ({ default: m.ToolsHub })));
const HealthTechLanding = lazy(() => import('./pages/HealthTechLanding').then((m) => ({ default: m.HealthTechLanding })));
const KmuWebsiteLanding = lazy(() => import('./pages/KmuWebsiteLanding').then((m) => ({ default: m.KmuWebsiteLanding })));
const Branchen = lazy(() => import('./pages/Branchen').then((m) => ({ default: m.Branchen })));
const IndustryDetail = lazy(() => import('./pages/branchen/IndustryDetail').then((m) => ({ default: m.IndustryDetail })));
const LegalTechLanding = lazy(() => import('./pages/LegalTechLanding').then((m) => ({ default: m.LegalTechLanding })));
const OneTrustAlternative = lazy(() => import('./pages/OneTrustAlternative').then((m) => ({ default: m.OneTrustAlternative })));
const FinTechLanding = lazy(() => import('./pages/FinTechLanding').then((m) => ({ default: m.FinTechLanding })));
const PublicSectorLanding = lazy(() => import('./pages/PublicSectorLanding').then((m) => ({ default: m.PublicSectorLanding })));
const UsercentricsAlternative = lazy(() => import('./pages/UsercentricsAlternative').then((m) => ({ default: m.UsercentricsAlternative })));
const DataGuardAlternative = lazy(() => import('./pages/DataGuardAlternative').then((m) => ({ default: m.DataGuardAlternative })));
const BorlabsAlternative = lazy(() => import('./pages/BorlabsAlternative').then((m) => ({ default: m.BorlabsAlternative })));
const CookiebotAlternative = lazy(() => import('./pages/CookiebotAlternative').then((m) => ({ default: m.CookiebotAlternative })));
const ProlianceAlternative = lazy(() => import('./pages/ProlianceAlternative').then((m) => ({ default: m.ProlianceAlternative })));
const InsuranceLanding = lazy(() => import('./pages/InsuranceLanding').then((m) => ({ default: m.InsuranceLanding })));
const EcommerceLanding = lazy(() => import('./pages/EcommerceLanding').then((m) => ({ default: m.EcommerceLanding })));
const About = lazy(() => import('./pages/About').then((m) => ({ default: m.About })));
const Manifest = lazy(() => import('./pages/Manifest').then((m) => ({ default: m.Manifest })));
const SkillsPage = lazy(() => import('./pages/SkillsPage').then((m) => ({ default: m.SkillsPage })));
const Press = lazy(() => import('./pages/Press').then((m) => ({ default: m.Press })));
const Security = lazy(() => import('./pages/Security').then((m) => ({ default: m.Security })));
const Trust = lazy(() => import('./pages/Trust').then((m) => ({ default: m.Trust })));
const PilotReadiness = lazy(() => import('./pages/PilotReadiness').then((m) => ({ default: m.PilotReadiness })));
const ShopifyIntegrationPage = lazy(() => import('./pages/integrations/Shopify').then((m) => ({ default: m.ShopifyIntegrationPage })));
const ShopifySuccessPage = lazy(() => import('./pages/integrations/ShopifySuccess').then((m) => ({ default: m.ShopifySuccessPage })));
const ShopifyErrorPage = lazy(() => import('./pages/integrations/ShopifyError').then((m) => ({ default: m.ShopifyErrorPage })));
const TelegramIntegrationPage = lazy(() => import('./pages/integrations/TelegramIntegration').then((m) => ({ default: m.TelegramIntegrationPage })));
const Developers = lazy(() => import('./pages/Developers').then((m) => ({ default: m.Developers })));
const AiActGovernancePage = lazy(() => import('./pages/content/AiActGovernancePage').then((m) => ({ default: m.AiActGovernancePage })));
const AgentGovernancePage = lazy(() => import('./pages/content/AgentGovernancePage').then((m) => ({ default: m.AgentGovernancePage })));
const GovernanceGraphPage = lazy(() => import('./pages/content/GovernanceGraphPage').then((m) => ({ default: m.GovernanceGraphPage })));
const EvidenceVaultPage = lazy(() => import('./pages/content/EvidenceVaultPage').then((m) => ({ default: m.EvidenceVaultPage })));
const PolicyEnginePage = lazy(() => import('./pages/content/PolicyEnginePage').then((m) => ({ default: m.PolicyEnginePage })));
const DeploymentGovernancePage = lazy(() => import('./pages/content/DeploymentGovernancePage').then((m) => ({ default: m.DeploymentGovernancePage })));
const Status = lazy(() => import('./pages/Status').then((m) => ({ default: m.Status })));
const Faq = lazy(() => import('./pages/Faq').then((m) => ({ default: m.Faq })));
const Changelog = lazy(() => import('./pages/Changelog').then((m) => ({ default: m.Changelog })));
const SaasAnbieterLanding = lazy(() => import('./pages/SaasAnbieterLanding').then((m) => ({ default: m.SaasAnbieterLanding })));
const Marktanalyse = lazy(() => import('./pages/Marktanalyse').then((m) => ({ default: m.Marktanalyse })));
const EducationLanding = lazy(() => import('./pages/EducationLanding').then((m) => ({ default: m.EducationLanding })));
const HrSoftwareLanding = lazy(() => import('./pages/HrSoftwareLanding').then((m) => ({ default: m.HrSoftwareLanding })));
const IubendaAlternative = lazy(() => import('./pages/IubendaAlternative').then((m) => ({ default: m.IubendaAlternative })));
const ApiDocs = lazy(() => import('./pages/ApiDocs').then((m) => ({ default: m.ApiDocs })));
const Integrations = lazy(() => import('./pages/Integrations').then((m) => ({ default: m.Integrations })));
const SteuerberaterLanding = lazy(() => import('./pages/SteuerberaterLanding').then((m) => ({ default: m.SteuerberaterLanding })));
const PartnersPage = lazy(() => import('./pages/PartnersPage').then((m) => ({ default: m.PartnersPage })));
const BaitCompliance = lazy(() => import('./pages/seo/BaitCompliance').then((m) => ({ default: m.BaitCompliance })));
const MariskAudit = lazy(() => import('./pages/seo/MariskAudit').then((m) => ({ default: m.MariskAudit })));
const EuAiActCheck = lazy(() => import('./pages/seo/EuAiActCheck').then((m) => ({ default: m.EuAiActCheck })));
const CookieCompliance = lazy(() => import('./pages/seo/CookieCompliance').then((m) => ({ default: m.CookieCompliance })));
const PricingPage = lazy(() => import('./features/billing/PricingPage').then((m) => ({ default: m.PricingPage })));
const WhatsAppPricingPage = lazy(() => import('./pages/WhatsAppPricingPage').then((m) => ({ default: m.WhatsAppPricingPage })));
const CheckoutPage = lazy(() => import('./features/billing/CheckoutPage').then((m) => ({ default: m.CheckoutPage })));
const CheckoutCancelledPage = lazy(() => import('./features/billing/CheckoutCancelledPage').then((m) => ({ default: m.CheckoutCancelledPage })));
const PricingDetailPageWrapper = lazy(() => import('./pages/pricing/PricingDetailPage').then((m) => ({ default: m.PricingDetailPageWrapper })));
const FeatureDetailPageWrapper = lazy(() => import('./pages/pricing/FeatureDetailPage').then((m) => ({ default: m.FeatureDetailPageWrapper })));
const PrivacyPolicy = lazy(() => import('./features/legal/PrivacyPolicy').then((m) => ({ default: m.PrivacyPolicy })));
const SubProcessors = lazy(() => import('./features/legal/SubProcessors').then((m) => ({ default: m.SubProcessors })));
const Impressum = lazy(() => import('./features/legal/Impressum').then((m) => ({ default: m.Impressum })));
const AVVTemplate = lazy(() => import('./features/legal/AVVTemplate').then((m) => ({ default: m.AVVTemplate })));
const ComplianceMatrix = lazy(() => import('./features/legal/ComplianceMatrix').then((m) => ({ default: m.ComplianceMatrix })));
const LegalMethodology = lazy(() => import('./features/legal/LegalMethodology').then((m) => ({ default: m.LegalMethodology })));
const LegalTerms = lazy(() => import('./features/legal/LegalTerms').then((m) => ({ default: m.LegalTerms })));
const Widerrufsbelehrung = lazy(() => import('./features/legal/Widerrufsbelehrung').then((m) => ({ default: m.Widerrufsbelehrung })));
const StripeOAuthCallback = lazy(() => import('./pages/integrations/StripeOAuthCallback').then((m) => ({ default: m.StripeOAuthCallback })));
const CheckoutSuccess = lazy(() => import('./pages/CheckoutSuccess').then((m) => ({ default: m.CheckoutSuccess })));
const Limits = lazy(() => import('./pages/Limits').then((m) => ({ default: m.Limits })));
const AiGovernancePage = lazy(() => import('./pages/AiGovernancePage').then((m) => ({ default: m.AiGovernancePage })));

const SetupAssistant = lazy(() => import('./features/onboarding/SetupAssistant').then((m) => ({ default: m.SetupAssistant })));
// ── Phase 2: Dashboard Router (Adaptive based on tier)
const DashboardRouter = lazy(() => import('./features/governance/dashboard/DashboardRouter').then((m) => ({ default: m.DashboardRouter })));
const GovernanceAiWorkspace = lazy(() => import('./features/governance/dashboard/GovernanceAiWorkspace').then((m) => ({ default: m.GovernanceAiWorkspace })));
// ── SMB Experience Layer: vereinfachte Business-Ansicht für Einzelunternehmer.
//    Konsumiert nur bestehende Services (siehe src/features/smb/README.md).
const SmbDashboardView = lazy(() => import('./features/smb/SmbDashboardView').then((m) => ({ default: m.SmbDashboardView })));
// ── Modul-Hub: Capability-Übersicht des Workspaces (Aktivieren/Öffnen je Entitlement)
const ModulesHubView = lazy(() => import('./features/modules/ModulesHubView').then((m) => ({ default: m.ModulesHubView })));
const GovernanceActivationView = lazy(() =>
  import('./features/activation/GovernanceActivationView').then((m) => ({ default: m.GovernanceActivationView })),
);
// ── Phase 3: Advanced Governance Views
const ComplianceFrameworkSelector = lazy(() => import('./features/governance/dashboard/ComplianceFrameworkSelector').then((m) => ({ default: m.ComplianceFrameworkSelector })));
const Iso42001ComplianceHub = lazy(() => import('./features/governance/dashboard/Iso42001ComplianceHub').then((m) => ({ default: m.Iso42001ComplianceHub })));
// BusinessDashboard zieht recharts → aus dem Landing-Critical-Path lazyen.
const BusinessDashboard = lazy(() => import('./pages/BusinessDashboard').then((m) => ({ default: m.BusinessDashboard })));

// Auth-gated Features → lazy. Reduzieren Initial-Bundle für public Landing.
const KodeeView = lazy(() => import('./features/kodee/KodeeView').then((m) => ({ default: m.KodeeView })));
const ConnectionsView = lazy(() => import('./features/kodee/connections/ConnectionsView').then((m) => ({ default: m.ConnectionsView })));
const UsageView = lazy(() => import('./features/billing/UsageView').then((m) => ({ default: m.UsageView })));
const BillingView = lazy(() => import('./features/billing/BillingView').then((m) => ({ default: m.BillingView })));
const GovernanceAlertsView = lazy(() => import('./features/governance/AlertsView').then((m) => ({ default: m.AlertsView })));
const ComplianceAlertRulesView = lazy(() => import('./features/governance/ComplianceAlertRulesView').then((m) => ({ default: m.ComplianceAlertRulesView })));
const ComplianceMonitoringDashboard = lazy(() => import('./features/governance/ComplianceMonitoringDashboard').then((m) => ({ default: m.ComplianceMonitoringDashboard })));
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
const SiteOsDashboardView = lazy(() => import('./features/siteos/SiteOsDashboardView').then((m) => ({ default: m.SiteOsDashboardView })));
// Der SiteOS-Builder (Prompt → Blueprint → Vorschau). Die Oberflaeche lag
// seit ihrer Entstehung ohne Route im Repo — fertiger Code, den niemand
// erreichen konnte (CLAUDE.md §14).
const SiteOsBuilderPage = lazy(() => import('./unified-entry/pages/PreviewSelectionPage'));
// App Builder Workspace: Topbar · Projekt-Navigation · Puck-Leinwand ·
// Assistent · Konsole/Probleme/Verlauf/Governance. Lazy aus demselben Grund
// wie der Editor: Puck gehört nicht in den kritischen Pfad.
const AppBuilderWorkspacePage = lazy(() => import('./features/siteos/workspace/AppBuilderWorkspacePage'));
// Build Studio: Prompt → vollständige Website → Live-Vorschau, ohne Konto.
//
// Abweichung von der Regel „Public Pages eager" (CLAUDE.md §7): Diese Seite
// ist kein Inhalts-, sondern ein Werkzeugeinstieg — sie trägt keinen Text,
// den eine Suchmaschine indexieren soll, und zieht mit `packages/siteos-core`
// Blueprint-Synthese, Analyse und Renderer in ihr Bündel. Eager importiert
// läge das im kritischen Pfad jeder Landingpage.
const BuildStudioPage = lazy(() => import('./unified-entry/pages/BuildStudioPage'));
const SiteOsClaimView = lazy(() => import('./features/siteos/SiteOsClaimView').then((m) => ({ default: m.SiteOsClaimView })));
const LegalRagView = lazy(() => import('./features/legal-rag/LegalRagView').then((m) => ({ default: m.LegalRagView })));
const AgentOsAdminPage = lazy(() => import('./features/agent-os-admin/AgentOsAdminPage').then((m) => ({ default: m.AgentOsAdminPage })));
const GovernanceDashboardView = lazy(() => import('./features/governance/GovernanceDashboardView').then((m) => ({ default: m.GovernanceDashboardView })));
// Cloud Code Optimizer — öffentlicher Page-by-Page-Flow (Phase 1), lazy geladen.
const OptimizerLanding = lazy(() => import('./pages/optimizer/OptimizerLanding').then((m) => ({ default: m.OptimizerLanding })));
const OptimizerScan = lazy(() => import('./pages/optimizer/OptimizerScan').then((m) => ({ default: m.OptimizerScan })));
const OptimizerScanning = lazy(() => import('./pages/optimizer/OptimizerScanning').then((m) => ({ default: m.OptimizerScanning })));
const OptimizerResults = lazy(() => import('./pages/optimizer/OptimizerResults').then((m) => ({ default: m.OptimizerResults })));
// Cloud Code Optimizer — Phase 2 (Auth, Pricing, Dashboard).
const OptimizerAuth = lazy(() => import('./pages/optimizer/OptimizerAuth').then((m) => ({ default: m.OptimizerAuth })));
const OptimizerVerify = lazy(() => import('./pages/optimizer/OptimizerVerify').then((m) => ({ default: m.OptimizerVerify })));
const OptimizerPricing = lazy(() => import('./pages/optimizer/OptimizerPricing').then((m) => ({ default: m.OptimizerPricing })));
const OptimizerDashboard = lazy(() => import('./pages/optimizer/OptimizerDashboard').then((m) => ({ default: m.OptimizerDashboard })));
// Cloud Code Optimizer — Phase 3 (Checkout-Handoff, Auto-Optimizer).
const OptimizerCheckout = lazy(() => import('./pages/optimizer/OptimizerCheckout').then((m) => ({ default: m.OptimizerCheckout })));
const OptimizerOptimizing = lazy(() => import('./pages/optimizer/OptimizerOptimizing').then((m) => ({ default: m.OptimizerOptimizing })));
const OptimizerComplete = lazy(() => import('./pages/optimizer/OptimizerComplete').then((m) => ({ default: m.OptimizerComplete })));
const WebsiteGovernanceView = lazy(() => import('./features/governance/websites/WebsiteGovernanceView').then((m) => ({ default: m.WebsiteGovernanceView })));
// ── Phase 2: Multi-Framework Governance Views (10 new modules)
const AiRegisterView = lazy(() => import('./features/governance/AiRegisterView').then((m) => ({ default: m.AiRegisterView })));
const DsgvoDirectoryView = lazy(() => import('./features/governance/DsgvoDirectoryView').then((m) => ({ default: m.DsgvoDirectoryView })));
const AiActRiskAssessmentView = lazy(() => import('./features/governance/AiActRiskAssessmentView').then((m) => ({ default: m.AiActRiskAssessmentView })));
const IndustrialOtWizardView = lazy(() => import('./features/governance/IndustrialOtWizardView').then((m) => ({ default: m.IndustrialOtWizardView })));
const Nis2IncidentsView = lazy(() => import('./features/governance/Nis2IncidentsView').then((m) => ({ default: m.Nis2IncidentsView })));
const Iso27001ControlsView = lazy(() => import('./features/governance/Iso27001ControlsView').then((m) => ({ default: m.Iso27001ControlsView })));
const Iso42001View = lazy(() => import('./features/governance/Iso42001View').then((m) => ({ default: m.Iso42001View })));
const Iso42001ControlDetailView = lazy(() => import('./features/governance/Iso42001ControlDetailView').then((m) => ({ default: m.Iso42001ControlDetailView })));
const CertificationReadinessDashboard = lazy(() => import('./features/governance/CertificationReadinessDashboard').then((m) => ({ default: m.CertificationReadinessDashboard })));
const Iso42001ControlsLibraryView = lazy(() => import('./features/governance/Iso42001ControlsLibraryView').then((m) => ({ default: m.Iso42001ControlsLibraryView })));
const AuditorEngagementView = lazy(() => import('./features/governance/AuditorEngagementView').then((m) => ({ default: m.AuditorEngagementView })));
const CertificationReportGeneratorView = lazy(() => import('./features/governance/CertificationReportGeneratorView').then((m) => ({ default: m.CertificationReportGeneratorView })));
const Iso42001CertificationHubView = lazy(() => import('./features/governance/Iso42001CertificationHubView').then((m) => ({ default: m.Iso42001CertificationHubView })));
const Iso42001EvidenceVaultView = lazy(() => import('./features/governance/Iso42001EvidenceVaultView').then((m) => ({ default: m.Iso42001EvidenceVaultView })));
const MemoryGovernanceView = lazy(() => import('./features/governance/MemoryGovernanceView').then((m) => ({ default: m.MemoryGovernanceView })));
const Iso42001GapAnalysisView = lazy(() => import('./features/governance/Iso42001GapAnalysisView').then((m) => ({ default: m.Iso42001GapAnalysisView })));
const Iso42001RemediationWorkflowView = lazy(() => import('./features/governance/Iso42001RemediationWorkflowView').then((m) => ({ default: m.Iso42001RemediationWorkflowView })));
const Iso42001MaintenanceView = lazy(() => import('./features/governance/Iso42001MaintenanceView').then((m) => ({ default: m.Iso42001MaintenanceView })));
const GapAnalysisView = lazy(() => import('./features/governance/GapAnalysisView').then((m) => ({ default: m.GapAnalysisView })));
const EvidenceVaultAdvancedViewNew = lazy(() => import('./features/governance/EvidenceVaultAdvancedView').then((m) => ({ default: m.EvidenceVaultAdvancedView })));
const RemediationPlanViewNew = lazy(() => import('./features/governance/RemediationPlanView').then((m) => ({ default: m.RemediationPlanView })));
const AuditReportAdvancedViewNew = lazy(() => import('./features/governance/AuditReportAdvancedView').then((m) => ({ default: m.AuditReportAdvancedView })));
const GovernanceApiKeysView = lazy(() => import('./features/governance/GovernanceApiKeysView').then((m) => ({ default: m.GovernanceApiKeysView })));
const GovernanceWorkflowRecommendation = lazy(() => import('./features/governance/GovernanceWorkflowRecommendation').then((m) => ({ default: m.GovernanceWorkflowRecommendation })));
// ── Phase 5A: ISO Templates & Advanced Reporting (3 new views)
const IsoControlLibraryView = lazy(() => import('./features/governance/IsoControlLibraryView').then((m) => ({ default: m.IsoControlLibraryView })));
const ReportBuilderView = lazy(() => import('./features/governance/reporting/AdvancedReportingView').then((m) => ({ default: m.AdvancedReportingView })));
const ComplianceRoadmapView = lazy(() => import('./features/governance/ComplianceRoadmapView').then((m) => ({ default: m.ComplianceRoadmapView })));
// ── Phase 5B: Custom Frameworks & Integrations (3 new views)
const CustomFrameworkBuilderView = lazy(() => import('./features/governance/frameworks/CustomFrameworkBuilder').then((m) => ({ default: m.CustomFrameworkBuilder })));
const CustomFrameworkView = lazy(() => import('./features/governance/CustomFrameworkView').then((m) => ({ default: m.CustomFrameworkView })));
const IntegrationsView = lazy(() => import('./features/governance/IntegrationsView').then((m) => ({ default: m.IntegrationsView })));
// ── Phase 5C: Analytics, Bulk Operations, Collaboration (5 new views)
const ComplianceAnalyticsView = lazy(() => import('./features/governance/ComplianceAnalyticsView').then((m) => ({ default: m.ComplianceAnalyticsView })));
const BulkOperationsView = lazy(() => import('./features/governance/BulkOperationsView').then((m) => ({ default: m.BulkOperationsView })));
const ComplianceCalendarView = lazy(() => import('./features/governance/ComplianceCalendarView').then((m) => ({ default: m.ComplianceCalendarView })));
const AuditTrailView = lazy(() => import('./features/governance/AuditTrailView').then((m) => ({ default: m.AuditTrailView })));
const GovernanceTeamView = lazy(() => import('./features/governance/GovernanceTeamView').then((m) => ({ default: m.GovernanceTeamView })));
const GovernanceWebhooksView = lazy(() => import('./features/governance/webhooks/WebhooksView').then((m) => ({ default: m.WebhooksView })));
const GovernanceTerminalView = lazy(() => import('./features/governance/terminal/TerminalSessionDashboard').then((m) => ({ default: m.TerminalSessionDashboard })));
const GovernanceOnboardingView = lazy(() => import('./features/governance/OnboardingView').then((m) => ({ default: m.OnboardingView })));
const GovernanceMappingsView = lazy(() => import('./features/governance/MappingsView').then((m) => ({ default: m.MappingsView })));
const GovernanceEventDetailView = lazy(() => import('./features/governance/EventDetailView').then((m) => ({ default: m.EventDetailView })));
const GovernanceAssetDetailView = lazy(() => import('./features/governance/AssetDetailView').then((m) => ({ default: m.AssetDetailView })));
const GovernanceApprovalsView = lazy(() => import('./features/governance/ApprovalsView').then((m) => ({ default: m.ApprovalsView })));
const GovernanceAdminLogView = lazy(() => import('./features/governance/AdminLogView').then((m) => ({ default: m.AdminLogView })));
const GovernanceApprovalGatesView = lazy(() => import('./features/governance/ApprovalGatesView').then((m) => ({ default: m.ApprovalGatesView })));
const GovernanceHomeView = lazy(() => import('./features/governance/GovernanceHomeView').then((m) => ({ default: m.GovernanceHomeView })));
const GovernanceEvidenceIntegrityView = lazy(() => import('./features/governance/EvidenceIntegrityView').then((m) => ({ default: m.EvidenceIntegrityView })));
const GovernanceConnectorRegistryView = lazy(() => import('./features/governance/ConnectorRegistryView').then((m) => ({ default: m.ConnectorRegistryView })));
const GovernanceShadowReadinessView = lazy(() => import('./features/governance/ShadowReadinessView').then((m) => ({ default: m.ShadowReadinessView })));
const GovernanceRouterView = lazy(() => import('./features/governance/GovernanceRouterView').then((m) => ({ default: m.GovernanceRouterView })));
const GovernanceMicrosoft365View = lazy(() => import('./features/governance/Microsoft365View').then((m) => ({ default: m.Microsoft365View })));
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
const WhatsAppChannelsView      = lazy(() => import('./features/bots/WhatsAppChannelsView').then((m) => ({ default: m.WhatsAppChannelsView })));
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
const ApiSetupWizard = lazy(() => import('./features/api/ApiSetupWizard').then((m) => ({ default: m.ApiSetupWizard })));
const ApiDocumentation = lazy(() => import('./features/api/ApiDocumentation').then((m) => ({ default: m.ApiDocumentation })));
const ApiMonitoringDashboard = lazy(() => import('./features/api/ApiMonitoringDashboard').then((m) => ({ default: m.ApiMonitoringDashboard })));
const AdvancedMonitoringDashboard = lazy(() => import('./features/api/AdvancedMonitoringDashboard').then((m) => ({ default: m.AdvancedMonitoringDashboard })));
const EmailTemplateManager = lazy(() => import('./features/api/EmailTemplateManager').then((m) => ({ default: m.EmailTemplateManager })));
const WebhookRetryManagement = lazy(() => import('./features/api/WebhookRetryManagement').then((m) => ({ default: m.WebhookRetryManagement })));
const WebhookTester = lazy(() => import('./features/api/WebhookTester').then((m) => ({ default: m.WebhookTester })));
const RateLimitingAnalytics = lazy(() => import('./features/api/RateLimitingAnalytics').then((m) => ({ default: m.RateLimitingAnalytics })));
const SettingsView = lazy(() => import('./features/settings/SettingsView').then((m) => ({ default: m.SettingsView })));
const SecuritySettings = lazy(() => import('./features/settings/SecuritySettings').then((m) => ({ default: m.SecuritySettings })));
const TenantAdminConsole = lazy(() => import('./features/tenants/TenantAdminConsole').then((m) => ({ default: m.TenantAdminConsole })));
const CeoCockpitView = lazy(() => import('./features/governance/cockpit/CeoCockpitView').then((m) => ({ default: m.CeoCockpitView })));
const CeoBriefPrintView = lazy(() => import('./features/governance/cockpit/CeoBriefPrintView').then((m) => ({ default: m.CeoBriefPrintView })));
const WorkspaceEmbed = lazy(() => import('./features/workspace/WorkspaceEmbed').then((m) => ({ default: m.WorkspaceEmbed })));
const CompanyView = lazy(() => import('./features/company/CompanyView').then((m) => ({ default: m.CompanyView })));
const WorkflowsView = lazy(() => import('./features/workflows/WorkflowsView').then((m) => ({ default: m.WorkflowsView })));
const MarketGapsView = lazy(() => import('./features/market/MarketGapsView').then((m) => ({ default: m.MarketGapsView })));
const MarketplaceView = lazy(() => import('./features/market/MarketplaceView').then((m) => ({ default: m.MarketplaceView })));
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
// ── SEO-Marketing-SaaS-Dashboard (auth-gated)
const SEOMarketingDashboard = lazy(() => import('./features/seo-marketing-dashboard/SEOMarketingDashboard').then((m) => ({ default: m.SEOMarketingDashboard })));
// ── OAuth Callbacks (public, no auth required)
// ── Enterprise OS Prototype (/os, /os/app/*) — Phase 1 Foundation:
// neues Designsystem + Enterprise-Shell, Mockdaten, kein Backend-Zugriff. ──
const EnterpriseLandingPage = lazy(() => import('./enterprise-os/pages/LandingPage').then((m) => ({ default: m.LandingPage })));
const EnterpriseAppShell = lazy(() => import('./enterprise-os/layout/AppShell').then((m) => ({ default: m.AppShell })));
const EnterpriseAppHomePage = lazy(() => import('./enterprise-os/pages/AppHomePage').then((m) => ({ default: m.AppHomePage })));
const EnterprisePlaceholderPage = lazy(() => import('./enterprise-os/pages/PlaceholderPage').then((m) => ({ default: m.PlaceholderPage })));
// Phase 2 — Public Pages (Pricing, Audit, AI Governance, Agenturen, Legal, Checkout)
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

const AutomationAgentPage = lazy(() => import('./features/agents/AutomationAgentPage').then((m) => ({ default: m.AutomationAgentPage })));
const SupportAgentPage = lazy(() => import('./features/agents/SupportAgentPage').then((m) => ({ default: m.SupportAgentPage })));
const CallAgentSusiPage = lazy(() => import('./features/agents/CallAgentSusiPage').then((m) => ({ default: m.CallAgentSusiPage })));
const ScreenshotAgentPage = lazy(() => import('./features/agents/ScreenshotAgentPage').then((m) => ({ default: m.ScreenshotAgentPage })));
const DashboardView = lazy(() => import('./features/dashboard/DashboardView').then((m) => ({ default: m.DashboardView })));
// ── Claude Code Optimizer — geführter Flow (Überblick → Scan → Ergebnis → Anmeldung → Bericht) ──
const OptimizerOverview = lazy(() => import('./pages/claude-code-optimizer').then((m) => ({ default: m.OptimizerOverview })));
const OptimizerResult = lazy(() => import('./pages/claude-code-optimizer').then((m) => ({ default: m.OptimizerResult })));
const OptimizerSignup = lazy(() => import('./pages/claude-code-optimizer').then((m) => ({ default: m.OptimizerSignup })));
const OptimizerReport = lazy(() => import('./pages/claude-code-optimizer').then((m) => ({ default: m.OptimizerReport })));
// CheckoutPage already imported at line 112 (PR #290) — duplicate removed.
import { CookieConsent } from './components/CookieConsent';
import { ScrollToTop } from './components/ScrollToTop';
import { GovernanceBrowserShell } from './components/governance-os/GovernanceBrowserShell';
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
          {/* Demo Routes — mock surfaces. /demo-login → canonical /welcome. */}
          <Route path="/demo-landing" element={<DemoLandingPage />} />
      <Route path="/demo-login" element={<Navigate to="/welcome?next=/app/dashboard" replace />} />
          <Route
            path="/demo-app"
            element={
              <ProtectedRoute>
                <DemoGovernanceDashboard />
              </ProtectedRoute>
            }
          />

          {/* Demo Tour — Complete Product Tour Flow (no auth required) */}
          <Route path="/demo-tour" element={<DemoTourProvider><DemoTourStartPage /></DemoTourProvider>} />
          <Route path="/demo-tour/signup" element={<DemoTourProvider><DemoTourSignupPage /></DemoTourProvider>} />
          <Route path="/demo-tour/checkout" element={<DemoTourProvider><DemoTourCheckoutPage /></DemoTourProvider>} />
          <Route path="/demo-tour/dashboard" element={<DemoTourProvider><DemoTourDashboard /></DemoTourProvider>} />
      {/* Public — Startseite ist die Governance-OS-Workspace-Vorschau;
          die Marketing-Landing bleibt unter /landing erreichbar. */}
      <Route path="/" element={<MainLanding />} />

      {/* Design previews — do NOT replace live `/`. Honest Preview surfaces. */}
      <Route path="/design/ledger" element={<DesignLedgerLanding />} />
      <Route path="/design/tribunal" element={<DesignTribunalLanding />} />

      {/* Der kanonische Scan-Einstieg ist `/audit` (siehe
          docs/product/canonical-funnel-decision.md). `/scan` gab es kurzzeitig
          als zweiten Trichter mit eigenem Datensatz; er ist mit dem Schnitt
          von PR #1129 entfallen, damit es genau einen Einstieg gibt. */}
      <Route path="/scan" element={<Navigate to="/audit" replace />} />

      {/* Product Entry Points */}
      <Route path="/scan/start" element={<ScanStartPage />} />
      <Route path="/chatbot/start" element={<ChatbotStartPage />} />
      <Route path="/phonebot/start" element={<PhonebotStartPage />} />
      <Route path="/aetheros" element={<AetherOSLanding />} />
      <Route path="/preview" element={<PublicWorkspacePreview />} />
      <Route path="/landing" element={<Landing />} />
      <Route path="/landingpages" element={<LandingPagesOverview />} />
      <Route path="/landing-uebersicht" element={<LandingPagesOverview />} />
      <Route path="/realsync-landing" element={<RealSyncDynamicsLanding />} />
      <Route path="/enterprise-konfigurator" element={<EnterpriseKonfigurator />} />
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
      {/* Warteliste. /waitlist ist das englische Alias und leitet weiter —
          serverseitig via public/_redirects (301), hier fuer die
          Client-Navigation. Kein zweiter Renderpfad, kein Duplicate Content. */}
      <Route path="/warteliste" element={<WaitlistLanding />} />
      <Route path="/waitlist"   element={<Navigate to="/warteliste" replace />} />
      <Route path="/docs"       element={<DocsRuntimePage />} />
      <Route path="/agencies" element={<AgenciesLanding />} />
      <Route path="/audit" element={<AuditLanding />} />
      {/* Cloud Code Optimizer — Page-by-Page-Flow (Phase 1) */}
      <Route path="/optimizer" element={<OptimizerLanding />} />
      <Route path="/optimizer/scan" element={<OptimizerScan />} />
      <Route path="/optimizer/scanning" element={<OptimizerScanning />} />
      <Route path="/optimizer/results" element={<OptimizerResults />} />
      <Route path="/optimizer/auth" element={<OptimizerAuth />} />
      <Route path="/optimizer/auth/verify" element={<OptimizerVerify />} />
      <Route path="/optimizer/pricing" element={<OptimizerPricing />} />
      <Route path="/optimizer/dashboard" element={<OptimizerDashboard />} />
      <Route path="/optimizer/checkout" element={<OptimizerCheckout />} />
      <Route path="/optimizer/optimizing" element={<OptimizerOptimizing />} />
      <Route path="/optimizer/complete" element={<OptimizerComplete />} />
      <Route path="/automations" element={<AutomationsLanding />} />
      <Route path="/cookie-scanner" element={<CookieScanner />} />
      <Route path="/tools/cookie-scanner" element={<CookieScanner />} />
      {/* Route-Pfad stammt aus dem Datei-Kommentar der Seite; Quick-Scan ist Free-Tier. */}
      <Route path="/consent-timing" element={<ConsentTimingAnalysis />} />
      <Route path="/tools/consent-timing" element={<ConsentTimingAnalysis />} />
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
      <Route path="/onboarding-erklaert" element={<OnboardingErklaert />} />
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
      <Route path="/kontakt" element={<KontaktPage />} />
      <Route path="/contact" element={<Navigate to="/kontakt" replace />} />
      <Route path="/enterprise" element={<EnterpriseLanding />} />
      {/* Enterprise AI OS — Founding Access + Dashboard */}
      <Route path="/enterprise-ai-os" element={<EnterpriseAiOs />} />
      <Route path="/enterprise-ai-os/founding-access" element={<EnterpriseAiOsFoundingAccess />} />
      <Route path="/dashboard/enterprise-ai-os" element={<EnterpriseAiOsDashboard />} />
      {/* AI Command Center — Aliase der Workspace-Fläche, nicht mehr eine
          eigene Chat-Seite. /assistant und /dashboard sind dieselbe Fläche. */}
      <Route path="/command-center" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="/ai-command-center" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="/command-center/showcase" element={<AiCommandCenterShowcase />} />
      <Route path="/dashboard/enterprise-ai-os/discovery" element={<EnterpriseAiOsDiscovery />} />
      {/* Onboarding nach Stripe-Checkout */}
      <Route path="/checkout/success" element={<CheckoutSuccess />} />
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/setup" element={<Welcome />} />
      {/* Phase 2: Free Tier Setup Assistant (3-step wizard) */}
      <Route path="/setup-assistant" element={<AppGate><SetupAssistant /></AppGate>} />
      {/* Tools Hub */}
      <Route path="/tools" element={<ToolsHub />} />
      {/* Claude Code Optimizer — geführter, seitenweiser Flow.
          Jeder Schritt ist eine eigene Route; /cloud-code-optimizer ist ein Alias. */}
      <Route path="/claude-code-optimizer" element={<OptimizerOverview />} />
      <Route path="/claude-code-optimizer/scan" element={<OptimizerScan />} />
      <Route path="/claude-code-optimizer/ergebnis" element={<OptimizerResult />} />
      <Route path="/claude-code-optimizer/anmelden" element={<OptimizerSignup />} />
      <Route path="/claude-code-optimizer/bericht" element={<OptimizerReport />} />
      <Route path="/cloud-code-optimizer" element={<Navigate to="/claude-code-optimizer" replace />} />
      {/* Industry-Doorways */}
      <Route path="/branchen" element={<Branchen />} />
      <Route path="/branchen/:slug" element={<IndustryDetail />} />
      <Route path="/healthtech" element={<HealthTechLanding />} />
      {/* Website + Chat-/Telefon-Assistent für kleine Betriebe (Handwerk, Praxen, Kanzleien) */}
      <Route path="/handwerk-website" element={<KmuWebsiteLanding />} />
      <Route path="/kmu-website" element={<Navigate to="/handwerk-website" replace />} />
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
      <Route path="/integrations/stripe/callback" element={<StripeOAuthCallback />} />
      <Route path="/shopify/success" element={<ShopifySuccessPage />} />
      <Route path="/shopify/error" element={<ShopifyErrorPage />} />
      <Route path="/app/settings/integrations/telegram" element={<AppGate><TelegramIntegrationPage /></AppGate>} />
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
          Dashboard ist Compliance-Status; Assistent liegt unter /app/assistant. */}
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
      {/* SMB Experience Layer — vereinfachte Ansicht für Einzelunternehmer/kleine
          Unternehmen. Zusätzliche Sicht auf dieselben Services; die
          Enterprise-Ansicht (/app/dashboard) bleibt unverändert. */}
      <Route path="/app/mein-geschaeft" element={<AppGate><SmbDashboardView /></AppGate>} />
      <Route path="/app/simple" element={<Navigate to="/app/mein-geschaeft" replace />} />
      <Route path="/app/intelligence" element={<AppGate><ProtectedRoute><DashboardView /></ProtectedRoute></AppGate>} />
      {/* Liest tenant_users/monitored_domains — Tenant-Daten, daher auth-gegatet. */}
      <Route path="/app/risk" element={<AppGate><ProtectedRoute><RiskDashboard /></ProtectedRoute></AppGate>} />
      {/* DashboardRouter rendert den live Compliance-Status (kein Chat-Default). */}
      <Route path="/app/dashboard" element={<AppGate><GovernanceBrowserShell><DashboardRouter /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/assistant" element={<AppGate><GovernanceAiWorkspace /></AppGate>} />
      <Route path="/app/cockpit" element={<AppGate><GovernanceBrowserShell><CeoCockpitView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/cockpit/brief" element={<AppGate><CeoBriefPrintView /></AppGate>} />
      <Route path="/app/seo-marketing-dashboard" element={<AppGate><GovernanceBrowserShell><SEOMarketingDashboard /></GovernanceBrowserShell></AppGate>} />
      {/* Marketplace: zubuchbare Dienste mit ihrem tatsaechlichen Zustand.
          Liest die Entitlements des Mandanten, daher auth-gegatet. */}
      <Route path="/app/marketplace" element={<AppGate><GovernanceBrowserShell><MarketplaceView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/overview" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="/app/modules" element={<AppGate><GovernanceBrowserShell><ModulesHubView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/activation" element={<AppGate><GovernanceBrowserShell><GovernanceActivationView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/home" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="/app/company" element={<AppGate><GovernanceBrowserShell><CompanyView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/websites" element={<AppGate><GovernanceBrowserShell><WebsiteGovernanceView /></GovernanceBrowserShell></AppGate>} />
      {/* Phase 2 Governance Views: Multi-Framework Compliance */}
      <Route path="/app/governance/ai-register" element={<AppGate><GovernanceBrowserShell><AiRegisterView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/dsgvo-directory" element={<AppGate><GovernanceBrowserShell><DsgvoDirectoryView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/ai-act-assessment" element={<AppGate><GovernanceBrowserShell><AiActRiskAssessmentView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/industrial-ot" element={<AppGate><GovernanceBrowserShell><IndustrialOtWizardView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/memory" element={<AppGate><GovernanceBrowserShell><MemoryGovernanceView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/nis2-incidents" element={<AppGate><GovernanceBrowserShell><Nis2IncidentsView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/iso27001" element={<AppGate><GovernanceBrowserShell><Iso27001ControlsView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/iso42001-hub" element={<AppGate><GovernanceBrowserShell><Iso42001CertificationHubView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/iso42001" element={<AppGate><GovernanceBrowserShell><Iso42001View /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/iso42001-readiness" element={<AppGate><GovernanceBrowserShell><CertificationReadinessDashboard /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/iso42001-library" element={<AppGate><GovernanceBrowserShell><Iso42001ControlsLibraryView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/iso42001-auditors" element={<AppGate><GovernanceBrowserShell><AuditorEngagementView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/iso42001-reports" element={<AppGate><GovernanceBrowserShell><CertificationReportGeneratorView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/iso42001-evidence" element={<AppGate><GovernanceBrowserShell><Iso42001EvidenceVaultView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/iso42001-gaps" element={<AppGate><GovernanceBrowserShell><Iso42001GapAnalysisView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/iso42001-remediation" element={<AppGate><GovernanceBrowserShell><Iso42001RemediationWorkflowView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/iso42001-maintenance" element={<AppGate><GovernanceBrowserShell><Iso42001MaintenanceView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/iso42001/:controlId" element={<AppGate><GovernanceBrowserShell><Iso42001ControlDetailView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/gaps" element={<AppGate><GovernanceBrowserShell><GapAnalysisView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/evidence-vault-advanced" element={<AppGate><GovernanceBrowserShell><EvidenceVaultAdvancedViewNew /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/remediation-plans" element={<AppGate><GovernanceBrowserShell><RemediationPlanViewNew /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/audit-reports" element={<AppGate><GovernanceBrowserShell><AuditReportAdvancedViewNew /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/api-keys" element={<AppGate><GovernanceBrowserShell><GovernanceApiKeysView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/recommendation" element={<AppGate><GovernanceWorkflowRecommendation /></AppGate>} />
      {/* Phase 3: Advanced Governance Views */}
      <Route path="/app/governance/frameworks" element={<AppGate><ComplianceFrameworkSelector /></AppGate>} />
      <Route path="/app/governance/iso-42001-hub" element={<AppGate><GovernanceBrowserShell><Iso42001ComplianceHub /></GovernanceBrowserShell></AppGate>} />
      {/* Phase 5A: ISO Templates & Advanced Reporting */}
      <Route path="/app/governance/iso-control-library" element={<AppGate><GovernanceBrowserShell><IsoControlLibraryView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/report-builder" element={<AppGate><GovernanceBrowserShell><ReportBuilderView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/compliance-roadmap" element={<AppGate><GovernanceBrowserShell><ComplianceRoadmapView /></GovernanceBrowserShell></AppGate>} />
      {/* Phase 5B: Custom Frameworks & Integrations */}
      <Route path="/app/governance/custom-framework-builder" element={<AppGate><GovernanceBrowserShell><CustomFrameworkBuilderView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/custom-frameworks" element={<AppGate><GovernanceBrowserShell><CustomFrameworkView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/integrations" element={<AppGate><GovernanceBrowserShell><IntegrationsView /></GovernanceBrowserShell></AppGate>} />
      {/* Phase 5C: Analytics, Bulk Operations, Collaboration */}
      <Route path="/app/governance/compliance-analytics" element={<AppGate><GovernanceBrowserShell><ComplianceAnalyticsView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/bulk-operations" element={<AppGate><GovernanceBrowserShell><BulkOperationsView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/compliance-calendar" element={<AppGate><GovernanceBrowserShell><ComplianceCalendarView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/audit-trail" element={<AppGate><GovernanceBrowserShell><AuditTrailView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/team-collaboration" element={<AppGate><GovernanceBrowserShell><GovernanceTeamView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/ai-systems" element={<AppGate><GovernanceBrowserShell><AiSystemRegistryView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/ai-systems/agents" element={<AppGate><GovernanceBrowserShell><AgentRegistryView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/automations" element={<AppGate><GovernanceBrowserShell><AutomationSkillsView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/provenance" element={<AppGate><GovernanceBrowserShell><ProvenanceView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/bulk" element={<AppGate><GovernanceBrowserShell><BulkJobsView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/scheduler" element={<AppGate><GovernanceBrowserShell><SchedulerView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/evidence-vault" element={<AppGate><GovernanceBrowserShell><EvidenceVaultAdvancedView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/policy-packs" element={<AppGate><GovernanceBrowserShell><PolicyPacksView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/siteos" element={<AppGate><GovernanceBrowserShell><SiteOsDashboardView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/siteos/builder" element={<AppGate><SiteOsBuilderPage /></AppGate>} />
      {/* Claim: AppGate + View-eigener Resume nach /welcome?next=. */}
      <Route path="/app/siteos/claim" element={<AppGate><SiteOsClaimView /></AppGate>} />
      <Route path="/app/bots" element={<AppGate><GovernanceBrowserShell><BotsView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/bots/inbox" element={<AppGate><GovernanceBrowserShell><BotInboxView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/bots/whatsapp" element={<AppGate><GovernanceBrowserShell><WhatsAppChannelsView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/bots/:botId" element={<AppGate><GovernanceBrowserShell><BotBuilderView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/monitoring/legacy" element={<AppGate><GovernanceBrowserShell><MonitoringSurface embedded /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/security-signals" element={<AppGate><GovernanceBrowserShell><SecuritySignalsView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/legal-rag" element={<AppGate><LegalRagView /></AppGate>} />
      <Route path="/app/workflows" element={<AppGate><GovernanceBrowserShell><WorkflowsView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/risks" element={<AppGate><GovernanceBrowserShell><RiskCenterView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/compliance" element={<AppGate><GovernanceBrowserShell><GovernanceComplianceReportView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/evidence" element={<AppGate><GovernanceBrowserShell><EvidenceVaultView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/evidence/auditor" element={<AppGate><GovernanceBrowserShell><RequireAal2 action="Evidence-Export"><GovernanceAuditorConsoleView /></RequireAal2></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/monitoring" element={<AppGate><GovernanceBrowserShell><MonitoringRuntimeView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/vendors" element={<AppGate><GovernanceBrowserShell><GovernanceVendorInventoryView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/reports" element={<AppGate><GovernanceBrowserShell><GovernanceComplianceReportView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/dpia" element={<AppGate><GovernanceBrowserShell><GovernanceDpiasView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/dsr" element={<AppGate><GovernanceBrowserShell><GovernanceDsrTrackerView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/incidents" element={<AppGate><GovernanceBrowserShell><GovernanceIncidentsView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/remediation" element={<AppGate><GovernanceBrowserShell><RemediationPlansView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/remediation/:planId" element={<AppGate><GovernanceBrowserShell><RemediationPlanDetailView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/keys" element={<AppGate><GovernanceBrowserShell><GovernanceKeysView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/vvt" element={<AppGate><GovernanceBrowserShell><RuntimeVvtView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/webhooks" element={<AppGate><GovernanceBrowserShell><GovernanceWebhooksView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/terminal" element={<AppGate><GovernanceBrowserShell><GovernanceTerminalView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/onboarding" element={<AppGate><GovernanceBrowserShell><GovernanceOnboardingView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/mappings" element={<AppGate><GovernanceBrowserShell><GovernanceMappingsView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/events/:eventId" element={<AppGate><GovernanceBrowserShell><GovernanceEventDetailView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/assets/:assetId" element={<AppGate><GovernanceBrowserShell><GovernanceAssetDetailView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/approvals" element={<AppGate><GovernanceBrowserShell><GovernanceApprovalsView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/admin-log" element={<AppGate><GovernanceBrowserShell><GovernanceAdminLogView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/gates" element={<AppGate><GovernanceBrowserShell><GovernanceApprovalGatesView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/start" element={<AppGate><GovernanceBrowserShell><GovernanceHomeView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/evidence" element={<AppGate><GovernanceBrowserShell><GovernanceEvidenceIntegrityView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/connectors" element={<AppGate><GovernanceBrowserShell><GovernanceConnectorRegistryView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/microsoft365" element={<AppGate><GovernanceBrowserShell><GovernanceMicrosoft365View /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/shadow" element={<AppGate><GovernanceBrowserShell><GovernanceShadowReadinessView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/governance/router" element={<AppGate><GovernanceBrowserShell><GovernanceRouterView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/policies/templates" element={<AppGate><GovernanceBrowserShell><GovernancePolicyTemplatesView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/connectors" element={<AppGate><GovernanceBrowserShell><GovernanceConnectorsView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/costs" element={<AppGate><GovernanceBrowserShell><GovernanceCostTrackingView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/scans" element={<AppGate><GovernanceBrowserShell><GovernanceScansListView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/scans/:scanId" element={<AppGate><GovernanceBrowserShell><GovernanceScanDetailView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/risk-inventory" element={<AppGate><GovernanceBrowserShell><AiActRiskInventoryView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/alerts" element={<AppGate><GovernanceBrowserShell><GovernanceAlertsView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/monitoring/dashboard" element={<AppGate><GovernanceBrowserShell><ComplianceMonitoringDashboard /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/monitoring/rules" element={<AppGate><GovernanceBrowserShell><RequireAal2 action="Compliance Rules"><ComplianceAlertRulesView /></RequireAal2></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/optimize" element={<AppGate><GovernanceBrowserShell><OptimizationView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/billing" element={<AppGate><GovernanceBrowserShell><RequireAal2 action="Billing-Verwaltung"><BillingView /></RequireAal2></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/datasets" element={<AppGate><GovernanceBrowserShell><AiActDataGovernanceView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/analytics" element={<AppGate><GovernanceBrowserShell><Suspense fallback={<div>Loading...</div>}><DashboardAnalyticsView /></Suspense></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/monitoring/sources" element={<AppGate><GovernanceBrowserShell><MonitoringSourcesView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/team" element={<AppGate><GovernanceBrowserShell><RequireAal2 action="Team-Verwaltung"><TenantAdminConsole /></RequireAal2></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/settings/team" element={<AppGate><GovernanceBrowserShell><RequireAal2 action="Team-Verwaltung"><TenantAdminConsole /></RequireAal2></GovernanceBrowserShell></AppGate>} />
      {/* Admin Panel Routes — die Unterseiten hatten bis 2026-09-01 keinen
          Auth-Wrapper (Befund Zugriffsregister); AppGate ist rein additiv. */}
      <Route path="/app/admin" element={<AppGate><GovernanceBrowserShell><AdminDashboard /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/admin/members" element={<AppGate><AdminMembersPage /></AppGate>} />
      <Route path="/app/admin/settings" element={<AppGate><AdminSettingsPage /></AppGate>} />
      <Route path="/app/admin/billing" element={<AppGate><AdminBillingPage /></AppGate>} />
      <Route path="/app/admin/api-keys" element={<AppGate><AdminAPIKeysPage /></AppGate>} />
      <Route path="/app/admin/audit" element={<AppGate><AdminAuditPage /></AppGate>} />
      <Route path="/app/agents" element={<AppGate><GovernanceBrowserShell><GovernanceAgentsCenterView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/documents" element={<AppGate><GovernanceBrowserShell><GovernanceDocumentsView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/audit" element={<AppGate><GovernanceBrowserShell><GovernanceAuditExportView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/settings" element={<AppGate><GovernanceBrowserShell><SettingsView /></GovernanceBrowserShell></AppGate>} />
      {/* /app/agents ist oben bereits auf GovernanceAgentsCenterView registriert —
          eine zweite Registrierung (AgentsOverviewPage) war unerreichbar und wurde
          nach Freigabe vom 2026-08-23 entfernt; die Unterrouten bleiben. */}
      <Route path="/app/agents/automation" element={<AppGate><GovernanceBrowserShell><AutomationAgentPage /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/agents/support" element={<AppGate><GovernanceBrowserShell><SupportAgentPage /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/agents/susi" element={<AppGate><GovernanceBrowserShell><CallAgentSusiPage /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/agents/screenshot" element={<AppGate><GovernanceBrowserShell><ScreenshotAgentPage /></GovernanceBrowserShell></AppGate>} />

      {/* ── Redirects: konkurrierende Einstiege → kanonische Workspace-URL ──
          Alte URLs werden NICHT entfernt (keine 404 / keine toten Bookmarks).
          /assistant und /dashboard bleiben Aliase auf /app/dashboard
          (Compliance-Status). Chat: /app/assistant + Sidebar. Das Ziel
          trägt AppGate; die Aliase selbst brauchen keinen zweiten Guard. */}
      <Route path="/assistant" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="/dashboard/business" element={<BusinessDashboard />} />
      <Route path="/dashboard/audit" element={<AuditDashboardView />} />
      <Route path="/dashboard/agents" element={<AgentOsAdminPage />} />
      <Route path="/business" element={<BusinessDashboard />} />
      {/* `/kodee` führt denselben Gateway-Aufruf wie der frühere Assistent
          (`processAIGatewayRequest`) und braucht deshalb denselben Schutz:
          ohne Gate könnte jeder Besucher Modellaufrufe auslösen.
          `/kodee/connections` ist nicht betroffen — `ConnectionsView`
          bringt einen eigenen `AuthGate` mit. */}
      <Route path="/kodee" element={<AppGate><KodeeView /></AppGate>} />
      <Route path="/kodee/connections" element={<ConnectionsView />} />
      <Route path="/billing/usage" element={<RequireAal2 action="Billing-Verwaltung"><UsageView /></RequireAal2>} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/pricing/whatsapp" element={<WhatsAppPricingPage />} />
      {/* Pricing Detail Routes */}
      <Route path="/pricing/:slug" element={<PricingDetailPageWrapper />} />
      {/* Uebersicht zu den bereits vorhandenen /features/:slug-Detailseiten. */}
      <Route path="/features" element={<Features />} />
      <Route path="/features/:slug" element={<FeatureDetailPageWrapper />} />
      {/* Checkout routes - specific paths must come before parameterized routes.
          /checkout/success ist oben (pages/CheckoutSuccess) registriert; eine
          zweite Registrierung (features/billing/CheckoutSuccessPage) war
          unerreichbar und wurde am 2026-09-01 samt Datei entfernt. */}
      <Route path="/checkout/cancelled" element={<CheckoutCancelledPage />} />
      <Route path="/checkout/:planKey" element={<CheckoutPage />} />
      {/* End of Pricing Detail Routes */}
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
      {/* Settings Routes — Auth-gated with consistent shell UI */}
      <Route path="/settings" element={<AppGate><GovernanceBrowserShell><SettingsView /></GovernanceBrowserShell></AppGate>} />
      <Route path="/settings/ai-residency" element={<AppGate><GovernanceBrowserShell><AiResidencySettings /></GovernanceBrowserShell></AppGate>} />
      <Route path="/settings/security" element={<AppGate><GovernanceBrowserShell><SecuritySettings /></GovernanceBrowserShell></AppGate>} />
      <Route path="/settings/team" element={<AppGate><GovernanceBrowserShell><RequireAal2 action="Team-Verwaltung"><TenantAdminConsole /></RequireAal2></GovernanceBrowserShell></AppGate>} />
      <Route path="/settings/account" element={<AppGate><GovernanceBrowserShell><AccountSettings /></GovernanceBrowserShell></AppGate>} />
      <Route path="/settings/api-keys" element={<AppGate><GovernanceBrowserShell><ApiKeysSettings /></GovernanceBrowserShell></AppGate>} />
      <Route path="/settings/branding" element={<AppGate><GovernanceBrowserShell><RequireAal2 action="White-Label Branding"><BrandingSettings /></RequireAal2></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/api/setup" element={<AppGate><GovernanceBrowserShell><ApiSetupWizard /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/api/docs" element={<AppGate><GovernanceBrowserShell><ApiDocumentation /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/api/monitoring" element={<AppGate><GovernanceBrowserShell><ApiMonitoringDashboard /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/api/monitoring-advanced" element={<AppGate><GovernanceBrowserShell><AdvancedMonitoringDashboard /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/api/email-templates" element={<AppGate><GovernanceBrowserShell><EmailTemplateManager /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/api/webhook-retry" element={<AppGate><GovernanceBrowserShell><WebhookRetryManagement /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/api/webhook-tester" element={<AppGate><GovernanceBrowserShell><WebhookTester /></GovernanceBrowserShell></AppGate>} />
      <Route path="/app/api/rate-limiting" element={<AppGate><GovernanceBrowserShell><RateLimitingAnalytics /></GovernanceBrowserShell></AppGate>} />
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
      {/* Auth Entry Points — Canonical path is /welcome (OTP magic link via Supabase) */}
      <Route path="/login" element={<Navigate to="/welcome" replace />} />
      <Route path="/signin" element={<Navigate to="/welcome" replace />} />
      <Route path="/signup" element={<Navigate to="/welcome" replace />} />
      <Route path="/register" element={<Navigate to="/welcome" replace />} />
      <Route path="/auth" element={<Navigate to="/welcome" replace />} />
      <Route path="/auth/login" element={<Navigate to="/welcome" replace />} />
      <Route path="/auth/register" element={<Navigate to="/welcome" replace />} />
      <Route path="/account" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="/activate" element={<Navigate to="/app/activation" replace />} />
      <Route path="/logout" element={<LogoutPage />} />
      <Route path="/signout" element={<LogoutPage />} />
      {/* Canonical app dashboard aliases */}
      <Route path="/app/home" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="/governance/dashboard" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="/domain-check" element={<Navigate to="/audit" replace />} />
      <Route path="/domain-checker" element={<Navigate to="/audit" replace />} />
      <Route path="/websites" element={<Navigate to="/welcome?next=/app/websites" replace />} />

      {/* ── Enterprise OS Prototype — neues Designsystem + IA (Phase 1 Foundation) ──
          Eigenständiger Klick-Prototyp mit Mockdaten unter /os, /os/app/*.
          Bestehende /, /app/* Routen bleiben unverändert (siehe oben). */}
      <Route path="/os" element={<EnterpriseLandingPage />} />
      {/* Phase 2 — Public Pages (eigenständig, Mockdaten, kein Backend) */}
      <Route path="/os/pricing" element={<Navigate to="/pricing" replace />} />
      <Route path="/os/audit" element={<EnterpriseAuditLandingPage />} />
      <Route path="/os/ai-act" element={<EnterpriseAiGovernancePage />} />
      <Route path="/os/agencies" element={<EnterpriseAgenciesPage />} />
      <Route path="/os/login" element={<Navigate to="/welcome?next=/app/dashboard" replace />} />
      <Route path="/os/signup" element={<Navigate to="/welcome?next=/app/dashboard" replace />} />
      <Route path="/os/checkout" element={<EnterpriseCheckoutEntryPage />} />
      <Route path="/os/welcome" element={<EnterpriseWelcomeWizardPage />} />
      <Route path="/os/datenschutz" element={<EnterpriseDatenschutzPage />} />
      <Route path="/os/impressum" element={<EnterpriseImpressumPage />} />
      {/* Freigabe 2026-09-01 (CLAUDE.md §10): /os/app/* hatte keinen
          Auth-Wrapper. AppGate ist additiv und schickt Unangemeldete nach
          /welcome?next=… — derselbe Weg wie für /app/*. */}
      <Route
        path="/os/app"
        element={
          <AppGate><EnterpriseAppShell title="Home" breadcrumb={['Übersicht']}>
            <EnterpriseAppHomePage />
          </EnterpriseAppShell></AppGate>
        }
      />
      <Route
        path="/os/app/websites"
        element={
          <AppGate><EnterpriseAppShell title="Websites" breadcrumb={['Übersicht']}>
            <EnterpriseWebsitesPage />
          </EnterpriseAppShell></AppGate>
        }
      />
      <Route
        path="/os/app/risks"
        element={
          <AppGate><EnterpriseAppShell title="Risiken" breadcrumb={['Übersicht']}>
            <EnterpriseRisksPage />
          </EnterpriseAppShell></AppGate>
        }
      />
      <Route
        path="/os/app/compliance"
        element={
          <AppGate><EnterpriseAppShell title="Compliance" breadcrumb={['Governance']}>
            <EnterpriseCompliancePage />
          </EnterpriseAppShell></AppGate>
        }
      />
      <Route
        path="/os/app/evidence"
        element={
          <AppGate><EnterpriseAppShell title="Evidence Vault" breadcrumb={['Governance']}>
            <EnterpriseEvidencePage />
          </EnterpriseAppShell></AppGate>
        }
      />
      <Route
        path="/os/app/monitoring"
        element={
          <AppGate><EnterpriseAppShell title="Monitoring" breadcrumb={['Governance']}>
            <EnterpriseMonitoringPage />
          </EnterpriseAppShell></AppGate>
        }
      />
      <Route
        path="/os/app/ai-usecases"
        element={
          <AppGate><EnterpriseAppShell title="AI Use Cases" breadcrumb={['Governance']}>
            <EnterprisePlaceholderPage title="AI Use Case Registry" description="Die vollständige Registry aller KI-Systeme inkl. Risikoklassifizierung nach EU AI Act folgt in Phase 3." />
          </EnterpriseAppShell></AppGate>
        }
      />
      <Route
        path="/os/app/agents"
        element={
          <AppGate><EnterpriseAppShell title="Agenten" breadcrumb={['Governance']}>
            <EnterprisePlaceholderPage title="Agenten" description="Die vollständige Agent-Verwaltung mit Konfiguration, Laufzeiten und Logs folgt in Phase 3." />
          </EnterpriseAppShell></AppGate>
        }
      />
      <Route
        path="/os/app/reports"
        element={
          <AppGate><EnterpriseAppShell title="Reports" breadcrumb={['Governance']}>
            <EnterprisePlaceholderPage title="Audit Reports" description="Die vollständige Report-Bibliothek mit Export- und Freigabe-Workflows folgt in Phase 3." />
          </EnterpriseAppShell></AppGate>
        }
      />
      <Route
        path="/os/app/team"
        element={
          <AppGate><EnterpriseAppShell title="Team" breadcrumb={['Organisation']}>
            <EnterprisePlaceholderPage title="Team & Rollen" description="Die vollständige Team-, Rollen- und Berechtigungsverwaltung folgt in Phase 3." />
          </EnterpriseAppShell></AppGate>
        }
      />
      <Route
        path="/os/app/billing"
        element={
          <AppGate><EnterpriseAppShell title="Billing" breadcrumb={['Organisation']}>
            <EnterprisePlaceholderPage title="Billing" description="Die vollständige Abrechnungs- und Plan-Verwaltung folgt in Phase 3." />
          </EnterpriseAppShell></AppGate>
        }
      />
      <Route
        path="/os/app/settings"
        element={
          <AppGate><EnterpriseAppShell title="Einstellungen" breadcrumb={['Organisation']}>
            <EnterprisePlaceholderPage title="Einstellungen" description="Die vollständigen Organisations- und Account-Einstellungen folgen in Phase 3." />
          </EnterpriseAppShell></AppGate>
        }
      />

      {/* Unified Entry.
          Der Einstieg ist seit dem Umbau auf die Build-Reihenfolge das Studio:
          Idee → Bau → vollständige Vorschau → Konto → Übernahme.

          Die Aliase `/builder` und `/app/bauen` zeigen mit — sie sind der
          beworbene Einstieg in den Builder, und der beginnt jetzt mit der
          Beschreibung statt mit einer URL. Der URL-Scan bleibt unter
          `/unified-entry/scan` erreichbar und wird vom Studio aus verlinkt;
          er ist nicht mehr das Tor. */}
      <Route path="/builder" element={<Navigate to="/build" replace />} />
      <Route path="/app/bauen" element={<Navigate to="/build" replace />} />
      <Route path="/unified-entry" element={<Navigate to="/build" replace />} />
      <Route path="/unified-entry/build" element={<Navigate to="/build" replace />} />
      <Route path="/build" element={<BuildStudioPage />} />
      <Route
        path="/unified-entry/scan"
        element={
          <UnifiedEntryShell currentStep={1} totalSteps={5}>
            <ScanEntryPage />
          </UnifiedEntryShell>
        }
      />
      <Route
        path="/unified-entry/entscheidung"
        element={
          <UnifiedEntryShell currentStep={2} totalSteps={5}>
            <PathChoicePage />
          </UnifiedEntryShell>
        }
      />
      <Route
        path="/unified-entry/preview"
        element={
          <UnifiedEntryShell currentStep={2} totalSteps={5}>
            <DashboardPreviewPage />
          </UnifiedEntryShell>
        }
      />
      <Route path="/unified-entry/transformation" element={<SiteOsBuilderPage />} />
      {/* App Builder Workspace (Phase 2): eine Site des Mandanten, adressiert
          über ihren Slug — dieselbe Kette, die `siteos_blueprints` führt.
          Der Erstbau (/unified-entry/transformation, /app/siteos/builder)
          leitet nach Erfolg hierher; es gibt keinen zweiten Builder. Die
          Anmeldung prüft die Seite selbst, damit `next` erhalten bleibt. */}
      <Route path="/builder/:slug" element={<AppBuilderWorkspacePage />} />
      <Route
        path="/unified-entry/trial-offer"
        element={
          <UnifiedEntryShell currentStep={3} totalSteps={5}>
            <TrialOfferPage />
          </UnifiedEntryShell>
        }
      />
      <Route
        path="/unified-entry/register"
        element={
          <UnifiedEntryShell currentStep={3} totalSteps={5}>
            <RegisterPage />
          </UnifiedEntryShell>
        }
      />
      <Route
        path="/unified-entry/onboarding"
        element={
          <SupabaseAuthProvider>
            <TenantProvider>
              <UnifiedEntryShell currentStep={4} totalSteps={5}>
                <PostRegisterOnboardingPage />
              </UnifiedEntryShell>
            </TenantProvider>
          </SupabaseAuthProvider>
        }
      />
      <Route
        path="/unified-entry/success"
        element={
          <SupabaseAuthProvider>
            <TenantProvider>
              <UnifiedEntryShell currentStep={5} totalSteps={5} showProgress={false}>
                <SuccessPage />
              </UnifiedEntryShell>
            </TenantProvider>
          </SupabaseAuthProvider>
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
