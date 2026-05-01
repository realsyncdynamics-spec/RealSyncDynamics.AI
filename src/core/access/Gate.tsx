import React from 'react';
import { Lock } from 'lucide-react';
import { useTenant } from './TenantProvider';

interface GateProps {
  /** Entitlement key from the catalog (e.g. "api.access" or "limit.api_calls_monthly"). */
  feature: string;
  /** Custom render when the feature is gated. Defaults to a small upsell badge. */
  fallback?: React.ReactNode;
  /** Optional label shown in the default fallback to identify the feature. */
  featureLabel?: string;
  children: React.ReactNode;
}

/**
 * Renders `children` only when the active tenant has access to `feature`.
 * Falls back to `fallback` (or a small upgrade hint) when the gate is closed.
 *
 * This is a UX-affordance — never the only enforcement. Edge functions must
 * re-check entitlements server-side, see supabase/functions/_shared/entitlements.ts.
 */
export function Gate({ feature, fallback, featureLabel, children }: GateProps) {
  const { hasFeature, loading } = useTenant();

  if (loading) return null;

  if (hasFeature(feature)) return <>{children}</>;

  if (fallback !== undefined) return <>{fallback}</>;

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-titanium-400 bg-obsidian-800 border border-titanium-900 rounded-none">
      <Lock className="h-3 w-3" />
      {featureLabel ?? feature} ist im aktuellen Plan nicht enthalten
    </div>
  );
}

/** Inverse: render only when the feature is NOT available. Useful for upsell banners. */
export function NotGate({ feature, children }: { feature: string; children: React.ReactNode }) {
  const { hasFeature, loading } = useTenant();
  if (loading) return null;
  if (hasFeature(feature)) return null;
  return <>{children}</>;
}
