/**
 * Stripe Integration Utilities
 *
 * Handles checkout session creation, subscription management, and billing
 * for the UG/GmbH-ready platform.
 */

import { COMPANY } from '../config/company';
import { PRICING_TIERS, type TierId } from '../config/pricing';
import { getSupabase } from './supabase';

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
 * Redirects to Stripe-hosted checkout page via Supabase Edge Function.
 */
export async function createCheckoutSession(
  request: CreateCheckoutSessionRequest
): Promise<CreateCheckoutSessionResponse> {
  const tier = PRICING_TIERS.find((t) => t.id === request.planId);
  if (!tier) {
    throw new Error(`Unknown pricing tier: ${request.planId}`);
  }

  const planKey = tier.planKey || request.planId;
  const pilot = request.trialDays ? request.trialDays >= 14 : false;

  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('stripe-checkout', {
    body: {
      tenant_id: request.tenantId,
      plan_key: planKey,
      return_url: typeof window !== 'undefined' ? window.location.origin : request.successUrl,
      pilot,
    },
  });

  if (error) {
    throw new Error(`Checkout creation failed: ${error.message}`);
  }

  return {
    sessionId: data.session_id || '',
    checkoutUrl: data.url || '',
  };
}

/**
 * Redirects user to Stripe Customer Portal for subscription management
 */
export async function openCustomerPortal(sessionId: string): Promise<string> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('stripe-portal', {
    body: { session_id: sessionId },
  });

  if (error) {
    throw new Error(`Portal session creation failed: ${error.message}`);
  }

  return data.url || '';
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
