// Legal-Compliance Skill — pure Helper. KEINE Rechtsberatung.

export type Regulation = 'gdpr' | 'ccpa' | 'lgpd' | 'pipeda' | 'ai_act';

export interface ChecklistItem {
  id: string;
  title: string;
  note?: string;
}

export interface ComplianceChecklist {
  regulation: Regulation | 'generic';
  items: ChecklistItem[];
  disclaimer: string;
}

const DISCLAIMER =
  'Diese Checkliste ist eine technische Heuristik und stellt keine Rechtsberatung dar. ' +
  'Vor Verwendung von qualifizierten Fachleuten validieren lassen.';

function validateRegulation(reg: string): Regulation {
  const allowed: Regulation[] = ['gdpr', 'ccpa', 'lgpd', 'pipeda', 'ai_act'];
  if (!allowed.includes(reg as Regulation)) throw new Error(`unknown regulation: ${reg}`);
  return reg as Regulation;
}

export function buildDsarChecklist(regulation: string): ComplianceChecklist {
  const reg = validateRegulation(regulation);
  const baseItems: ChecklistItem[] = [
    { id: 'verify-identity', title: 'Identitaet des Antragstellers verifizieren (kein Bypass via E-Mail-Header).' },
    { id: 'log-request', title: 'Anfrage im DSAR-Tracker mit Eingangsdatum protokollieren.' },
    { id: 'scope', title: 'Datenkategorien und Speicherorte sammeln (Primaer-DB, Backups, BI, Drittparteien).' },
    { id: 'extract', title: 'Maschinenlesbaren Export erstellen, Drittpersonen schwaerzen.' },
    { id: 'review', title: 'Vor Versand juristische Pruefung — keine automatische Auslieferung.' },
    { id: 'deliver', title: 'Sichere Auslieferung an verifizierten Kanal, Zustellnachweis sichern.' },
  ];
  const slaItems: Record<Regulation, ChecklistItem> = {
    gdpr:    { id: 'sla', title: 'SLA: 30 Tage, ggf. +60 Tage bei begruendeter Verlaengerung.' },
    ccpa:    { id: 'sla', title: 'SLA: 45 Tage, einmalig +45 Tage moeglich.' },
    lgpd:    { id: 'sla', title: 'SLA: 15 Tage (vereinfachte Auskunft), 30 Tage gesamt.' },
    pipeda:  { id: 'sla', title: 'SLA: 30 Tage, +30 Tage Verlaengerung mit Notice.' },
    ai_act:  { id: 'sla', title: 'AI-Act: spezifische Transparenzpflichten ergaenzend pruefen.' },
  };
  return { regulation: reg, items: [slaItems[reg], ...baseItems], disclaimer: DISCLAIMER };
}

export function buildDpaReviewChecklist(): ComplianceChecklist {
  return {
    regulation: 'generic',
    items: [
      { id: 'parties', title: 'Controller / Processor / Sub-Processor klar benannt?' },
      { id: 'scope', title: 'Verarbeitungszweck, Kategorien Betroffener und Datenkategorien explizit?' },
      { id: 'subprocessors', title: 'Sub-Processor-Liste + Notifikations-Mechanismus enthalten?' },
      { id: 'transfers', title: 'Drittlandtransfers: SCC, TIA, Schrems-II-Massnahmen dokumentiert?' },
      { id: 'security', title: 'Technisch-organisatorische Massnahmen (TOMs) ausreichend konkret?' },
      { id: 'breach', title: 'Meldewege bei Verletzungen + SLA (idR <= 24h fuer Notification).' },
      { id: 'audit', title: 'Audit- und Pruefrechte des Controllers vereinbart?' },
      { id: 'deletion', title: 'Rueckgabe/Loeschung am Vertragsende geregelt?' },
      { id: 'review', title: 'Juristische Pruefung vor Unterschrift — keine automatische Annahme.' },
    ],
    disclaimer: DISCLAIMER,
  };
}
