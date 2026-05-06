/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { CreatorDashboard } from './pages/CreatorDashboard';
import { ContactSales } from './pages/ContactSales';
import { Agencies } from './pages/Agencies';
import { Privacy } from './pages/legal/Privacy';
import { SubProcessors } from './pages/legal/SubProcessors';
import { KodeeView } from './features/kodee/KodeeView';
import { ConnectionsView } from './features/kodee/connections/ConnectionsView';
import { UsageView } from './features/billing/UsageView';
import { PricingPage } from './features/billing/PricingPage';
import { InvitesView } from './features/tenants/InvitesView';
import { AcceptInviteView } from './features/tenants/AcceptInviteView';
import { TenantProvider } from './core/access/TenantProvider';

export default function App() {
  return (
    <TenantProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/dashboard" element={<CreatorDashboard />} />
          <Route path="/contact-sales" element={<ContactSales />} />
          <Route path="/agencies" element={<Agencies />} />
          <Route path="/legal/privacy" element={<Privacy />} />
          <Route path="/legal/sub-processors" element={<SubProcessors />} />
          <Route path="/kodee" element={<KodeeView />} />
          <Route path="/kodee/connections" element={<ConnectionsView />} />
          <Route path="/billing/usage" element={<UsageView />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/tenant/invites" element={<InvitesView />} />
          <Route path="/tenant/invite/:token" element={<AcceptInviteView />} />
        </Routes>
      </BrowserRouter>
    </TenantProvider>
  );
}
