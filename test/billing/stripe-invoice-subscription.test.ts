/**
 * Rechnung → Abo-ID, versionsfest.
 *
 * Der Webhook-Endpoint liefert Payloads in der Konto-Standardversion
 * (`2026-04-22.dahlia`): `invoice.subscription` fehlt, die Abo-ID steht unter
 * `invoice.parent.subscription_details.subscription`. Vor diesem Helfer blieb
 * `invoices.tenant_id` leer und die Rechnungs-Mail wurde nie verschickt.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { invoiceSubscriptionId } from '../../supabase/functions/_shared/stripe-invoice';

describe('invoiceSubscriptionId', () => {
  it('liest die Abo-ID aus dem alten Feld `subscription` (String)', () => {
    expect(invoiceSubscriptionId({ subscription: 'sub_old' })).toBe('sub_old');
  });

  it('liest die Abo-ID aus dem alten Feld `subscription` (expandiertes Objekt)', () => {
    expect(invoiceSubscriptionId({ subscription: { id: 'sub_obj' } })).toBe('sub_obj');
  });

  it('liest die Abo-ID aus `parent.subscription_details.subscription` (dahlia)', () => {
    expect(
      invoiceSubscriptionId({ parent: { subscription_details: { subscription: 'sub_dahlia' } } }),
    ).toBe('sub_dahlia');
    expect(
      invoiceSubscriptionId({ parent: { subscription_details: { subscription: { id: 'sub_dahlia_obj' } } } }),
    ).toBe('sub_dahlia_obj');
  });

  it('bevorzugt das alte Feld, wenn beide gesetzt sind', () => {
    expect(
      invoiceSubscriptionId({ subscription: 'sub_a', parent: { subscription_details: { subscription: 'sub_b' } } }),
    ).toBe('sub_a');
  });

  it('liefert null für Einmalkäufe ohne Abo (beide Formen)', () => {
    expect(invoiceSubscriptionId({})).toBeNull();
    expect(invoiceSubscriptionId({ subscription: null, parent: null })).toBeNull();
    expect(invoiceSubscriptionId({ parent: { subscription_details: null } })).toBeNull();
  });
});

describe('stripe-webhook nutzt den Helfer statt `inv.subscription`', () => {
  const src = readFileSync(resolve(__dirname, '../../supabase/functions/stripe-webhook/index.ts'), 'utf8');

  it('liest die Abo-ID einer Rechnung nirgends mehr direkt', () => {
    expect(src).not.toMatch(/inv\.subscription\b/);
    expect(src).toContain("from '../_shared/stripe-invoice.ts'");
  });

  it('ruft den Helfer in syncInvoice und im invoice.paid-Mailpfad auf', () => {
    expect(src.match(/invoiceSubscriptionId\(/g)?.length).toBe(2);
  });
});
