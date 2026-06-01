// DSGVO-Compliance-Gate für B2B-Outreach.
//
// Reiner Logik-Layer (keine DB-/Netzwerk-Imports), den der Outreach-Pfad
// (Sales Conversion Agent / n8n) VOR jedem Kontaktversuch aufruft. Setzt die
// Invarianten der Tabelle public.outreach_contacts
// (20260505240000_outreach_contacts.sql) in Code durch und produziert ein
// strukturiertes Evidence-Objekt für den Prüfpfad.
//
// Rechtlicher Rahmen (B2B-Kaltakquise DACH):
//   - Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse) als Default-Basis,
//     Begründung MUSS dokumentiert sein.
//   - § 7 UWG: E-Mail-Werbung an Unternehmen nur mit mutmaßlicher Einwilligung
//     bzw. sachlichem Bezug — daher Pflicht zu Quelle + Geschäftskontext.
//   - Keine privaten Adressen (Freemail), keine besonderen Kategorien
//     personenbezogener Daten (Art. 9), Opt-Out hart durchgesetzt.
//
// Pure-Helper-Design, damit vitest es ohne Deno-Runtime importieren kann.

export type OutreachLegalBasis = 'legitimate_interest' | 'consent' | 'contract';
export type OutreachSourceType =
  | 'web_research' | 'imprint' | 'linkedin' | 'referral' | 'inbound' | 'event';

export interface OutreachCandidate {
  company_name?: string;
  domain?: string;
  contact_email?: string | null;
  contact_role?: string | null;
  source_url?: string | null;
  source_type?: OutreachSourceType;
  legal_basis?: OutreachLegalBasis;
  legitimate_interest_note?: string | null;
  consent_ref?: string | null;
  opt_out?: boolean;
}

export type GateBlockCode =
  | 'OPT_OUT'
  | 'MISSING_SOURCE'
  | 'PERSONAL_EMAIL'
  | 'MISSING_LEGITIMATE_INTEREST_NOTE'
  | 'MISSING_CONSENT_REF'
  | 'MISSING_BUSINESS_CONTEXT'
  | 'SENSITIVE_DATA';

export interface GateViolation {
  code: GateBlockCode;
  message: string;
}

export interface GateEvidence {
  decision: 'allow' | 'block';
  checked_at: string;
  legal_basis: OutreachLegalBasis;
  source_type: OutreachSourceType | null;
  source_url: string | null;
  domain: string | null;
  email_is_role_based: boolean;
  violations: GateViolation[];
  // Bestätigte Checks für den Prüfpfad ("welche Bedingungen waren erfüllt").
  passed_checks: string[];
}

export interface GateResult {
  allowed: boolean;
  violations: GateViolation[];
  evidence: GateEvidence;
}

// Bekannte Freemail-/Consumer-Domains → kein zulässiger B2B-Geschäftskontakt.
const FREEMAIL_DOMAINS = new Set<string>([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com',
  'yahoo.com', 'yahoo.de', 'gmx.de', 'gmx.net', 'web.de', 't-online.de',
  'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com',
  'mail.com', 'freenet.de', 'posteo.de',
]);

// Role-based Postfächer sind die bevorzugten B2B-Adressaten (keine
// natürliche Person als primärer Bezug) → stärken berechtigtes Interesse.
const ROLE_BASED_LOCALPARTS = new Set<string>([
  'info', 'kontakt', 'contact', 'office', 'hello', 'mail', 'sales',
  'vertrieb', 'datenschutz', 'privacy', 'presse', 'press', 'support',
  'service', 'marketing', 'team', 'anfrage', 'welcome',
]);

// Signalbegriffe für besondere Datenkategorien (Art. 9) — solche Kontakte
// dürfen NICHT für Kaltakquise verwendet werden.
const SENSITIVE_HINTS = [
  'gesundheit', 'health', 'patient', 'arzt', 'klinik', 'diagnose',
  'religion', 'kirche', 'gewerkschaft', 'union', 'partei', 'political',
  'sexual', 'ethnic', 'herkunft',
];

function emailParts(email: string): { local: string; domain: string } | null {
  const at = email.lastIndexOf('@');
  if (at <= 0 || at === email.length - 1) return null;
  return {
    local: email.slice(0, at).toLowerCase().trim(),
    domain: email.slice(at + 1).toLowerCase().trim(),
  };
}

export function isFreemailDomain(domain: string): boolean {
  return FREEMAIL_DOMAINS.has(domain.toLowerCase().trim());
}

export function isRoleBasedLocalPart(local: string): boolean {
  // "info", aber auch "info+leads" / "info.berlin" → Präfix vor Trenner prüfen.
  const base = local.split(/[+._-]/)[0];
  return ROLE_BASED_LOCALPARTS.has(base);
}

/**
 * Bewertet einen Outreach-Kandidaten gegen das DSGVO/UWG-Gate.
 * Liefert allow/block, die konkreten Verstöße und ein Evidence-Objekt,
 * das der Aufrufer in den Prüfpfad schreibt (z. B. runtime_events /
 * outreach_contacts.notes).
 */
