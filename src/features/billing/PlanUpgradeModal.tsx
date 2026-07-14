/**
 * Plan Upgrade/Downgrade Modal — Switch subscription tiers mid-cycle
 *
 * Allows users to upgrade/downgrade their current plan.
 * - Upgrade: Pro-rata charged immediately
 * - Downgrade: Discounted on next billing cycle
 * - Flow: Select new plan → Confirm changes → Redirect to Stripe
 */

import React, { useState } from 'react';
import { PUBLIC_PRICING_TIERS, type TierId } from '../../config/pricing';
import { AlertCircle, ArrowRight, Loader2, X } from 'lucide-react';

interface PlanUpgradeModalProps {
  currentPlanId: TierId;
  onClose: () => void;
  onSelectPlan: (planId: TierId) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
}

export function PlanUpgradeModal({
  currentPlanId,
  onClose,
  onSelectPlan,
  isLoading = false,
  error,
}: PlanUpgradeModalProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<TierId | null>(null);
  const currentTier = PUBLIC_PRICING_TIERS.find((t) => t.id === currentPlanId);
  const selectedTier = selectedPlanId ? PUBLIC_PRICING_TIERS.find((t) => t.id === selectedPlanId) : null;

  const isUpgrade = selectedPlanId
    ? PUBLIC_PRICING_TIERS.findIndex((t) => t.id === selectedPlanId) >
      PUBLIC_PRICING_TIERS.findIndex((t) => t.id === currentPlanId)
    : false;

  async function handleConfirm() {
    if (!selectedPlanId) return;
    await onSelectPlan(selectedPlanId);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-obsidian-800 border border-titanium-700 rounded-none max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-obsidian-900 border-b border-titanium-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-titanium-50">Plan {isUpgrade ? 'Upgraden' : 'Wechseln'}</h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1 hover:bg-obsidian-700 disabled:opacity-50"
          >
            <X className="h-5 w-5 text-titanium-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Current Plan */}
          <div className="bg-obsidian-900 border border-titanium-700 rounded-none p-4">
            <p className="text-xs text-titanium-400 uppercase tracking-wider mb-2">Aktueller Plan</p>
            <p className="text-lg font-bold text-titanium-50">{currentTier?.name}</p>
            <p className="text-sm text-titanium-400 mt-1">{currentTier?.tagline}</p>
          </div>

          {/* Plan Selection Grid */}
          <div>
            <p className="text-sm font-semibold text-titanium-300 mb-3">Wähle einen neuen Plan:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PUBLIC_PRICING_TIERS.map((tier) => (
                <button
                  key={tier.id}
                  onClick={() => {
                    if (tier.id !== currentPlanId) {
                      setSelectedPlanId(tier.id);
                    }
                  }}
                  disabled={tier.id === currentPlanId || isLoading}
                  className={`relative p-4 rounded-none text-left transition-all ${
                    selectedPlanId === tier.id
                      ? 'border-2 border-ai-cyan-400 bg-obsidian-700'
                      : tier.id === currentPlanId
                        ? 'border border-titanium-600 bg-obsidian-900 opacity-60'
                        : 'border border-titanium-700 bg-obsidian-900 hover:bg-obsidian-800'
                  } disabled:cursor-not-allowed`}
                >
                  <p className="font-semibold text-titanium-50">{tier.name}</p>
                  <p className="text-sm text-titanium-400 mt-1">{tier.priceString}€ / {tier.priceSuffix.toLowerCase()}</p>
                  {tier.id === currentPlanId && (
                    <span className="absolute top-2 right-2 text-xs font-bold text-titanium-300 bg-obsidian-800 px-2 py-1">
                      Aktuell
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Change Summary */}
          {selectedTier && selectedTier.id !== currentPlanId && (
            <div className={`rounded-none p-4 ${
              isUpgrade
                ? 'bg-emerald-950/40 border border-emerald-800'
                : 'bg-titanium-950/40 border border-titanium-800'
            }`}>
              <p className="text-sm text-titanium-300 mb-2">
                {isUpgrade
                  ? 'Bei einem Upgrade wird dein Plan sofort aktiviert. Du zahlst die Differenz sofort pro rata.'
                  : 'Bei einem Downgrade wird dein Plan zum nächsten Abrechnungsdatum geändert. Du erhältst eine Gutschrift.'}
              </p>
              <div className="text-lg font-bold text-titanium-50 mt-3">
                {isUpgrade ? '↑' : '↓'} Wechsel von {currentTier?.name} zu {selectedTier.name}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 p-3 rounded-none bg-red-950/40 border border-red-800">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-titanium-700">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-obsidian-700 text-titanium-50 font-semibold hover:bg-obsidian-600 disabled:opacity-50 rounded-none"
            >
              Abbrechen
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedPlanId || isLoading || selectedPlanId === currentPlanId}
              className="flex-1 px-4 py-3 bg-security-500 text-white font-semibold hover:bg-security-600 disabled:opacity-50 rounded-none flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Wird bearbeitet...
                </>
              ) : (
                <>
                  Plan {isUpgrade ? 'Upgraden' : 'Wechseln'} <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
