// Einwilligungs-Gate für die Audit-Drip-Sequenz — reine Logik ohne
// Deno-Abhängigkeiten, damit Vitest sie direkt prüfen kann.
//
// Die Drip-Mails (Tag 3 / 14 / 30) enthalten Angebote (Pro-Tier, Audit-Pro).
// Seit 20261015120000 filtert `audit_email_drip_due` bereits in der Datenbank
// auf Einwilligung am Audit UND bestätigten Double-Opt-in am Lead. Dort ist der
// Ersatz der Funktion aber abgesichert: Fehlen im Live-Projekt Objekte, bleibt
// die alte, ungefilterte Funktion stehen. Der Cron prüft deshalb dieselbe Regel
// noch einmal, bevor er sendet (Verteidigung in der Tiefe).
//
// Gesperrte Zeilen werden nicht verändert — bestätigt jemand später den
// Double-Opt-in, laufen die fälligen Mails ab dann (wie in der Migration).

export interface AuditConsentRow {
  id: string;
  marketing_consent: boolean | null;
  marketing_consent_revoked_at: string | null;
  sales_lead_id: string | null;
}

export interface LeadDoiRow {
  id: string;
  followup_doi_confirmed_at: string | null;
  marketing_consent_revoked_at: string | null;
}

export function dripAllowed(audit: AuditConsentRow | undefined, lead: LeadDoiRow | undefined): boolean {
  return (
    !!audit &&
    audit.marketing_consent === true &&
    !audit.marketing_consent_revoked_at &&
    !!lead &&
    !!lead.followup_doi_confirmed_at &&
    !lead.marketing_consent_revoked_at
  );
}

/**
 * Teilt fällige Drip-Zeilen in versandfähig und gesperrt. Fehlt das Audit,
 * der Lead, die Einwilligung oder die Bestätigung, ist die Zeile gesperrt.
 */
export function partitionByConsent<T extends { audit_id: string | null }>(
  rows: readonly T[],
  audits: readonly AuditConsentRow[],
  leads: readonly LeadDoiRow[],
): { allowed: T[]; blocked: T[] } {
  const auditById = new Map(audits.map((a) => [a.id, a]));
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const allowed: T[] = [];
  const blocked: T[] = [];
  for (const row of rows) {
    const audit = row.audit_id ? auditById.get(row.audit_id) : undefined;
    const lead = audit?.sales_lead_id ? leadById.get(audit.sales_lead_id) : undefined;
    if (dripAllowed(audit, lead)) allowed.push(row);
    else blocked.push(row);
  }
  return { allowed, blocked };
}