export function evaluateOutreachGate(candidate: OutreachCandidate): GateResult {
  const violations: GateViolation[] = [];
  const passed: string[] = [];

  const legalBasis = candidate.legal_basis ?? 'legitimate_interest';
  const sourceType = candidate.source_type ?? null;
  const sourceUrl = candidate.source_url?.trim() || null;

  // 1. Opt-Out wird hart durchgesetzt — keine Ausnahme.
  if (candidate.opt_out === true) {
    violations.push({ code: 'OPT_OUT', message: 'Kontakt hat Opt-Out gesetzt; Outreach untersagt.' });
  } else {
    passed.push('opt_out_respected');
  }

  // 2. Dokumentierte, öffentliche Quelle ist Pflicht.
  if (!sourceUrl) {
    violations.push({ code: 'MISSING_SOURCE', message: 'source_url fehlt; Herkunft des Kontakts nicht dokumentiert.' });
  } else {
    passed.push('source_documented');
  }

  // 3. E-Mail-Prüfung: nur geschäftliche, möglichst rollenbasierte Adressen.
  let emailIsRoleBased = false;
  const email = candidate.contact_email?.trim();
  if (email) {
    const parts = emailParts(email);
    if (!parts) {
      violations.push({ code: 'PERSONAL_EMAIL', message: `Ungültige E-Mail-Adresse: ${email}` });
    } else if (isFreemailDomain(parts.domain)) {
      violations.push({
        code: 'PERSONAL_EMAIL',
        message: `Freemail-/Privatadresse (${parts.domain}) ist kein zulässiger B2B-Geschäftskontakt.`,
      });
    } else {
      passed.push('business_email_domain');
      emailIsRoleBased = isRoleBasedLocalPart(parts.local);
      if (emailIsRoleBased) passed.push('role_based_mailbox');
    }
  }

  // 4. Rechtsgrundlage muss vollständig belegt sein.
  if (legalBasis === 'legitimate_interest') {
    if (!candidate.legitimate_interest_note?.trim()) {
      violations.push({
        code: 'MISSING_LEGITIMATE_INTEREST_NOTE',
        message: 'Begründung des berechtigten Interesses (Art. 6 Abs. 1 lit. f) fehlt.',
      });
    } else {
      passed.push('legitimate_interest_documented');
    }
  } else if (legalBasis === 'consent') {
    if (!candidate.consent_ref?.trim()) {
      violations.push({
        code: 'MISSING_CONSENT_REF',
        message: 'legal_basis=consent, aber consent_ref (Nachweis) fehlt.',
      });
    } else {
      passed.push('consent_referenced');
    }
  }

  // 5. Geschäftlicher Bezug: Domain ODER geschäftliche E-Mail muss vorliegen.
  const hasBusinessContext = Boolean(candidate.domain?.trim()) || passed.includes('business_email_domain');
  if (!hasBusinessContext) {
    violations.push({
      code: 'MISSING_BUSINESS_CONTEXT',
      message: 'Weder Firmen-Domain noch geschäftliche E-Mail vorhanden; B2B-Bezug nicht belegt.',
    });
  } else {
    passed.push('business_context_present');
  }

  // 6. Keine besonderen Datenkategorien (Art. 9) als Zielsignal.
  const haystack = [
    candidate.company_name, candidate.contact_role, candidate.legitimate_interest_note,
  ].filter(Boolean).join(' ').toLowerCase();
  const sensitiveHit = SENSITIVE_HINTS.find((h) => haystack.includes(h));
  if (sensitiveHit) {
    violations.push({
      code: 'SENSITIVE_DATA',
      message: `Hinweis auf besondere Datenkategorie ("${sensitiveHit}", Art. 9 DSGVO); manuelle Prüfung nötig.`,
    });
  }

  const allowed = violations.length === 0;
  const evidence: GateEvidence = {
    decision: allowed ? 'allow' : 'block',
    checked_at: new Date().toISOString(),
    legal_basis: legalBasis,
    source_type: sourceType,
    source_url: sourceUrl,
    domain: candidate.domain?.trim() || null,
    email_is_role_based: emailIsRoleBased,
    violations,
    passed_checks: passed,
  };

  return { allowed, violations, evidence };
}

// Standard-Opt-Out-Fußzeile für jede Outreach-Nachricht (DE).
export const OPT_OUT_FOOTER_DE =
  'Sie erhalten diese einmalige geschäftliche Information auf Basis unseres ' +
  'berechtigten Interesses (Art. 6 Abs. 1 lit. f DSGVO). Wenn Sie keine ' +
  'weiteren Nachrichten wünschen, antworten Sie mit „STOPP" — wir löschen ' +
  'Ihre Daten dann umgehend und kontaktieren Sie nicht erneut.';

/** Hilfsprädikat: Enthält ein Nachrichtentext eine Opt-Out-Möglichkeit? */
export function hasOptOutNotice(messageBody: string): boolean {
  const t = messageBody.toLowerCase();
  return /(stopp|abmelden|opt[- ]?out|unsubscribe|keine weiteren|widerspr)/.test(t);
}
