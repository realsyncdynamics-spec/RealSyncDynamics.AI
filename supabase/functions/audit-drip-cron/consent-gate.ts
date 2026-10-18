// Einwilligungs-Gate für die Audit-Drip-Sequenz — reine Logik ohne
// Deno-Abhängigkeiten, damit Vitest sie direkt prüfen kann.
//
// Die Drip-Mails (Tag 3 / 14 / 30) enthalten Angebote (Pro-Tier, Audit-Pro).
// Der Trigger `audit_email_drip_create_for_audit` legt aber für JEDES Audit
// mit E-Mail eine Drip-Zeile an, unabhängig von der Checkbox im Audit-Formular.
// Deshalb entscheidet der Cron vor dem Versand: gesendet wird nur, wenn das
// zugehörige gdpr_audit eine ausdrückliche, nicht widerrufene Einwilligung trägt.

export const NO_CONSENT_REASON = 'no_marketing_consent';

export interface AuditConsentRow {
  id: string;
  marketing_consent: boolean | null;
  marketing_consent_revoked_at: string | null;
}

export function dripAllowed(row: AuditConsentRow | undefined): boolean {
  return !!row && row.marketing_consent === true && !row.marketing_consent_revoked_at;
}

/**
 * Teilt fällige Drip-Zeilen in versandfähig und gesperrt. Fehlt das Audit
 * (gelöscht, audit_id null) oder die Einwilligung, ist die Zeile gesperrt.
 */
export function partitionByConsent<T extends { audit_id: string | null }>(
  rows: readonly T[],
  audits: readonly AuditConsentRow[],
): { allowed: T[]; blocked: T[] } {
  const byId = new Map(audits.map((a) => [a.id, a]));
  const allowed: T[] = [];
  const blocked: T[] = [];
  for (const row of rows) {
    if (row.audit_id && dripAllowed(byId.get(row.audit_id))) allowed.push(row);
    else blocked.push(row);
  }
  return { allowed, blocked };
}
