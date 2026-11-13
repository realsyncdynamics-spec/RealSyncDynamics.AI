/**
 * Testmodus-Anbindung von stripe-webhook an provision-tenant.
 *
 * Vertrag (Blueprint Abschnitt I, PR I-1):
 * - Wiederverwendet den bestehenden Orchestrator (trigger: checkout).
 * - Nur Stripe-Events mit livemode === false. Live-Events werden bewusst
 *   übersprungen — der produktive Webhook-Endpunkt wird nicht umkonfiguriert.
 * - Ohne tenant_id (metadata / client_reference_id) kein Aufruf.
 * - provision-tenant bleibt idempotent (Lauf in tenant_provisioning_runs).
 * - Mitgliedschaft bleibt public.memberships (prüft der Orchestrator selbst).
 *
 * Keine Deno-/Stripe-Imports, damit Vitest die Entscheidung testen kann.
 */

export type CheckoutProvisionDecision = 'enqueue' | 'skip_live' | 'skip_no_tenant';

export function decideCheckoutProvision(opts: {
  livemode: boolean;
  tenantId: string | null | undefined;
}): CheckoutProvisionDecision {
  const tenantId = typeof opts.tenantId === 'string' ? opts.tenantId.trim() : '';
  if (!tenantId) return 'skip_no_tenant';
  if (opts.livemode) return 'skip_live';
  return 'enqueue';
}

export interface CheckoutProvisionRequest {
  supabaseUrl: string;
  serviceRoleKey: string;
  tenantId: string;
  stripeEventId: string;
  fetchImpl?: typeof fetch;
}

export interface CheckoutProvisionResult {
  ok: boolean;
  status: number;
  conflict: boolean;
}

/**
 * Ruft POST /functions/v1/provision-tenant mit Service-Role und
 * trigger=checkout auf. HTTP 409 (BOOT_IN_PROGRESS / SUPERSEDED) gilt als
 * Erfolg: ein Lauf läuft bereits oder wurde übernommen, der Orchestrator
 * ist idempotent.
 */
export async function enqueueCheckoutProvision(
  req: CheckoutProvisionRequest,
): Promise<CheckoutProvisionResult> {
  const fetchImpl = req.fetchImpl ?? fetch;
  const url = `${req.supabaseUrl.replace(/\/$/, '')}/functions/v1/provision-tenant`;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${req.serviceRoleKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      tenant_id: req.tenantId,
      trigger: 'checkout',
      stripe_event_id: req.stripeEventId,
    }),
  });
  const conflict = response.status === 409;
  if (!response.ok && !conflict) {
    const body = await response.text().catch(() => '');
    throw new Error(`provision-tenant ${response.status}: ${body}`);
  }
  return { ok: true, status: response.status, conflict };
}
