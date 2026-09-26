import { planByKey } from '@/shared/pricing';
import { TerminalMessage } from '../useAgenticTerminal';

/**
 * Zahlungs-Meldungen des Terminals.
 *
 * ## Was hier bis 2026-09-14 stand
 *
 * Eine zweite, erfundene Bezahlwelt neben der echten:
 *
 *   - `createCheckoutSession()` baute `https://checkout.realsync.ai/${tier}-${Date.now()}`
 *     zusammen und gab eine `sessionId` mit `cs_`-Präfix zurück — Stripes
 *     eigenes Format — samt Ablauf nach 15 Minuten, Stripes Konvention. Der
 *     Host kommt im gesamten Repo genau einmal vor: in dieser Zeile. Der
 *     Nutzer bekam einen Bezahllink, der ins Nichts führte.
 *   - `TIER_CONFIGS` hielt eigene Preise neben `shared/pricing.ts`. Drei von
 *     vier waren falsch: Starter 49 statt 79, Agency 999 statt 699, Partner
 *     2999 statt 1999. Wer `/upgrade starter` tippte, sah 49 € und hätte 79 €
 *     bezahlt.
 *   - `createInvoiceRequest()` vergab Rechnungsnummern aus
 *     `Math.floor(Math.random() * 10000)` — kollisionsfähig und an keinen
 *     Vorgang gebunden. `formatInvoiceMessage()` meldete „IBAN transfer
 *     details included in email", ohne dass je eine Mail entstand.
 *   - Die Agent-Box versprach „Your 14-day trial starts now".
 *
 * Geblieben ist, was sich belegen lässt: Anzeigename und Preis kommen aus der
 * Pricing-SSoT, die Checkout-URL aus der echten Stripe-Session.
 */
export function formatUpgradeMessage(tier: string, checkoutUrl: string): TerminalMessage[] {
  // Preis und Name kommen aus `shared/pricing.ts` — derselben Quelle, aus der
  // die Edge Function `stripe-checkout` den Preis auflöst. Eine zweite
  // Preistabelle im Frontend kann nur auseinanderlaufen, und genau das war
  // passiert.
  const plan = planByKey(tier);
  if (!plan) {
    return [];
  }

  const messages: TerminalMessage[] = [];

  messages.push({
    id: crypto.randomUUID(),
    role: 'agent',
    content: `💳 ${plan.name} — €${plan.price.monthlyEur}/Monat`,
    timestamp: new Date(),
    type: 'info',
  });

  messages.push({
    id: crypto.randomUUID(),
    role: 'agent',
    content: `✓ Checkout: ${checkoutUrl}`,
    timestamp: new Date(),
    type: 'info',
  });

  messages.push({
    id: crypto.randomUUID(),
    role: 'agent',
    content: `┌─ PAYMENT AGENT ────────────────────┐
│ Der Link führt zu Stripe.           │
│ Abgerechnet wird erst nach          │
│ Abschluss dort.                     │
└────────────────────────────────────┘`,
    timestamp: new Date(),
    type: 'info',
  });

  return messages;
}
