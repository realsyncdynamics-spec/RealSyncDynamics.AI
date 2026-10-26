/**
 * Versionsfeste Felder einer Stripe-Rechnung.
 *
 * Der Webhook-Endpoint hat keine feste API-Version und bekommt Payloads in
 * der Konto-Standardversion (Stand 20.10.2026: `2026-04-22.dahlia`). Dort
 * gibt es `invoice.subscription` nicht mehr; die Abo-Zuordnung steht unter
 * `invoice.parent.subscription_details.subscription`. Das SDK-Pin
 * (`apiVersion: '2024-06-20'`) ändert daran nichts — es bestimmt nur die
 * Form der Antworten auf eigene API-Aufrufe, nicht die des Events.
 *
 * Folge auf main vor diesem Helfer: `syncInvoice` schrieb `tenant_id = NULL`
 * und `invoice.paid` fand keinen Mandanten, also ging keine Rechnungs-Mail
 * raus (Befund aus PR #1950). Dieser Helfer liest beide Formen.
 */

type IdOrObject = string | { id: string } | null | undefined;

export type InvoiceSubscriptionShape = {
  /** API-Versionen bis 2025-03 */
  subscription?: IdOrObject;
  /** API-Versionen ab `2025-03-31.basil` (inkl. `2026-04-22.dahlia`) */
  parent?: {
    subscription_details?: { subscription?: IdOrObject } | null;
  } | null;
};

function idOf(value: IdOrObject): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id ?? null;
}

/** Abo-ID einer Rechnung, unabhängig von der API-Version des Payloads. */
export function invoiceSubscriptionId(inv: InvoiceSubscriptionShape): string | null {
  return idOf(inv.subscription) ?? idOf(inv.parent?.subscription_details?.subscription);
}
