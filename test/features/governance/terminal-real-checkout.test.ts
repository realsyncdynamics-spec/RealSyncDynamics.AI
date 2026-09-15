/**
 * Das Terminal darf keinen Bezahlweg erfinden.
 *
 * ## Warum das ein eigener Test ist
 *
 * `/upgrade <tier>` gab bis 2026-09-14 einen Bezahllink aus, der nirgendwo
 * hinführte: `https://checkout.realsync.ai/${tier}-${Date.now()}`, lokal
 * zusammengebaut, dazu eine `sessionId` mit `cs_`-Präfix — Stripes eigenes
 * Format — und ein Ablauf nach 15 Minuten, Stripes Konvention. Der Host kam
 * im gesamten Repo genau einmal vor: in dieser Zeile.
 *
 * Schlimmer noch war die Preisquelle. `TIER_CONFIGS` im PaymentAgent hielt
 * eigene Beträge neben `shared/pricing.ts`, und drei von vier wichen ab:
 *
 *     Starter  49 € statt  79 €
 *     Agency  999 € statt 699 €
 *     Partner 2999 € statt 1999 €
 *
 * Wer `/upgrade starter` tippte, las 49 € und hätte 79 € bezahlt. Preis-
 * angaben sind kein Anzeigedetail.
 *
 * `/pay <tier>` meldete „Invoice will be sent to your registered email
 * address" und „IBAN transfer details included in email", ohne einen
 * einzigen Aufruf zu machen.
 *
 * Seither läuft `/upgrade` über `billing/checkout.ts` → Edge Function
 * `stripe-checkout`, und Name wie Preis kommen aus der Pricing-SSoT.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { planByKey } from '../../../shared/pricing';

const ROOT = resolve(__dirname, '../../..');
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8');

const HOOK = read('src/features/governance/terminal/useAgenticTerminal.ts');
const PAYMENT_AGENT = read('src/features/governance/terminal/agents/PaymentAgent.ts');
const BARREL = read('src/features/governance/terminal/agents/index.ts');

/** Kommentare ausblenden — dort steht die Historie, warum es den Test gibt. */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('/upgrade im Terminal', () => {
  it('baut keine Checkout-URL selbst zusammen', () => {
    const source = code(PAYMENT_AGENT);
    expect(source).not.toContain('checkout.realsync.ai');
    expect(source).not.toContain('cs_');
    expect(source).not.toContain('Math.random(');
    // Im ganzen Repo darf der erfundene Host nirgends mehr auftauchen.
    expect(code(HOOK)).not.toContain('checkout.realsync.ai');
  });

  it('holt die Session von der echten Stripe-Runtime', () => {
    expect(HOOK).toContain("import { createCheckoutSession } from '../../billing/checkout'");
    expect(HOOK).toContain('await createCheckoutSession(activeTenantId, tier)');
    expect(HOOK).toContain('result.ok && result.url');
  });

  it('reicht die Auskunft der Runtime durch, statt sie zu ersetzen', () => {
    // createCheckoutSession unterscheidet unbekannten Plan, Free-Plan ohne
    // Checkout und Pläne, die nur über den Vertrieb laufen.
    expect(HOOK).toContain("result.error?.message ?? 'Checkout konnte nicht vorbereitet werden.'");
    expect(code(HOOK)).not.toContain('Invalid tier:');
  });

  it('startet ohne aktiven Workspace keinen Checkout', () => {
    const upgradeBlock = HOOK.slice(HOOK.indexOf("parsed.type === 'upgrade'"), HOOK.indexOf("parsed.type === 'audit'"));
    expect(upgradeBlock).toContain('Kein aktiver Workspace');
  });
});

describe('Preise im Terminal', () => {
  it('hält keine zweite Preistabelle', () => {
    const source = code(PAYMENT_AGENT);
    expect(source).not.toContain('TIER_CONFIGS');
    expect(source).not.toContain('monthlyPrice');
  });

  it('nimmt Name und Preis aus der Pricing-SSoT', () => {
    expect(PAYMENT_AGENT).toContain("import { planByKey } from '@/shared/pricing'");
    expect(PAYMENT_AGENT).toContain('const plan = planByKey(tier)');
    expect(PAYMENT_AGENT).toContain('plan.price.monthlyEur');
    expect(PAYMENT_AGENT).toContain('plan.name');
  });

  it('zeigt genau die Beträge, die die SSoT nennt', () => {
    // Die drei Abweichungen, die es gab — als Zahlen, damit ein Rückfall auf
    // eine eigene Tabelle sofort auffällt.
    expect(planByKey('starter')?.price.monthlyEur).toBe(79);
    expect(planByKey('growth')?.price.monthlyEur).toBe(249);
    expect(planByKey('agency')?.price.monthlyEur).toBe(699);

    for (const stale of ['49', '999', '2999']) {
      expect(code(PAYMENT_AGENT)).not.toContain(`monthlyPrice: ${stale}`);
    }
  });
});

describe('/pay im Terminal', () => {
  it('behauptet keine verschickte Rechnung', () => {
    const source = code(HOOK) + code(PAYMENT_AGENT) + BARREL;
    expect(source).not.toContain('Invoice will be sent');
    expect(source).not.toContain('IBAN transfer details');
    expect(source).not.toContain('createInvoiceRequest');
    expect(source).not.toContain('formatInvoiceMessage');
  });

  it('nennt die Wege, die es wirklich gibt', () => {
    expect(HOOK).toContain('/contact-sales');
    expect(HOOK).toContain('/app/billing');
  });
});
