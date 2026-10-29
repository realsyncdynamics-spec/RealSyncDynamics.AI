/**
 * Wer darf den Bericht zu einem `gdpr_audits`-Eintrag erzeugen und abrufen?
 *
 * ## Warum es diese Datei gibt
 *
 * `audit-report-pdf` läuft mit `verify_jwt = false` und liest mit der
 * Service-Role. Bis 2026-10-13 lief die Besitzprüfung nur, **wenn** ein Token
 * mitkam (`if (callerEmail && …)`). Ohne `Authorization`-Header genügte die
 * `audit_id` — sie steht im teilbaren Ergebnis-Link — für den vollständigen
 * Bericht samt E-Mail und Firma des Anforderers und eine 24-h-Signed-URL.
 *
 * ## Regel (fail-closed)
 *
 * 1. Plattform-intern (Service-Role-Key als Bearer, konstantzeitig geprüft).
 * 2. Sonst nur mit gültigem Nutzer-Token:
 *    - Super-Admin, oder
 *    - Mitglied des Mandanten, der das Audit übernommen hat, oder
 *    - **bestätigte** Konto-E-Mail = E-Mail des Audits.
 * 3. Alles andere wird abgelehnt — auch ein Audit ohne E-Mail, solange es
 *    keinem Mandanten gehört. Fehlende Angaben sind kein Treffer.
 *
 * Deno-frei, damit Vitest denselben Code prüft, der in Produktion läuft.
 */

export interface ReportCaller {
  userId: string;
  email: string | null;
  emailConfirmed: boolean;
  isSuperAdmin: boolean;
  tenantIds: readonly string[];
}

export interface ReportAuditOwnership {
  email: string | null;
  tenant_id: string | null;
}

export type ReportAccess =
  | { allowed: true; basis: 'internal' | 'super_admin' | 'tenant_member' | 'verified_email' }
  | { allowed: false; reason: 'unauthenticated' | 'forbidden' };

function normalizedEmail(value: string | null | undefined): string | null {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return v ? v : null;
}

export function decideReportAccess(
  internal: boolean,
  caller: ReportCaller | null,
  audit: ReportAuditOwnership,
): ReportAccess {
  if (internal) return { allowed: true, basis: 'internal' };
  if (!caller) return { allowed: false, reason: 'unauthenticated' };
  if (caller.isSuperAdmin) return { allowed: true, basis: 'super_admin' };
  if (audit.tenant_id && caller.tenantIds.includes(audit.tenant_id)) {
    return { allowed: true, basis: 'tenant_member' };
  }
  const auditEmail = normalizedEmail(audit.email);
  const callerEmail = normalizedEmail(caller.email);
  if (caller.emailConfirmed && auditEmail !== null && auditEmail === callerEmail) {
    return { allowed: true, basis: 'verified_email' };
  }
  return { allowed: false, reason: 'forbidden' };
}
