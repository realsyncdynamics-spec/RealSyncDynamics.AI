// Typen für den Konversionspfad Free Audit → 14-Tage-Pilot → Governance Runtime.
//
// Bewusst schlank gehalten: hier stehen nur die Formen, die über die
// Netzwerkgrenze zur Edge Function `pilot-activate` gehen, sowie die Felder des
// Audit-Reports, die das Frontend tatsächlich anfasst. Die vollständige
// Tabellenform von `gdpr_audits` wird NICHT gespiegelt — sie gehört in die
// generierten Supabase-Typen, nicht in eine handgepflegte Kopie.

/** Schweregrad eines einzelnen Befunds (`gdpr_audits.issues[]`). */
export type AuditIssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Gesamtbewertung eines Audits (`gdpr_audits.severity`).
 * Nicht identisch mit `AuditIssueSeverity`: hier gibt es `pass`, dort `info`.
 */
export type AuditOverallSeverity = 'critical' | 'high' | 'medium' | 'low' | 'pass';

export interface AuditIssue {
  id: string;
  severity: AuditIssueSeverity;
  title: string;
  detail: string;
  paragraph_ref?: string;
}

/** Antwort der öffentlichen Edge Function `gdpr-audit`. */
export interface AuditReport {
  audit_id: string;
  domain: string;
  score: number;
  severity: AuditOverallSeverity;
  issues: AuditIssue[];
  created_at?: string;
  email?: string;
  fetched?: boolean;
  fetched_status?: number | null;
  fetch_error?: string | null;
}

/**
 * Die Felder von `public.gdpr_audits`, die nach dem Claim für den Tenant
 * relevant sind. `user_id`/`tenant_id`/`claimed_at` sind NULL, solange der
 * Audit anonym ist.
 */
export interface GdprAudit {
  id: string;
  domain: string;
  score: number;
  severity: AuditOverallSeverity;
  issues: AuditIssue[];
  created_at: string;
  user_id: string | null;
  tenant_id: string | null;
  claimed_at: string | null;
}

/**
 * Request-Body von `pilot-activate`.
 *
 * `audit_id` und `domain` sind Nachschlage-Werte, keine Autorisierung — die
 * Identität leitet der Server ausschließlich aus dem JWT ab.
 */
export interface PilotActivationRequest {
  audit_id: string;
  domain: string;
  analytics_consent?: boolean;
}

/** Was mit der Subscription beim Pilot-Start geschehen ist. */
export type PilotSubscriptionAction = 'create' | 'reuse' | 'upgrade' | 'preserve';

export interface PilotActivationResponse {
  ok: true;
  request_id: string;
  tenant_id: string;
  audit_id: string;
  domain: string;
  /** true, wenn der Audit diesem Tenant bereits gehörte (wiederholter Aufruf). */
  idempotent_replay: boolean;
  /** false, wenn die Domain-Registrierung stand, das Monitoring aber nicht. */
  monitoring_enrolled: boolean;
  subscription: {
    plan_key: string | null;
    status: string | null;
    trial_start: string | null;
    trial_end: string | null;
    action: PilotSubscriptionAction;
  } | null;
}

/** Fehlercodes von `pilot-activate`. Stabiler Vertrag zum Frontend. */
export type PilotActivationErrorCode =
  | 'UNAUTHORIZED'
  | 'INVALID_INPUT'
  | 'INVALID_DOMAIN'
  | 'AUDIT_NOT_FOUND'
  | 'AUDIT_EXPIRED'
  | 'AUDIT_DOMAIN_MISMATCH'
  | 'AUDIT_ALREADY_CLAIMED'
  | 'TENANT_NOT_FOUND'
  | 'TENANT_ACCESS_DENIED'
  | 'PILOT_ALREADY_ACTIVE'
  | 'PILOT_ACTIVATION_FAILED'
  | 'SUBSCRIPTION_CREATION_FAILED'
  | 'DOMAIN_REGISTRATION_FAILED'
  | 'BILLING_CONFIGURATION_ERROR'
  | 'METHOD_NOT_ALLOWED';

/** Einheitliches Fehlerformat aus `_shared/gateway.ts`. */
export interface PilotActivationError {
  ok: false;
  error: {
    code: PilotActivationErrorCode;
    message: string;
    details?: unknown;
  };
}

/** Deutschsprachige, nutzerlesbare Meldung je Fehlercode. */
export const PILOT_ERROR_MESSAGES: Record<PilotActivationErrorCode, string> = {
  UNAUTHORIZED: 'Sitzung abgelaufen. Bitte erneut anmelden.',
  INVALID_INPUT: 'Die Audit-Referenz ist unvollständig.',
  INVALID_DOMAIN: 'Die Domain ist ungültig.',
  AUDIT_NOT_FOUND: 'Dieser Audit wurde nicht gefunden.',
  AUDIT_EXPIRED: 'Dieser Audit ist älter als 14 Tage. Bitte einen neuen Scan starten.',
  AUDIT_DOMAIN_MISMATCH: 'Die Domain passt nicht zu diesem Audit.',
  AUDIT_ALREADY_CLAIMED: 'Dieser Audit gehört bereits zu einem anderen Workspace.',
  TENANT_NOT_FOUND: 'Zu diesem Konto wurde kein Workspace gefunden.',
  TENANT_ACCESS_DENIED: 'Kein Zugriff auf diesen Workspace.',
  PILOT_ALREADY_ACTIVE: 'Der Pilot läuft bereits.',
  PILOT_ACTIVATION_FAILED: 'Die Aktivierung ist fehlgeschlagen. Bitte erneut versuchen.',
  SUBSCRIPTION_CREATION_FAILED: 'Der Pilot konnte nicht gestartet werden.',
  DOMAIN_REGISTRATION_FAILED: 'Die Domain konnte nicht registriert werden.',
  BILLING_CONFIGURATION_ERROR: 'Die Abrechnung ist derzeit nicht verfügbar.',
  METHOD_NOT_ALLOWED: 'Ungültige Anfrage.',
};

/** Typ-Guard: unterscheidet Erfolg von Fehler ohne `any`. */
export function isPilotActivationError(value: unknown): value is PilotActivationError {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { ok?: unknown; error?: { code?: unknown } };
  return candidate.ok === false && typeof candidate.error?.code === 'string';
}
