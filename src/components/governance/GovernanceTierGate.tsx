import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, ChevronRight, Zap } from 'lucide-react';
import type { TierId } from '../../config/pricing';
import { tierById } from '../../config/pricing';
import {
  tierHasFeature,
  getFeatureMinimumTier,
  GOVERNANCE_TIERS,
  getRecommendedTierForFeatures,
} from '../../config/governance-features';

interface GovernanceTierGateProps {
  /** Feature ID being accessed */
  featureId: string;
  /** User's current tier */
  userTier: TierId;
  /** Children to render if access granted */
  children: React.ReactNode;
  /** Optional fallback message */
  fallbackMessage?: string;
}

/**
 * Tier-gating wrapper for governance features
 * Checks if user has access, otherwise shows upgrade prompt
 */
export function GovernanceTierGate({
  featureId,
  userTier,
  children,
  fallbackMessage,
}: GovernanceTierGateProps) {
  const hasAccess = tierHasFeature(userTier, featureId);

  if (hasAccess) {
    return <>{children}</>;
  }

  const requiredTier = getFeatureMinimumTier(featureId);
  const requiredTierInfo = requiredTier ? tierById(requiredTier) : null;
  const userTierInfo = tierById(userTier);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex items-center justify-center px-4">
      <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-8 max-w-2xl w-full text-center">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto rounded-none bg-violet-900/20 border border-violet-900 flex items-center justify-center mb-4">
            <Lock className="h-8 w-8 text-violet-400" />
          </div>
          <h2 className="font-display text-2xl font-bold text-titanium-50 mb-2">
            Feature gesperrt
          </h2>
          <p className="text-titanium-400 text-sm">
            {fallbackMessage || 'Diese Governance-Funktion ist in Ihrem aktuellen Plan nicht verfügbar.'}
          </p>
        </div>

        {/* Current Tier Info */}
        <div className="mb-6 bg-obsidian-950 border border-titanium-900 rounded-none p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] text-titanium-400">Ihr aktueller Plan:</span>
            <span className="text-[14px] font-semibold text-titanium-200">{userTierInfo?.name || userTier}</span>
          </div>
          <div className="w-full h-1.5 bg-titanium-800 rounded-none overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-indigo-500"
              style={{ width: '40%' }}
            />
          </div>
        </div>

        {/* Required Tier Info */}
        {requiredTierInfo && (
          <div className="mb-8 bg-gradient-to-r from-violet-900/30 to-indigo-900/30 border border-violet-900 rounded-none p-4">
            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 text-violet-400 mt-0.5 shrink-0" />
              <div className="text-left flex-1">
                <div className="font-semibold text-violet-300 mb-1">
                  Upgrade zu {requiredTierInfo.name}
                </div>
                <p className="text-[12px] text-titanium-300">
                  Diese Funktion ist ab dem {requiredTierInfo.name}-Plan verfügbar.
                  Upgraden Sie jetzt, um Zugriff zu erhalten.
                </p>
                <div className="mt-3 text-[12px] text-titanium-400">
                  <div className="font-semibold text-titanium-300 mb-1">Enthält außerdem:</div>
                  <ul className="space-y-1">
                    {GOVERNANCE_TIERS[requiredTier as TierId]?.frameworks?.slice(0, 3).map(fw => (
                      <li key={fw} className="text-[11px]">• {fw.replace(/_/g, ' ').toUpperCase()}</li>
                    ))}
                    {(GOVERNANCE_TIERS[requiredTier as TierId]?.frameworks?.length || 0) > 3 && (
                      <li className="text-[11px]">+ mehr...</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CTA Buttons */}
        <div className="flex items-center gap-3 justify-center flex-wrap">
          <Link
            to={`/checkout/${requiredTier}?source=governance-tier-gate&feature=${featureId}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-violet-500 hover:bg-violet-400 text-obsidian-950 font-semibold rounded-none transition-colors"
          >
            Upgrade zu {requiredTierInfo?.name}
            <ChevronRight className="h-4 w-4" />
          </Link>
          <Link
            to="/app/governance"
            className="inline-flex items-center gap-2 px-6 py-3 border border-titanium-700 hover:border-titanium-500 text-titanium-200 hover:text-titanium-100 font-semibold rounded-none transition-colors"
          >
            Zurück zum Dashboard
          </Link>
        </div>

        {/* Help Link */}
        <p className="mt-6 text-[11px] text-titanium-500">
          Fragen? Kontaktieren Sie{' '}
          <a href="/contact-sales" className="text-violet-400 hover:text-violet-300 hover:underline">
            Sales
          </a>
          {' '}für ein maßgeschneidertes Angebot.
        </p>
      </div>
    </div>
  );
}

/**
 * Hook version for easier integration
 * Returns whether user has access and metadata
 */
export function useGovernanceFeatureAccess(featureId: string, userTier: TierId) {
  const hasAccess = tierHasFeature(userTier, featureId);
  const requiredTier = getFeatureMinimumTier(featureId);

  return {
    hasAccess,
    requiredTier,
    requiredTierInfo: requiredTier ? tierById(requiredTier) : null,
    userTierInfo: tierById(userTier),
  };
}
