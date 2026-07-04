/**
 * Checkout Flow — Handles plan selection → Stripe Checkout redirect
 *
 * Flow:
 * 1. User selects a plan in PlanSelector
 * 2. CheckoutFlow creates a Stripe Checkout Session
 * 3. Redirects to stripe.com/pay/{sessionId}
 * 4. After payment: success page or cancel
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TierId } from '../../config/pricing';
import { createCheckoutSession } from '../../lib/stripe';
import { PlanSelector } from './PlanSelector';
import { useAuth } from '../../lib/useAuth';
import { useTenant } from '../../core/access/TenantProvider';

export interface CheckoutFlowProps {
  /** Redirect here on cancel instead of back */
  onCancel?: () => void;
  /** Trial mode: auto-add trial days to metadata */
  trialMode?: boolean;
  trialDays?: number;
}

export function CheckoutFlow({
  onCancel,
  trialMode = true,
  trialDays = 14,
}: CheckoutFlowProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeTenantId } = useTenant();

  const [selectedPlan, setSelectedPlan] = useState<TierId | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user || !activeTenantId) {
    return (
      <div className="w-full bg-obsidian-900 min-h-screen flex items-center justify-center px-4">
        <div className="bg-obsidian-800 border border-titanium-700 rounded p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-titanium-50 mb-4">Login erforderlich</h2>
          <p className="text-titanium-300 mb-6">
            Bitte melde dich an, um dich für einen Plan anzumelden.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="w-full px-4 py-3 bg-security-500 text-white font-bold hover:bg-security-600"
          >
            Zum Login
          </button>
        </div>
      </div>
    );
  }

  const handleSelectPlan = async (planId: TierId) => {
    if (planId === 'free') {
      // Free plan: no checkout needed, just redirect to audit
      navigate('/audit');
      return;
    }

    setSelectedPlan(planId);
    setIsLoading(true);
    setError(null);

    try {
      const response = await createCheckoutSession({
        planId,
        tenantId: activeTenantId,
        userId: user.id,
        email: user.email || '',
        successUrl: `${window.location.origin}/checkout/success?session={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/checkout/cancel`,
        trialDays: trialMode ? trialDays : 0,
      });

      // Redirect to Stripe Checkout
      if (response.checkoutUrl) {
        window.location.href = response.checkoutUrl;
      } else {
        setError('Checkout-URL konnte nicht generiert werden.');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten';
      setError(errorMsg);
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full bg-obsidian-900 min-h-screen pb-16">
      {/* Error Banner */}
      {error && (
        <div className="bg-red-900 border border-red-700 p-4 mx-4 mt-4 rounded">
          <p className="text-red-200 text-sm">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-300 hover:text-red-200 text-xs mt-2"
          >
            Schließen
          </button>
        </div>
      )}

      {/* Plan Selector */}
      <PlanSelector
        selectedPlan={selectedPlan}
        onSelectPlan={handleSelectPlan}
        isLoading={isLoading}
        disabled={isLoading}
      />

      {/* Back Button */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <button
          data-testid="checkout-back"
          onClick={onCancel ? onCancel : () => navigate(-1)}
          className="text-titanium-400 hover:text-titanium-200 text-sm font-medium"
        >
          ← Zurück
        </button>
      </div>
    </div>
  );
}
