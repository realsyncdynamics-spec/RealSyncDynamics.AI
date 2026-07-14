/**
 * Policy-Pack Auto-Activator — One-Click Workflow
 *
 * Zeigt Empfehlungen und aktiviert sie mit einem Klick.
 */

import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, Loader, Zap } from 'lucide-react';
import { recommendPolicyPacks, autoActivateRecommendedPacks } from '../../lib/governance/policyPackRecommender';
import type { PolicyPackRecommendation } from '../../lib/governance/policyPackRecommender';

export interface PolicyPackAutoActivatorProps {
  assetId: string;
  tenantId: string;
  assetType: string;
  aiActClass: string;
  dataTypes: string[];
  tenantIndustry?: string;
  onActivationComplete?: (count: number) => void;
}

export function PolicyPackAutoActivator({
  assetId,
  tenantId,
  assetType,
  aiActClass,
  dataTypes,
  tenantIndustry,
  onActivationComplete,
}: PolicyPackAutoActivatorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isActivated, setIsActivated] = useState(false);
  const [recommendations, setRecommendations] = useState<PolicyPackRecommendation[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Generate recommendations on mount
  React.useEffect(() => {
    const recs = recommendPolicyPacks({
      assetType,
      aiActClass,
      dataTypes,
      tenantIndustry,
    });
    setRecommendations(recs);
  }, [assetType, aiActClass, dataTypes, tenantIndustry]);

  const handleAutoActivate = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // In real implementation, call Edge Function
      // const response = await fetch('/functions/v1/governance-resources', {
      //   method: 'POST',
      //   headers: { 'Authorization': `Bearer ${token}` },
      //   body: JSON.stringify({ op: 'auto_activate_packs', asset_id: assetId, recommendations })
      // });

      // Mock response for now
      const activatedCount = recommendations.filter((r) => ['critical', 'high'].includes(r.priority)).length;

      // Simulate API delay
      await new Promise((r) => setTimeout(r, 1500));

      setIsActivated(true);
      onActivationComplete?.(activatedCount);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Activation failed';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (recommendations.length === 0) {
    return null;
  }

  const criticalCount = recommendations.filter((r) => r.priority === 'critical').length;
  const highCount = recommendations.filter((r) => r.priority === 'high').length;

  return (
    <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-4" data-testid="policy-recommendations">
      <div className="flex items-start gap-3">
        <Zap className="mt-1 h-5 w-5 flex-shrink-0 text-amber-600" />
        <div className="flex-1">
          <h3 className="font-semibold text-amber-900">Policy-Pack Empfehlungen</h3>
          <p className="mt-1 text-sm text-amber-800">
            {criticalCount} kritisch, {highCount} hoch-priorisiert
          </p>
        </div>
      </div>

      {/* Recommendations List */}
      <div className="space-y-2">
        {recommendations.map((rec) => (
          <div
            key={rec.packId}
            className={`rounded p-2 text-sm ${rec.priority === 'critical' ? 'bg-red-50' : rec.priority === 'high' ? 'bg-amber-50' : 'bg-blue-50'}`}
            data-testid="policy-pack-card"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium">{rec.packName}</p>
                <p className="text-xs text-gray-600">{rec.reason}</p>
              </div>
              <div className="ml-2 flex items-center gap-2">
                <span className="inline-block rounded bg-white px-2 py-1 text-xs font-semibold uppercase">
                  {rec.priority}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded bg-red-100 p-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {isActivated && (
        <div className="flex items-center gap-2 rounded bg-green-100 p-2 text-sm text-green-700" data-testid="activation-success">
          <CheckCircle2 className="h-4 w-4" />
          <span>
            {recommendations.filter((r) => ['critical', 'high'].includes(r.priority)).length} Policy-Packs aktiviert!
          </span>
        </div>
      )}

      <button
        onClick={handleAutoActivate}
        disabled={isLoading || isActivated}
        className="w-full rounded bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        data-testid="auto-activate-button"
      >
        {isLoading ? (
          <>
            <Loader className="mr-2 inline-block h-4 w-4 animate-spin" />
            Aktiviere...
          </>
        ) : isActivated ? (
          <>
            <CheckCircle2 className="mr-2 inline-block h-4 w-4" />
            Aktiviert!
          </>
        ) : (
          <>
            <Zap className="mr-2 inline-block h-4 w-4" />
            Auto-Aktivieren
          </>
        )}
      </button>
    </div>
  );
}
