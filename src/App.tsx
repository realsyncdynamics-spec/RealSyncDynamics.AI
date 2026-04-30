/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { CreatorDashboard } from './pages/CreatorDashboard';
import { KodeeView } from './features/kodee/KodeeView';
import { ConnectionsView } from './features/kodee/connections/ConnectionsView';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<CreatorDashboard />} />
        <Route path="/kodee" element={<KodeeView />} />
        <Route path="/kodee/connections" element={<ConnectionsView />} />
      </Routes>
    </BrowserRouter>
  );
}
