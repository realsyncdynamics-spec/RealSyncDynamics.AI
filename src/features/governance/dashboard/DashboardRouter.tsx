import React from 'react';
import { useEntitlements } from '../../../core/billing/useEntitlements';
import { CeoCockpitView } from '../cockpit/CeoCockpitView';
import { FreeTierDashboard } from './FreeTierDashboard';

/**
 * DashboardRouter conditionally renders the appropriate dashboard based on tier:
 * - Free tier: Simplified FreeTierDashboard with limited features
 * - Starter+: Full CeoCockpitView (CEO dashboard)
 */
export function DashboardRouter() {
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

  // Show FreeTierDashboard for free tier users
  if (tier === 'free_tier') {
    return <FreeTierDashboard />;
  }

  // Show full CEO dashboard for paid tiers
  return <CeoCockpitView />;
}
