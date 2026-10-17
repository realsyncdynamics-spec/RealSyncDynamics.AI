// Client-Seite von /checkout/success: Antwort von `stripe-checkout-verify`
// deuten. Die Entscheidung, ob bezahlt und freigeschaltet ist, trifft nur der
// Server (Stripe-Session, payment_status, metadata.tenant_id, Abo-Zeile).
// Hier steht nur, wie die Seite darauf reagiert: Wortlaut, Wiederholbarkeit,
// Reihenfolge der Workspaces und welcher Plan angezeigt wird.

export type VerifyOutcome =
  | {
    ok: true;
    pending: boolean;
    subscription?: { id?: string; plan_key?: string | null } | null;
  }
  | { ok: false; code: string; message: string };

/** Client-seitige Codes zusätzlich zu den Codes der Edge Function. */
export const VERIFY_TIMEOUT = 'TIMEOUT';
export const VERIFY_NETWORK = 'NETWORK';

const MESSAGES: Record<string, string> = {
  SESSION_INCOMPLETE:
    'Der Checkout ist bei Stripe noch nicht abgeschlossen. Bitte schließen Sie die Zahlung ab oder starten Sie den Checkout neu.',
  PAYMENT_INCOMPLETE:
    'Stripe hat die Zahlung noch nicht bestätigt. Bei Lastschrift kann das einige Minuten dauern.',
  NO_SUBSCRIPTION: 'Zu diesem Checkout gehört kein Abo. Bitte wenden Sie sich an den Support.',
  TENANT_MISMATCH:
    'Der Checkout gehört zu einem anderen Workspace. Bitte melden Sie sich mit dem Konto an, mit dem Sie bezahlt haben.',
  FORBIDDEN: 'Sie sind kein Mitglied des Workspaces, für den bezahlt wurde.',
  UNAUTHORIZED: 'Ihre Anmeldung ist abgelaufen. Bitte melden Sie sich erneut an.',
  STRIPE_ERROR: 'Stripe ist gerade nicht erreichbar. Bitte versuchen Sie es gleich noch einmal.',
  STRIPE_NOT_CONFIGURED: 'Die Zahlungsprüfung ist derzeit nicht verfügbar. Bitte versuchen Sie es später erneut.',
  [VERIFY_TIMEOUT]: 'Die Prüfung hat zu lange gedauert. Bitte versuchen Sie es erneut.',
  [VERIFY_NETWORK]: 'Keine Verbindung zum Server. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut.',
};

const FALLBACK_MESSAGE = 'Der Checkout konnte nicht verifiziert werden.';

/** Deutscher Text für einen Fehlercode; unbekannte Codes bekommen einen neutralen Satz. */
export function verifyErrorMessage(code: string): string {
  return MESSAGES[code] ?? FALLBACK_MESSAGE;
}

// Endgültig: ein erneuter Aufruf mit derselben Session ändert nichts.
const FINAL = new Set(['NO_SUBSCRIPTION', 'TENANT_MISMATCH', 'FORBIDDEN', 'BAD_REQUEST']);

/** Lohnt sich „Erneut prüfen“? Zahlung in Bearbeitung, Stripe- und Netzfehler: ja. */
export function isRetriableVerifyError(code: string): boolean {
  return !FINAL.has(code);
}

/**
 * Reihenfolge, in der die Workspaces gegen die Session geprüft werden:
 * zuerst der aktive, dann die übrigen, in denen der Nutzer Owner/Admin ist
 * (nur die dürfen einen Checkout starten). Der Server prüft Mitgliedschaft
 * und `metadata.tenant_id`; ein falscher Kandidat liefert nur TENANT_MISMATCH.
 */
export function tenantCandidates(
  activeTenantId: string | null,
  tenants: ReadonlyArray<{ tenantId: string; role: string }>,
): string[] {
  const out: string[] = [];
  if (activeTenantId) out.push(activeTenantId);
  for (const t of tenants) {
    if ((t.role === 'owner' || t.role === 'admin') && !out.includes(t.tenantId)) {
      out.push(t.tenantId);
    }
  }
  return out;
}

/**
 * Angezeigter Plan: der Plan der verifizierten Abo-Zeile. `plan_key` aus der
 * URL ist nur ein Hinweis aus dem Redirect und gilt bloß, solange die Zeile
 * noch fehlt (Sync ausstehend).
 */
export function resolveVerifiedPlan(
  subscription: { plan_key?: string | null } | null | undefined,
  urlPlanKey: string | null,
): string | null {
  const fromRow = subscription?.plan_key;
  if (typeof fromRow === 'string' && fromRow.length > 0) return fromRow;
  return urlPlanKey && urlPlanKey.length > 0 ? urlPlanKey : null;
}

/** Edge-Function-Antwort (Status + JSON) in ein VerifyOutcome übersetzen. */
export function parseVerifyResponse(httpOk: boolean, data: unknown): VerifyOutcome {
  const body = (data ?? {}) as {
    ok?: boolean;
    pending?: boolean;
    subscription?: { id?: string; plan_key?: string | null } | null;
    error?: { code?: string; message?: string } | string;
    code?: string;
    message?: string;
  };
  if (httpOk && body.ok === true) {
    return { ok: true, pending: body.pending === true, subscription: body.subscription ?? null };
  }
  const err = typeof body.error === 'object' && body.error !== null ? body.error : null;
  const code = err?.code || body.code || 'UNKNOWN';
  return { ok: false, code, message: verifyErrorMessage(code) };
}
