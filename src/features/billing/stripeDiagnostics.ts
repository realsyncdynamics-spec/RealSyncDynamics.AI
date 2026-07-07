// Stripe checkout diagnostics — maps a categorised failure status to a
// user-facing explanation + a next operator action. Never displays
// secret values; never echoes raw Stripe error bodies to the user.
//
// Used by CheckoutPage to render a clear failure surface instead of
// the default "Etwas ist schiefgelaufen" so that the founder/operator
// can fix the actual configuration issue in <60 seconds.

export type StripeDiagnosticStatus =
  | 'ready'
  | 'missing_price_id'
  | 'missing_user'
  | 'missing_tenant'
  | 'edge_function_error'
  | 'client_network_error'
  | 'webhook_signature_failed'
  | 'unknown';

export interface StripeDiagnostic {
  status: StripeDiagnosticStatus;
  title: string;
  message: string;
  action: string;
  /** Runbook anchor for the on-call operator. */
  runbook: string;
}

export function getStripeDiagnostic(status: StripeDiagnosticStatus): StripeDiagnostic {
  switch (status) {
    case 'ready':
      return {
        status,
        title: 'Checkout bereit',
        message: 'User, Tenant und Stripe Price ID sind vorhanden.',
        action: 'Weiter zu Stripe Checkout.',
        runbook: 'docs/runbooks/stripe-production-checkout.md#manual-test',
      };

    case 'missing_price_id':
      return {
        status,
        title: 'Dieser Plan ist gerade nicht verfügbar',
        message: 'Der ausgewählte Plan ist noch nicht vollständig konfiguriert.',
        action: 'Bitte versuchen Sie es später erneut oder kontaktieren Sie den Support.',
        runbook: 'docs/runbooks/stripe-production-checkout.md#required-db-rows',
      };

    case 'missing_user':
      return {
        status,
        title: 'Login erforderlich',
        message: 'Für den Checkout muss der Nutzer angemeldet sein.',
        action: 'Nutzer zu /welcome?next=/checkout/<plan> weiterleiten.',
        runbook: 'docs/runbooks/stripe-production-checkout.md#manual-test',
      };

    case 'missing_tenant':
      return {
        status,
        title: 'Workspace fehlt',
        message: 'Für Billing und Governance muss zuerst ein Workspace/Tenant existieren.',
        action: 'Onboarding starten oder Tenant automatisch via auto_tenant_on_signup-Trigger erzeugen.',
        runbook: 'docs/runbooks/stripe-production-checkout.md#failure-modes',
      };

    case 'edge_function_error':
      return {
        status,
        title: 'Checkout konnte nicht vorbereitet werden',
        message: 'Es gab einen technischen Fehler bei der Vorbereitung des Checkouts.',
        action: 'Bitte versuchen Sie es in wenigen Minuten erneut. Wenn das Problem weiterhin auftritt, kontaktieren Sie support@realsyncdynamicsai.de',
        runbook: 'docs/runbooks/stripe-production-checkout.md#failure-modes',
      };

    case 'client_network_error':
      return {
        status,
        title: 'Verbindungsfehler',
        message:
          'Die Verbindung zum Server konnte nicht hergestellt werden.',
        action:
          'Überprüfen Sie Ihre Internetverbindung. Falls Sie Ad-Blocker oder VPN verwenden, deaktivieren Sie diese bitte für diese Seite und versuchen Sie es erneut.',
        runbook: 'docs/runbooks/stripe-production-checkout.md#failure-modes',
      };

    case 'webhook_signature_failed':
      return {
        status,
        title: 'Webhook-Signatur ungültig',
        message: 'Der stripe-webhook Endpoint hat die HMAC-Signatur nicht verifizieren können.',
        action: 'STRIPE_WEBHOOK_SECRET in Vault gegen Stripe-Dashboard abgleichen — selbst kleinste Whitespace-Unterschiede brechen die Verifikation.',
        runbook: 'docs/runbooks/stripe-production-checkout.md#failure-modes',
      };

    default:
      return {
        status: 'unknown',
        title: 'Unbekannter Checkout-Fehler',
        message: 'Der Checkout konnte nicht vorbereitet werden.',
        action: 'Edge-Function-Logs prüfen und Statuscode auswerten.',
        runbook: 'docs/runbooks/stripe-production-checkout.md',
      };
  }
}

/**
 * Map a Supabase Functions error / Stripe API error to a diagnostic status.
 * Returns 'unknown' when no rule matches — the operator gets the raw status
 * code in the logs but the user only sees a generic failure surface.
 */
export function classifyStripeError(error: unknown): StripeDiagnosticStatus {
  if (!error) return 'unknown';
  const name = String((error as { name?: unknown }).name ?? '').toLowerCase();
  const msg = String((error as { message?: unknown }).message ?? error).toLowerCase();
  // supabase-js FunctionsFetchError: the fetch() to the Edge Function itself
  // failed (request never reached the server) — e.g. ad-/tracking-blocker,
  // offline, DNS/firewall. Must be checked before the generic 'edge' match
  // below, since this message also contains "Edge Function".
  if (name === 'functionsfetcherror' || msg.includes('failed to send a request')) return 'client_network_error';
  if (msg.includes('price') && (msg.includes('not found') || msg.includes('missing'))) return 'missing_price_id';
  if (msg.includes('webhook') && msg.includes('signature')) return 'webhook_signature_failed';
  if (msg.includes('unauthorized') || msg.includes('401')) return 'missing_user';
  if (msg.includes('tenant')) return 'missing_tenant';
  if (msg.includes('functioninvocation') || msg.includes('non-2xx') || msg.includes('edge')) return 'edge_function_error';
  return 'unknown';
}
