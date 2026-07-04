/**
 * Stripe Integration Utilities
 *
 * Handles checkout session creation, subscription management, and billing
 * for the UG/GmbH-ready platform.
 */

import { COMPANY } from '../config/company';
import { PRICING_TIERS, type TierId } from '../config/pricing';

export interface CreateCheckoutSessionRequest {
  planId: TierId;
  tenantId: string;
  userId: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number; // 14 for pilot mode
  metadata?: Record<string, string>;
}

export interface CreateCheckoutSessionResponse {
  sessionId: string;
  checkoutUrl: string;
}

/**
 * Creates a Stripe Checkout session for a given plan.
 * Redirects to Stripe-hosted checkout page.
 */
export async function createCheckoutSession(
  request: CreateCheckoutSessionRequest
): Promise<CreateCheckoutSessionResponse> {
  const tier = PRICING_TIERS.find((t) => t.id === request.planId);
  if (!tier) {
    throw new Error(`Unknown pricing tier: ${request.planId}`);
  }

  const response = await fetch('/.netlify/functions/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plan_id: request.planId,
      tenant_id: request.tenantId,
      user_id: request.userId,
      email: request.email,
      success_url: request.successUrl,
      cancel_url: request.cancelUrl,
      trial_days: request.trialDays || 0,
      metadata: {
        plan_name: tier.name,
        company: COMPANY.companyName,
        ...request.metadata,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Checkout creation failed: ${error}`);
  }

  const data = (await response.json()) as CreateCheckoutSessionResponse;
  return data;
}

/**
 * Redirects user to Stripe Customer Portal for subscription management
 */
export async function openCustomerPortal(sessionId: string): Promise<string> {
  const response = await fetch('/.netlify/functions/customer-portal-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Portal session creation failed: ${error}`);
  }

  const data = (await response.json()) as { url: string };
  return data.url;
}

/**
 * Validates if Stripe is properly configured for this environment
 */
export function isStripeConfigured(): boolean {
  return COMPANY.stripePublishableKey !== '';
}

/**
 * Formats price in EUR with proper German currency formatting
 * Examples: 79,00 € | 249,00 € | 1.999,00 €
 */
export function formatPrice(eurAmount: number, includeSymbol = true): string {
  // Format as German locale: decimal comma, thousand dots
  const formatted = new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(eurAmount);
  return includeSymbol ? `${formatted} €` : formatted;
}

/**
 * Get plan by ID from pricing config
 */
export function getPlanById(planId: TierId) {
  return PRICING_TIERS.find((t) => t.id === planId);
}

/**
 * Check if a plan has a fixed price (vs. custom/enterprise pricing)
 */
export function isPlanFixedPrice(planId: TierId): boolean {
  const plan = getPlanById(planId);
  return plan ? plan.priceEur > 0 : false;
}

/**
 * Generate Stripe product metadata object
 */
export function getStripeProductMetadata(planId: TierId) {
  const plan = getPlanById(planId);
  if (!plan) return {};

  return {
    plan_key: plan.planKey,
    plan_name: plan.name,
    company_name: COMPANY.companyName,
    company_legal_form: COMPANY.legalForm,
    price_eur: plan.priceEur.toString(),
    recurring: plan.recurring ? 'true' : 'false',
  };
}
