/**
 * Übernahme eines anonymen Audits in einen Mandanten — Fehlerbild und
 * Eingabeprüfung.
 *
 * ## Ein Schreiber
 *
 * Geschrieben wird ausschließlich durch die RPC `claim_gdpr_audit`
 * (SECURITY DEFINER, `supabase/migrations/20260830091500_claim_gdpr_audit.sql`,
 * gehärtet durch #1865/#1867). Sie prüft im selben Statement:
 *
 * - angemeldeter Nutzer (`auth.uid()`),
 * - E-Mail des Audits = E-Mail des Kontos,
 * - Mitgliedschaft im Ziel-Mandanten,
 * - noch nicht übernommen (`claimed_at IS NULL`, Zeilensperre).
 *
 * Bis 2026-10-13 gab es daneben einen zweiten Schreiber: Die Edge Function
 * `audit-claim` übernahm mit der Service-Role, und ihr Vertrauensmodell war
 * „wer die `audit_id` kennt, darf sie einmal übernehmen". Die Kennung steht
 * im teilbaren Ergebnis-Link `/audit/result/:id`. Jedes selbst registrierte
 * Konto konnte damit ein fremdes Audit in den eigenen Mandanten ziehen — und
 * der eigentliche Inhaber hätte es danach nie mehr übernehmen können. Die
 * Function ruft jetzt dieselbe RPC mit dem Token des Nutzers auf; die
 * Service-Role schreibt `gdpr_audits` nicht mehr.
 *
 * ## Was diese Datei tut
 *
 * Sie übersetzt die Ausnahmen der RPC in stabile Codes, HTTP-Status und
 * verständliche Meldungen — gleich für Edge Function und Browser. Pure
 * Funktionen ohne Netzwerk und ohne Deno-APIs, direkt unter Vitest prüfbar.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Kennungen werden geprüft, bevor sie in eine Abfrage gehen. */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export type ClaimErrorCode =
  | 'UNAUTHENTICATED'
  | 'EMAIL_UNVERIFIED'
  | 'TENANT_NOT_FOUND'
  | 'TENANT_SELECTION_REQUIRED'
  | 'TENANT_FORBIDDEN'
  | 'TENANT_SELECTION_UNAVAILABLE'
  | 'NOT_FOUND'
  | 'OWNERSHIP_NOT_VERIFIED'
  | 'OWNERSHIP_INCONSISTENT'
  | 'ALREADY_CLAIMED'
  | 'CONFLICT_RETRY'
  | 'INTERNAL';

export interface ClaimErrorInfo {
  code: ClaimErrorCode;
  httpStatus: number;
  /**
   * Ein späterer Versuch kann gelingen, ohne dass sich am Audit etwas
   * ändert — etwa nach der E-Mail-Bestätigung oder der Auswahl eines
   * Arbeitsbereichs. Der Browser behält dann die gemerkte Kennung.
   */
  retryable: boolean;
  message: string;
}

const INFO: Record<ClaimErrorCode, Omit<ClaimErrorInfo, 'code'>> = {
  UNAUTHENTICATED: {
    httpStatus: 401, retryable: true,
    message: 'Bitte melden Sie sich an, um den Bericht zu übernehmen.',
  },
  EMAIL_UNVERIFIED: {
    httpStatus: 403, retryable: true,
    message: 'Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse. Danach wird der Bericht übernommen.',
  },
  TENANT_NOT_FOUND: {
    httpStatus: 403, retryable: true,
    message: 'Für Ihren Zugang gibt es noch keinen Arbeitsbereich.',
  },
  TENANT_SELECTION_REQUIRED: {
    httpStatus: 409, retryable: true,
    message: 'Sie gehören zu mehreren Arbeitsbereichen. Bitte wählen Sie den Arbeitsbereich, in den der Bericht gehört.',
  },
  TENANT_FORBIDDEN: {
    httpStatus: 403, retryable: true,
    message: 'In diesem Arbeitsbereich dürfen nur Inhaber oder Admins Berichte übernehmen.',
  },
  TENANT_SELECTION_UNAVAILABLE: {
    httpStatus: 503, retryable: true,
    message: 'Die Auswahl des Arbeitsbereichs ist auf dem Server noch nicht verfügbar. Es wurde nichts übernommen.',
  },
  NOT_FOUND: {
    httpStatus: 404, retryable: false,
    message: 'Dieser Bericht existiert nicht mehr.',
  },
  OWNERSHIP_NOT_VERIFIED: {
    httpStatus: 403, retryable: false,
    message: 'Der Bericht wurde mit einer anderen E-Mail-Adresse angefordert. Bitte melden Sie sich mit dieser Adresse an oder führen Sie den Scan erneut aus.',
  },
  OWNERSHIP_INCONSISTENT: {
    httpStatus: 409, retryable: false,
    message: 'Die Zuordnung dieses Berichts ist widersprüchlich. Bitte wenden Sie sich an den Support.',
  },
  ALREADY_CLAIMED: {
    httpStatus: 409, retryable: false,
    message: 'Dieser Bericht gehört bereits zu einem anderen Arbeitsbereich.',
  },
  CONFLICT_RETRY: {
    httpStatus: 409, retryable: true,
    message: 'Der Bericht wurde gerade gleichzeitig übernommen. Bitte versuchen Sie es erneut.',
  },
  INTERNAL: {
    httpStatus: 500, retryable: true,
    message: 'Der Bericht konnte gerade nicht übernommen werden. Bitte versuchen Sie es später erneut.',
  },
};

