/**
 * Eigenständiges Voice-Agent-Abo: Kauf (checkout-voice-agent) und
 * Freischaltung (stripe-webhook → entitlement_grants, source voice_subscription).
 *
 * Geprüft wird vor allem, was schiefgehen darf, ohne dass es jemand merkt:
 * ein Voice-Abo im Plan-Sync (ersetzt das Haupt-Abo, widerruft Add-ons),
 * ein Kauf ohne bestätigtes Minutenkontingent, ein abweichender Stripe-Betrag.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkVoiceStripePrice,
  isVoiceAgentSubscription,
  isVoiceCheckoutEnabled,
  resolveVoiceOfferForCheckout,
  voiceCheckoutReturnBase,
  voiceGrantDecision,
  voiceOfferIdForPrice,
  voicePriceEnvName,
  voiceProductSentinel,
} from '../../supabase/functions/_shared/voice-agent-checkout';
import {
  isStandaloneVoiceOfferReleased,
  standaloneVoiceOfferById,
  VOICE_STANDALONE_OFFERS,
  type StandaloneVoiceOffer,
} from '../../shared/pricing';
import { canOfferVoiceCheckout, voiceCheckoutFlagEnabled } from '../../src/config/voice-checkout';
import { UNBACKED_CALLERS } from '../../src/config/production-edge-functions';

const root = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

const released: StandaloneVoiceOffer = {
  id: 'starter', name: 'Starter', monthlyEur: 89, availability: 'preview', monthlyMinutes: 300, extraMinuteEur: null, bullets: ['x'],
};
const monthly = { active: true, currency: 'eur', unit_amount: 8900, recurring: { interval: 'month', interval_count: 1 } };

describe('Voice-Angebote in der Pricing-SSoT', () => {
  it('Beträge unverändert (89 / 199 / 349 €), K5-Zielwerte eingetragen, nichts freigegeben', () => {
    expect(VOICE_STANDALONE_OFFERS.map((o) => [o.id, o.monthlyEur])).toEqual([
      ['starter', 89], ['professional', 199], ['kanzlei_praxis', 349],
    ]);
    expect(VOICE_STANDALONE_OFFERS.map((o) => [o.id, o.monthlyMinutes, o.extraMinuteEur])).toEqual([
      ['starter', 500, 0.19], ['professional', 1200, 0.17], ['kanzlei_praxis', 2500, 0.16],
    ]);
    for (const o of VOICE_STANDALONE_OFFERS) {
      expect(o.bullets).toEqual([]);
      expect(isStandaloneVoiceOfferReleased(o)).toBe(false);
    }
  });

  it('freigegeben erst mit Minuten > 0 und Leistungsumfang', () => {
    expect(isStandaloneVoiceOfferReleased(released)).toBe(true);
    expect(isStandaloneVoiceOfferReleased({ ...released, bullets: [] })).toBe(false);
    expect(isStandaloneVoiceOfferReleased({ ...released, monthlyMinutes: 0 })).toBe(false);
    expect(isStandaloneVoiceOfferReleased({ ...released, monthlyMinutes: null })).toBe(false);
  });
});

describe('checkout-voice-agent — Regeln', () => {
  it('Server-Schalter nur bei exakt "true"', () => {
    expect(isVoiceCheckoutEnabled('true')).toBe(true);
    for (const v of [undefined, null, '', 'TRUE', '1', 'yes', ' true']) expect(isVoiceCheckoutEnabled(v as string)).toBe(false);
  });

  it('lehnt unbekannte und nicht freigegebene Angebote ab', () => {
    expect(resolveVoiceOfferForCheckout('enterprise')).toEqual({ ok: false, code: 'UNKNOWN_OFFER' });
    expect(resolveVoiceOfferForCheckout(42)).toEqual({ ok: false, code: 'UNKNOWN_OFFER' });
    expect(resolveVoiceOfferForCheckout('starter')).toEqual({ ok: false, code: 'OFFER_NOT_RELEASED' });
  });

  it('Stripe-Price muss aktiv, EUR, monatlich und betragsgleich sein', () => {
    expect(checkVoiceStripePrice(monthly, released)).toEqual({ ok: true });
    expect(checkVoiceStripePrice({ ...monthly, active: false }, released)).toEqual({ ok: false, reason: 'inactive' });
    expect(checkVoiceStripePrice({ ...monthly, currency: 'usd' }, released)).toEqual({ ok: false, reason: 'currency' });
    expect(checkVoiceStripePrice({ ...monthly, recurring: null }, released)).toEqual({ ok: false, reason: 'not_monthly' });
    expect(checkVoiceStripePrice({ ...monthly, recurring: { interval: 'year', interval_count: 1 } }, released))
      .toEqual({ ok: false, reason: 'not_monthly' });
    expect(checkVoiceStripePrice({ ...monthly, recurring: { interval: 'month', interval_count: 3 } }, released))
      .toEqual({ ok: false, reason: 'not_monthly' });
    expect(checkVoiceStripePrice({ ...monthly, unit_amount: 7900 }, released)).toEqual({ ok: false, reason: 'amount' });
  });

  it('Price-IDs nur über Edge-Secrets, Zuordnung zurück über denselben Namen', () => {
    expect(voicePriceEnvName('kanzlei_praxis')).toBe('STRIPE_PRICE_VOICE_KANZLEI_PRAXIS');
    const env: Record<string, string> = { STRIPE_PRICE_VOICE_PROFESSIONAL: 'price_pro' };
    expect(voiceOfferIdForPrice('price_pro', (n) => env[n])).toBe('professional');
    expect(voiceOfferIdForPrice('price_other', (n) => env[n])).toBeNull();
    expect(voiceOfferIdForPrice(null, (n) => env[n])).toBeNull();
    // Leerer Secret-Wert darf keinen leeren Price zuordnen.
    expect(voiceOfferIdForPrice('', () => '')).toBeNull();
  });

  it('Rücksprung nur auf eigene Origins', () => {
    const site = 'https://realsyncdynamicsai.de';
    expect(voiceCheckoutReturnBase('https://realsyncdynamicsai.de', site)).toBe('https://realsyncdynamicsai.de');
    expect(voiceCheckoutReturnBase('https://abc123.realsyncdynamics-ai.pages.dev', site)).toBe('https://abc123.realsyncdynamics-ai.pages.dev');
    expect(voiceCheckoutReturnBase('http://localhost:5173', site)).toBe('http://localhost:5173');
    expect(voiceCheckoutReturnBase('https://evil.example', site)).toBe(site);
    expect(voiceCheckoutReturnBase('https://realsyncdynamicsai.de.evil.example', site)).toBe(site);
    expect(voiceCheckoutReturnBase(null, site)).toBe(site);
  });

  it('Edge Function: Schalter zuerst, Rolle owner/admin, kein Price aus dem Body', () => {
    const src = read('supabase/functions/checkout-voice-agent/index.ts');
    expect(src.indexOf("isVoiceCheckoutEnabled(Deno.env.get('VOICE_CHECKOUT_ENABLED'))"))
      .toBeLessThan(src.indexOf("req.headers.get('Authorization')"));
    expect(src).toMatch(/membership\.role !== 'owner' && membership\.role !== 'admin'/);
    expect(src).not.toMatch(/body\.(price|price_id|amount|stripe_price_id)/);
    expect(src).toContain("mode: 'subscription'");
    expect(src).toContain('subscription_data: { metadata }');
    expect(src).toContain('ALREADY_SUBSCRIBED');
  });
});

describe('stripe-webhook — Voice-Abo neben dem Haupt-Abo', () => {
  const src = read('supabase/functions/stripe-webhook/index.ts');

  it('Voice-Abos laufen NICHT durch syncSubscription/syncAddonItems', () => {
    const block = src.slice(src.indexOf("case 'customer.subscription.deleted': {"), src.indexOf("case 'customer.subscription.trial_will_end'"));
    const guard = block.indexOf('if (isVoiceAgentSubscription(sub.metadata))');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(block.indexOf('syncSubscription(admin, sub)'));
    const voiceBranch = block.slice(guard, block.indexOf('break;', guard));
    expect(voiceBranch).toContain('syncVoiceAgentSubscription');
    expect(voiceBranch).toContain('enqueueVoiceAgent');
    expect(voiceBranch).not.toContain('syncAddonItems');
  });

  it('kein Bot-Budget-Plan aus dem Voice-Checkout', () => {
    expect(src).toContain("session.mode === 'subscription' && !isVoiceAgentSubscription(session.metadata)");
  });

  it('Grant idempotent je Abo, nur für freigegebene Angebote', () => {
    const fn = src.slice(src.indexOf('async function syncVoiceAgentSubscription'));
    expect(fn).toContain("onConflict: 'source,purchase_reference'");
    expect(fn).toContain('purchase_reference: sub.id');
    expect(fn).toContain('isStandaloneVoiceOfferReleased(pricedOffer)');
  });

  it('Grant-Zustand aus dem Abo-Status', () => {
    for (const s of ['active', 'trialing', 'past_due']) expect(voiceGrantDecision(s)).toBe('active');
    expect(voiceGrantDecision('incomplete')).toBe('skip');
    for (const s of ['canceled', 'unpaid', 'incomplete_expired', 'paused']) expect(voiceGrantDecision(s)).toBe('revoked');
  });

  it('erkennt Voice-Abos nur an product_type voice_agent', () => {
    expect(isVoiceAgentSubscription({ product_type: 'voice_agent' })).toBe(true);
    expect(isVoiceAgentSubscription({ product_type: 'managed_website' })).toBe(false);
    expect(isVoiceAgentSubscription(undefined)).toBe(false);
  });
});

describe('Migration 20261118120000', () => {
  const sql = read('supabase/migrations/20261118120000_voice_agent_standalone_subscription.sql');

  it('additiv: neue Grant-Quelle, bestehende Quellen bleiben', () => {
    for (const s of ['one_time_purchase', 'manual', 'promotion', 'migration', 'addon_subscription', 'voice_subscription']) {
      expect(sql).toContain(`'${s}'`);
    }
    expect(sql).not.toMatch(/\b(DROP TABLE|DELETE FROM|TRUNCATE|DROP COLUMN)\b/i);
  });

  it('ein Produkt je Angebot, Sentinel passt zum Webhook', () => {
    for (const o of VOICE_STANDALONE_OFFERS) expect(sql).toContain(`'${voiceProductSentinel(o.id)}'`);
  });

  it('setzt kein Minutenkontingent (kommt mit der Freigabe)', () => {
    expect(sql).not.toContain("'limit.bot_voice_minutes_monthly'");
  });
});

describe('Oberfläche', () => {
  it('Kauf-Knopf nur mit Schalter, Deploy und Freigabe', () => {
    expect(voiceCheckoutFlagEnabled(undefined)).toBe(false);
    expect(voiceCheckoutFlagEnabled('true')).toBe(true);
    expect(canOfferVoiceCheckout(released, true, true)).toBe(true);
    expect(canOfferVoiceCheckout(released, false, true)).toBe(false);
    expect(canOfferVoiceCheckout(released, true, false)).toBe(false);
    expect(canOfferVoiceCheckout(standaloneVoiceOfferById('starter')!, true, true)).toBe(false);
  });

  it('checkout-voice-agent ist als noch nicht deployt eingetragen', () => {
    expect(UNBACKED_CALLERS.map((c) => c.slug)).toContain('checkout-voice-agent');
  });

  it('Route, noindex und Zustimmung zum Widerrufsrecht', () => {
    expect(read('src/App.tsx')).toContain('<Route path="/voice/checkout/:offerId" element={<VoiceCheckoutPage />} />');
    expect(read('public/robots.txt')).toContain('Disallow: /voice/checkout/');
    const page = read('src/pages/VoiceCheckoutPage.tsx');
    expect(page).toContain('noIndex');
    expect(page).toContain('§§ 356 Abs. 5, 327 BGB');
    expect(page).toContain('disabled={!agreedToTerms || !acknowledgedWithdrawal || redirecting}');
  });
});
