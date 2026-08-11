import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useEntitlements } from '../../../core/billing/useEntitlements';
import { CeoCockpitView } from '../cockpit/CeoCockpitView';
import { FreeTierDashboard } from './FreeTierDashboard';
import { PilotWelcomeBanner } from './PilotWelcomeBanner';
import { usePerformanceMonitor } from '../../../lib/performance';

/**
 * DashboardRouter conditionally renders the appropriate dashboard based on tier:
 * - Free tier: Simplified FreeTierDashboard with limited features
 * - Starter+: Full CeoCockpitView (CEO dashboard)
 *
 * Zusätzlich: Direkt nach der Pilot-Aktivierung (`?welcome=pilot`) steht über
 * beiden Zweigen das Willkommensbanner. Es sitzt hier und nicht in einer der
 * Views, damit es unabhängig vom Tier erscheint — der Entitlement-Cache braucht
 * einen Moment, bis ein frisch angelegter Starter-Trial sichtbar ist, und der
 * Nutzer sieht in dieser Zeitspanne sonst gar keine Bestätigung.
 *
 * Performance: Monitors dashboard load time and re-render frequency.
 */
export function DashboardRouter() {
  usePerformanceMonitor('DashboardRouter', { threshold: 500 });

  const [searchParams] = useSearchParams();
  const isPilotWelcome = searchParams.get('welcome') === 'pilot';
  const pilotDomain = searchParams.get('domain');

  const { tier, loading } = useEntitlements();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-obsidian-950 text-titanium-400">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ai-cyan-400 mx-auto mb-4" />
          <p className="text-sm">Dashboard wird geladen...</p>
        </div>
      </div>
    );
  }

  const banner = isPilotWelcome ? <PilotWelcomeBanner domain={pilotDomain} /> : null;

  // Show FreeTierDashboard for free tier users
  if (tier === 'free') {
    return (
      <>
        {banner}
        <FreeTierDashboard />
      </>
    );
  }

  // Show full CEO dashboard for paid tiers
  return (
    <>
      {banner}
      {/* Der Cockpit-eigene First-Time-Hinweis wird unterdrückt, solange das
          Pilot-Banner steht — sonst stapeln sich zwei Willkommenskarten. */}
      <CeoCockpitView suppressFirstTimeBanner={isPilotWelcome} />
    </>
  );
}