export function claimErrorInfo(code: ClaimErrorCode): ClaimErrorInfo {
  return { code, ...INFO[code] };
}

/**
 * Ordnet eine Ausnahme der RPC (oder von PostgREST) einem Code zu.
 *
 * Grundlage sind die `RAISE EXCEPTION`-Texte beider RPC-Fassungen — der
 * ursprünglichen und der gehärteten aus #1867 —, damit die Zuordnung
 * unabhängig davon stimmt, welche gerade in der Datenbank liegt. Was nicht
 * erkannt wird, ist `INTERNAL`: ein Wiederholungsfall, keine Freigabe.
 */
export function classifyClaimError(error: { message?: unknown; code?: unknown } | null | undefined): ClaimErrorCode {
  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
  const code = typeof error?.code === 'string' ? error.code : '';

  // PostgREST findet keine Überladung mit `p_tenant_id`: Die Datenbank
  // trägt noch die RPC ohne Mandantenauswahl.
  if (code === 'PGRST202' || message.includes('could not find the function')) {
    return 'TENANT_SELECTION_UNAVAILABLE';
  }
  if (message.includes('unauthenticated')) return 'UNAUTHENTICATED';
  if (message.includes('verified account email required') || message.includes('email unverified')) {
    return 'EMAIL_UNVERIFIED';
  }
  if (message.includes('explicit tenant selection required')) return 'TENANT_SELECTION_REQUIRED';
  if (message.includes('tenant claim not authorized')) return 'TENANT_FORBIDDEN';
  if (message.includes('no tenant')) return 'TENANT_NOT_FOUND';
  if (message.includes('audit not found')) return 'NOT_FOUND';
  if (message.includes('audit ownership not verified') || message.includes('email mismatch')) {
    return 'OWNERSHIP_NOT_VERIFIED';
  }
  if (message.includes('audit ownership inconsistent')) return 'OWNERSHIP_INCONSISTENT';
  if (message.includes('already claimed')) return 'ALREADY_CLAIMED';
  if (message.includes('claim raced')) return 'CONFLICT_RETRY';
  return 'INTERNAL';
}

/**
 * Parameter für die RPC. Ohne Mandant die einstellige Fassung — sie
 * existiert in beiden RPC-Ständen. Mit Mandant die zweistellige aus #1867;
 * fehlt sie, antwortet PostgREST mit PGRST202 und es wird **nichts**
 * übernommen (`TENANT_SELECTION_UNAVAILABLE`), statt auf einen geratenen
 * Mandanten auszuweichen.
 */
export function claimRpcArgs(auditId: string, tenantId: string | null): Record<string, string> {
  return tenantId ? { p_audit_id: auditId, p_tenant_id: tenantId } : { p_audit_id: auditId };
}

export interface ClaimRpcResult {
  ok: boolean;
  already_claimed: boolean;
  audit_id: string;
  tenant_id: string;
  domain: string | null;
}

/**
 * Liest die Antwort der RPC. Eine Antwort ohne `audit_id` oder `tenant_id`
 * ist kein Erfolg — sonst meldete die Oberfläche eine Übernahme, die nicht
 * belegt ist.
 */
export function parseClaimRpcResult(data: unknown): ClaimRpcResult | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  if (row.ok !== true || !isUuid(row.audit_id) || !isUuid(row.tenant_id)) return null;
  return {
    ok: true,
    already_claimed: row.already_claimed === true,
    audit_id: row.audit_id,
    tenant_id: row.tenant_id,
    domain: typeof row.domain === 'string' && row.domain ? row.domain : null,
  };
}
