/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
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
import { ContactSales } from './pages/ContactSales';
import { CreatorDashboard } from './pages/CreatorDashboard';
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
import { AVVTemplate } from './features/legal/AVVTemplate';
import { ComplianceMatrix } from './features/legal/ComplianceMatrix';
import { CookieConsent } from './components/CookieConsent';
import { TenantProvider } from './core/access/TenantProvider';
import { useTrackPageview } from './lib/track';

const ROUTER_BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined;

function RoutesWithTracking() {
  useTrackPageview();
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/agencies" element={<AgenciesLanding />} />
      <Route path="/audit" element={<AuditLanding />} />
      <Route path="/dsgvo-ki-checkliste" element={<DsgvoKiChecklist />} />
      <Route path="/audit/share/:token" element={<AuditShare />} />
      <Route path="/ai-act-faq" element={<AiActFaq />} />
      <Route path="/schrems-ii-erklaert" element={<SchremsIIErklaert />} />
      <Route path="/bait-marisk-compliance-guide" element={<BaitMaRiskGuide />} />
      <Route path="/newsletter/confirm" element={<NewsletterConfirm />} />
      <Route path="/case-studies" element={<CaseStudies />} />
      <Route path="/ressourcen" element={<Resources />} />
      <Route path="/resources" element={<Resources />} />
      <Route path="/contact-sales" element={<ContactSales />} />
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
      <Route path="/admin/analytics" element={<AnalyticsView />} />
      <Route path="/admin/leads" element={<LeadsView />} />
      <Route path="/admin/system" element={<SystemHealthView />} />
      <Route path="/admin/customers" element={<CustomersView />} />
      <Route path="/legal/privacy" element={<PrivacyPolicy />} />
      <Route path="/legal/sub-processors" element={<SubProcessors />} />
      <Route path="/legal/avv" element={<AVVTemplate />} />
      <Route path="/legal/compliance-matrix" element={<ComplianceMatrix />} />
    </Routes>
  );
}

export default function App() {
  return (
    <TenantProvider>
      <BrowserRouter basename={ROUTER_BASENAME}>
        <RoutesWithTracking />
        <CookieConsent />
      </BrowserRouter>
    </TenantProvider>
  );
}
