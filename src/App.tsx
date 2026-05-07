/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { AgenciesLanding } from './pages/AgenciesLanding';
import { AuditLanding } from './pages/AuditLanding';
import { DsgvoKiChecklist } from './pages/DsgvoKiChecklist';
import { AuditShare } from './pages/AuditShare';
import { AiActFaq } from './pages/AiActFaq';
import { SchremsIIErklaert } from './pages/SchremsIIErklaert';
import { BaitMaRiskGuide } from './pages/BaitMaRiskGuide';
import { NewsletterConfirm } from './pages/NewsletterConfirm';
import { CaseStudies } from './pages/CaseStudies';
import { Resources } from './pages/Resources';
import { CookieConsentSdk } from './pages/CookieConsentSdk';
import { AuditPro } from './pages/AuditPro';
import { DsgvoToolVergleich } from './pages/DsgvoToolVergleich';
import { ContactSales } from './pages/ContactSales';
import { CreatorDashboard } from './pages/CreatorDashboard';
// Compliance Tools (Free)
import { AvvGenerator } from './pages/AvvGenerator';
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
import { Press } from './pages/Press';
import { Security } from './pages/Security';
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
// Features
import { KodeeView } from './features/kodee/KodeeView';
import { ConnectionsView } from './features/kodee/connections/ConnectionsView';
import { UsageView } from './features/billing/UsageView';
import { PricingPage } from './features/billing/PricingPage';
import { InvitesView } from './features/tenants/InvitesView';
import { AcceptInviteView } from './features/tenants/AcceptInviteView';
import { AiResidencySettings } from './features/settings/AiResidencySettings';
import { AccountSettings } from './features/settings/AccountSettings';
import { ApiKeysSettings } from './features/settings/ApiKeysSettings';
import { SettingsView } from './features/settings/SettingsView';
import { WorkflowsView } from './features/workflows/WorkflowsView';
import { MarketGapsView } from './features/market/MarketGapsView';
import { OutreachView } from './features/outreach/OutreachView';
import { AnalyticsView } from './features/analytics/AnalyticsView';
import { LeadsView } from './features/admin/LeadsView';
import { SystemHealthView } from './features/admin/SystemHealthView';
import { CustomersView } from './features/admin/CustomersView';
import { PrivacyPolicy } from './features/legal/PrivacyPolicy';
import { SubProcessors } from './features/legal/SubProcessors';
import { Impressum } from './features/legal/Impressum';
import { AVVTemplate } from './features/legal/AVVTemplate';
import { ComplianceMatrix } from './features/legal/ComplianceMatrix';
import { CookieConsent } from './components/CookieConsent';
import { TenantProvider } from './core/access/TenantProvider';
import { useTrackPageview } from './lib/track';
import { initMarketingPixels } from './lib/pixels';

const ROUTER_BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined;

function RoutesWithTracking() {
  useTrackPageview();
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/agencies" element={<AgenciesLanding />} />
      <Route path="/audit" element={<AuditLanding />} />
      <Route path="/audit/share/:token" element={<AuditShare />} />
      <Route path="/dsgvo-ki-checkliste" element={<DsgvoKiChecklist />} />
      <Route path="/ai-act-faq" element={<AiActFaq />} />
      <Route path="/schrems-ii-erklaert" element={<SchremsIIErklaert />} />
      <Route path="/bait-marisk-compliance-guide" element={<BaitMaRiskGuide />} />
      <Route path="/newsletter/confirm" element={<NewsletterConfirm />} />
      <Route path="/case-studies" element={<CaseStudies />} />
      <Route path="/ressourcen" element={<Resources />} />
      <Route path="/resources" element={<Resources />} />
      <Route path="/cookie-consent-sdk" element={<CookieConsentSdk />} />
      <Route path="/audit-pro" element={<AuditPro />} />
      <Route path="/dsgvo-tool-vergleich" element={<DsgvoToolVergleich />} />
      <Route path="/contact-sales" element={<ContactSales />} />
      {/* Tools Hub */}
      <Route path="/tools" element={<ToolsHub />} />
      {/* Industry-Doorways */}
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
      <Route path="/ueber-uns" element={<About />} />
      <Route path="/press" element={<Press />} />
      <Route path="/presse" element={<Press />} />
      <Route path="/security" element={<Security />} />
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
      {/* More Competitor-Alternatives */}
      <Route path="/iubenda-alternative" element={<IubendaAlternative />} />
      {/* API + Integrations + Niche */}
      <Route path="/api" element={<ApiDocs />} />
      <Route path="/api-docs" element={<ApiDocs />} />
      <Route path="/integrations" element={<Integrations />} />
      <Route path="/integrationen" element={<Integrations />} />
      <Route path="/steuerberater" element={<SteuerberaterLanding />} />
      <Route path="/steuerkanzlei" element={<SteuerberaterLanding />} />
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
      {/* Dashboard */}
      <Route path="/dashboard" element={<CreatorDashboard />} />
      <Route path="/kodee" element={<KodeeView />} />
      <Route path="/kodee/connections" element={<ConnectionsView />} />
      <Route path="/billing/usage" element={<UsageView />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/tenant/invites" element={<InvitesView />} />
      <Route path="/tenant/invite/:token" element={<AcceptInviteView />} />
      <Route path="/settings" element={<SettingsView />} />
      <Route path="/settings/ai-residency" element={<AiResidencySettings />} />
      <Route path="/settings/account" element={<AccountSettings />} />
      <Route path="/settings/api-keys" element={<ApiKeysSettings />} />
      <Route path="/workflows" element={<WorkflowsView />} />
      <Route path="/market-gaps" element={<MarketGapsView />} />
      <Route path="/outreach" element={<OutreachView />} />
      {/* Admin */}
      <Route path="/admin/analytics" element={<AnalyticsView />} />
      <Route path="/admin/leads" element={<LeadsView />} />
      <Route path="/admin/system" element={<SystemHealthView />} />
      <Route path="/admin/customers" element={<CustomersView />} />
      {/* Legal */}
      <Route path="/legal/privacy" element={<PrivacyPolicy />} />
      <Route path="/legal/sub-processors" element={<SubProcessors />} />
      <Route path="/impressum" element={<Impressum />} />
      <Route path="/legal/impressum" element={<Impressum />} />
      <Route path="/datenschutz" element={<PrivacyPolicy />} />
      <Route path="/legal/datenschutz" element={<PrivacyPolicy />} />
      <Route path="/legal/avv" element={<AVVTemplate />} />
      <Route path="/legal/compliance-matrix" element={<ComplianceMatrix />} />
    </Routes>
  );
}

export default function App() {
  useEffect(() => { initMarketingPixels(); }, []);
  return (
    <TenantProvider>
      <BrowserRouter basename={ROUTER_BASENAME}>
        <RoutesWithTracking />
        <CookieConsent />
      </BrowserRouter>
    </TenantProvider>
  );
}
