/**
 * Billing-Sandbox für Marketplace und „Mein Plan“.
 *
 * Kein Stripe, kein Schreiben nach Supabase. Die Auflistung kommt aus der
 * Pricing-SSoT und reagiert nur im Speicher auf add/remove. So lassen sich
 * die drei Karten-Zustände prüfen, bevor ein Live-Price in plan_addons steht.
 *
 * Aktiv nur mit `?billing=sandbox` und nur ausserhalb der Produktions-Domain.
 */
import {
  ADDONS,
  addonOfferStatus,
  planById,
  type AddOnId,
  type AddonOfferStatus,
  type PlanId,
} from '@/shared/pricing';
import type { AddonListing, AddonListingEntry } from './subscriptionAddons';

const SANDBOX_PLAN: PlanId = 'starter';

export function isBillingSandbox(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('billing') !== 'sandbox') return false;
  const host = window.location.hostname;
  const preview = host.endsWith('.pages.dev') || host.includes('staging') || host.includes('sandbox');
  const local = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
  const flagged = import.meta.env.VITE_BILLING_SANDBOX === '1' || import.meta.env.DEV;
  const production = host === 'realsyncdynamicsai.de' || host === 'www.realsyncdynamicsai.de';
  return !production && (local || preview || flagged);
}

function heldFor(planId: PlanId): Record<string, number> {
  const plan = planById(planId);
  if (!plan) return {};
  return {
    'limit.domains': plan.limits.domains,
    'bots.whatsapp': plan.modules.includes('whatsapp') ? 1 : 0,
    'bots.voice': plan.channels.includes('voice') ? 1 : 0,
  };
}

function entry(
  addonId: AddOnId,
  planId: PlanId,
  booked: { id: AddOnId; quantity: number }[],
): AddonListingEntry {
  const addon = ADDONS.find((a) => a.id === addonId)!;
  const plan = planById(planId)!;
  const row = booked.find((b) => b.id === addonId);
  const offer = addonOfferStatus({
    addon,
    plan: planId,
    held: heldFor(planId),
    booked,
    purchasable: true,
  });
  const quantity = row?.quantity ?? 0;
  const delta = addon.priceEur * (quantity > 0 ? 0 : 1);
  const current = plan.price.monthlyEur + booked.reduce((sum, b) => {
    const price = ADDONS.find((a) => a.id === b.id)?.priceEur ?? 0;
    return sum + price * b.quantity;
  }, 0);
  return {
    id: addon.id,
    name: addon.name,
    description: addon.description,
    price_eur: addon.priceEur,
    price_note: addon.priceNote,
    bullets: addon.bullets,
    per_unit: addon.perUnit,
    grants: addon.grants,
    status: (row ? 'booked' : offer.status) as AddonOfferStatus,
    missing: offer.missing,
    quantity,
    stripe_item_id: row ? `sandbox_${addon.id}` : null,
    preview: {
      current_monthly_eur: current,
      delta_monthly_eur: row ? addon.priceEur : delta,
      new_monthly_eur: row ? current - addon.priceEur * quantity : current + addon.priceEur,
      effective_from: new Date().toISOString(),
      full_amount_from: null,
    },
  };
}

export function sandboxListing(booked: { id: AddOnId; quantity: number }[] = []): AddonListing {
  const plan = planById(SANDBOX_PLAN)!;
  const addons = ADDONS.map((addon) => entry(addon.id, SANDBOX_PLAN, booked));
  const addonsEur = booked.reduce((sum, b) => {
    const price = ADDONS.find((a) => a.id === b.id)?.priceEur ?? 0;
    return sum + price * b.quantity;
  }, 0);
  return {
    ok: true,
    plan: {
      id: plan.id,
      plan_key: plan.planKey,
      name: `${plan.name} · Sandbox`,
      monthly_eur: plan.price.monthlyEur,
      availability: plan.availability,
    },
    subscription: {
      status: 'active',
      paid_access: true,
      current_period_end: null,
      past_due_since: null,
      grace_days_remaining: null,
      // Synthetisches Abo: true, damit auch „Mein Plan“ den in-memory
      // Buchungsfluss testen kann. isBillingSandbox() hält Production hart aus.
      has_stripe_subscription: true,
    },
    entitlements: [],
    addons,
    totals: {
      plan_eur: plan.price.monthlyEur,
      addons_eur: addonsEur,
      monthly_eur: plan.price.monthlyEur + addonsEur,
    },
  };
}

export function sandboxApply(
  booked: { id: AddOnId; quantity: number }[],
  action: 'add' | 'remove',
  addonId: AddOnId,
  quantity = 1,
): { id: AddOnId; quantity: number }[] {
  if (action === 'remove') return booked.filter((b) => b.id !== addonId);
  const next = booked.filter((b) => b.id !== addonId);
  next.push({ id: addonId, quantity });
  return next;
}
