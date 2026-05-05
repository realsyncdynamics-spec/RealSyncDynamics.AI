/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { AgenciesLanding } from './pages/AgenciesLanding';
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
import { SettingsView } from './features/settings/SettingsView';
import { WorkflowsView } from './features/workflows/WorkflowsView';
import { PrivacyPolicy } from './features/legal/PrivacyPolicy';
import { SubProcessors } from './features/legal/SubProcessors';
import { CookieConsent } from './components/CookieConsent';
import { TenantProvider } from './core/access/TenantProvider';

export default function App() {
  return (
    <TenantProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/agencies" element={<AgenciesLanding />} />
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
          <Route path="/workflows" element={<WorkflowsView />} />
          <Route path="/legal/privacy" element={<PrivacyPolicy />} />
          <Route path="/legal/sub-processors" element={<SubProcessors />} />
        </Routes>
        <CookieConsent />
      </BrowserRouter>
    </TenantProvider>
  );
}
