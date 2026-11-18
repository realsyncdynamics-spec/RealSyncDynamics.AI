// Eigenständiges Voice-Agent-Abo — gemeinsame Regeln für
// checkout-voice-agent (Kauf) und stripe-webhook (Freischaltung).
//
// Ohne Supabase-/Deno-/npm-Import, damit Vitest die Regeln prüfen kann.
//
// Ablauf:
//   1. checkout-voice-agent: Schalter VOICE_CHECKOUT_ENABLED, Login,
//      Owner/Admin des Mandanten, Angebot freigegeben, Stripe-Price aus
//      STRIPE_PRICE_VOICE_<ID> passt zum SSoT-Betrag → Abo-Checkout mit
//      metadata.product_type = 'voice_agent'.
//   2. stripe-webhook: Abo-Ereignisse mit product_type 'voice_agent' gehen
//      NICHT durch den Plan-Sync (der würde das Haupt-Abo des Mandanten
//      ersetzen und seine Add-ons widerrufen), sondern schreiben einen
//      Grant (source 'voice_subscription') → bots.voice in
//      tenant_entitlements() → bestehende Bereitstellung (tenant_voice_agents).
//
// Welches Angebot gilt, entscheidet der Stripe-Price des Abos, nicht die
// Metadaten: Metadaten setzt zwar nur unser Server, ein im Stripe-Dashboard
// getauschter Price muss aber trotzdem das passende Produkt freischalten.

import {
  isStandaloneVoiceOfferReleased,
  standaloneVoiceOfferById,
  VOICE_STANDALONE_OFFERS,
  type StandaloneVoiceOffer,
  type StandaloneVoiceOfferId,
} from './pricing.generated.ts';

export const VOICE_AGENT_PRODUCT_TYPE = 'voice_agent';
export const VOICE_GRANT_SOURCE = 'voice_subscription';

/** Server-Schalter: nur der exakte Wert `true` öffnet den Checkout. */
export function isVoiceCheckoutEnabled(value: string | null | undefined): boolean {
  return value === 'true';
}

/** Edge-Secret mit der Stripe-Price-ID eines Angebots, z. B. STRIPE_PRICE_VOICE_STARTER. */
export function voicePriceEnvName(offerId: StandaloneVoiceOfferId): string {
  return `STRIPE_PRICE_VOICE_${offerId.toUpperCase()}`;
}

/** Sentinel in products.stripe_price_id (Migration 20261118120000). */
export function voiceProductSentinel(offerId: StandaloneVoiceOfferId): string {
  return `internal_voice_agent_${offerId}`;
}

/** Wert für entitlement_grants.plan_key (Prüfpfad, nicht autorisierend). */
export function voicePlanKey(offerId: StandaloneVoiceOfferId): string {
  return `voice_agent_${offerId}`;
}

export type VoiceOfferResolution =
  | { ok: true; offer: StandaloneVoiceOffer }
  | { ok: false; code: 'UNKNOWN_OFFER' | 'OFFER_NOT_RELEASED' };

/** Angebot aus dem Request auflösen; nur freigegebene Angebote sind kaufbar. */
export function resolveVoiceOfferForCheckout(offerId: unknown): VoiceOfferResolution {
  const offer = typeof offerId === 'string' ? standaloneVoiceOfferById(offerId) : undefined;
  if (!offer) return { ok: false, code: 'UNKNOWN_OFFER' };
  if (!isStandaloneVoiceOfferReleased(offer)) return { ok: false, code: 'OFFER_NOT_RELEASED' };
  return { ok: true, offer };
}

/** Die Felder eines Stripe-Price, die für den Abgleich zählen. */
export interface VoiceStripePriceFacts {
  active: boolean;
  unit_amount: number | null;
  currency: string;
  recurring?: { interval: string; interval_count: number } | null;
}

export type VoicePriceCheck =
  | { ok: true }
  | { ok: false; reason: 'inactive' | 'currency' | 'not_monthly' | 'amount' };

/**
 * Der Stripe-Price muss aktiv, in Euro, monatlich (interval_count 1) und
 * betragsgleich zu `monthlyEur` sein. Lieber kein Checkout als ein anderer
 * Betrag als der angezeigte.
 */
export function checkVoiceStripePrice(price: VoiceStripePriceFacts, offer: StandaloneVoiceOffer): VoicePriceCheck {
  if (!price.active) return { ok: false, reason: 'inactive' };
  if (price.currency !== 'eur') return { ok: false, reason: 'currency' };
  const recurring = price.recurring ?? null;
  if (!recurring || recurring.interval !== 'month' || recurring.interval_count !== 1) {
    return { ok: false, reason: 'not_monthly' };
  }
  if (price.unit_amount !== Math.round(offer.monthlyEur * 100)) return { ok: false, reason: 'amount' };
  return { ok: true };
}

export function isVoiceAgentSubscription(metadata: Record<string, string> | null | undefined): boolean {
  return metadata?.product_type === VOICE_AGENT_PRODUCT_TYPE;
}

/**
 * Angebot zu einer Stripe-Price-ID über die konfigurierten Edge-Secrets.
 * Unbekannter Price → null (keine Freischaltung).
 */
export function voiceOfferIdForPrice(
  priceId: string | null | undefined,
  env: (name: string) => string | undefined,
): StandaloneVoiceOfferId | null {
  if (!priceId) return null;
  for (const offer of VOICE_STANDALONE_OFFERS) {
    const configured = env(voicePriceEnvName(offer.id))?.trim();
    if (configured && configured === priceId) return offer.id;
  }
  return null;
}

/**
 * Grant-Zustand aus dem Stripe-Abo-Status.
 *   active / trialing / past_due → active (Mahnlauf regelt Stripe; endet er
 *                                  erfolglos, folgt canceled bzw. unpaid)
 *   incomplete                   → skip (erste Zahlung offen, noch nichts gewähren)
 *   alles andere                 → revoked
 */
export type VoiceGrantDecision = 'active' | 'revoked' | 'skip';

export function voiceGrantDecision(status: string): VoiceGrantDecision {
  if (status === 'active' || status === 'trialing' || status === 'past_due') return 'active';
  if (status === 'incomplete') return 'skip';
  return 'revoked';
}

const RETURN_ORIGIN_RE =
  /^(https:\/\/(www\.)?realsyncdynamicsai\.de|https:\/\/([a-z0-9-]+\.)?realsyncdynamics-ai\.pages\.dev|http:\/\/localhost(:\d{1,5})?)$/;

/**
 * Basis-URL für success_url / cancel_url. Nur eigene Origins; alles andere
 * (fehlender oder fremder Origin-Header) fällt auf die öffentliche Seite zurück.
 */
export function voiceCheckoutReturnBase(origin: string | null | undefined, site: string): string {
  const o = origin?.trim() ?? '';
  return RETURN_ORIGIN_RE.test(o) ? o : site;
}
