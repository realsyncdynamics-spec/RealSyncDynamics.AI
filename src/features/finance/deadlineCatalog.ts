// Tax-Deadline-Engine — pure catalog generator for German statutory
// tax filing deadlines. Given a tax year + filing profile, produces
// a deterministic list of reminders ready to be inserted into
// `tax_reminders` with a stable `catalog_key` per deadline.
//
// Positioning: this is preparation, not Steuerberatung. The catalog
// encodes the COMMON deadlines (§ 18 UStG monthly/quarterly advance,
// § 149 AO annual returns, § 41a EStG payroll). It does NOT apply
// § 108 AO weekend-shift logic — the literal calendar date is used,
// the UI surfaces a hint that the user / advisor should verify.
//
// Pure: no imports from Supabase, no Date.now() side-effects (caller
// passes a clock for deterministic tests).

import type {
  TaxReminderType, UstCadence, LegalForm,
} from './types';

export interface FilingProfile {
  ust_cadence:     UstCadence;
  has_tax_advisor: boolean;
  legal_form:      LegalForm;
}

export interface CatalogReminder {
  catalog_key:    string;
  reminder_type:  TaxReminderType;
  title:          string;
  /** ISO 8601 timestamp in UTC. Always 09:00 UTC for visual stability. */
  due_at:         string;
  metadata: {
    period?:           string;          // e.g. "2026-03" or "2026-Q1"
    statutory_ref?:    string;          // e.g. "§ 18 Abs. 1 UStG"
    extended_via_advisor?: boolean;     // true if Steuerberater-Verlängerung
  };
}

// ── Date helpers ──────────────────────────────────────────────────

function isoAt9utc(year: number, monthIndex0: number, day: number): string {
  // 09:00 UTC ≈ 10:00/11:00 Berlin time; UI shows the date only, so
  // the time-of-day is just to be visible in any cross-timezone tools.
  const d = new Date(Date.UTC(year, monthIndex0, day, 9, 0, 0));
  return d.toISOString();
}

// ── Catalog ───────────────────────────────────────────────────────

/**
 * Statutory annual deadlines (Einkommensteuer / KöSt / GewSt / USt-Jahres /
 * Jahresabschluss). The actual filing year is the year AFTER the tax year:
 *   - Without advisor: 31.07. of year + 1
 *   - With advisor:    end of February of year + 2  (28 or 29 depending on leap)
 */
function annualDeadlineDate(taxYear: number, hasAdvisor: boolean): string {
  if (!hasAdvisor) return isoAt9utc(taxYear + 1, 6 /* Jul */, 31);
  const targetYear = taxYear + 2;
  const isLeap = (targetYear % 4 === 0 && targetYear % 100 !== 0) || (targetYear % 400 === 0);
  return isoAt9utc(targetYear, 1 /* Feb */, isLeap ? 29 : 28);
}

function annualReturns(taxYear: number, profile: FilingProfile): CatalogReminder[] {
  const due = annualDeadlineDate(taxYear, profile.has_tax_advisor);
  const out: CatalogReminder[] = [];
  const ext = profile.has_tax_advisor;

  // USt-Jahreserklärung — gilt für jeden, der USt-pflichtig ist.
  if (profile.ust_cadence !== 'none') {
    out.push({
      catalog_key:   `ust_annual_${taxYear}`,
      reminder_type: 'ust_annual',
      title:         `USt-Jahreserklärung ${taxYear}`,
      due_at:        due,
      metadata:      { period: `${taxYear}`, statutory_ref: '§ 18 Abs. 3 UStG', extended_via_advisor: ext },
    });
  }

  // Per Rechtsform: Einkommensteuer (natürliche Person) ODER
  // Körperschaftsteuer (Kapitalgesellschaft).
  if (profile.legal_form === 'einzelunternehmer' || profile.legal_form === 'gbr') {
    out.push({
      catalog_key:   `income_tax_${taxYear}`,
      reminder_type: 'income_tax_annual',
      title:         `Einkommensteuererklärung ${taxYear}`,
      due_at:        due,
      metadata:      { period: `${taxYear}`, statutory_ref: '§ 149 AO i. V. m. § 25 EStG', extended_via_advisor: ext },
    });
  } else if (profile.legal_form === 'ug' || profile.legal_form === 'gmbh' || profile.legal_form === 'ag') {
    out.push({
      catalog_key:   `corporate_tax_${taxYear}`,
      reminder_type: 'corporate_tax_annual',
      title:         `Körperschaftsteuererklärung ${taxYear}`,
      due_at:        due,
      metadata:      { period: `${taxYear}`, statutory_ref: '§ 31 KStG', extended_via_advisor: ext },
    });
  }

  // Gewerbesteuer — fast immer relevant außer Einzelunternehmer mit Freibetrag-Sicherung.
  // Heuristik: alle Rechtsformen außer einzelunternehmer triggern automatisch;
  // Einzelunternehmer können den Reminder löschen, wenn sie unter € 24.500 bleiben.
  if (profile.legal_form !== 'einzelunternehmer') {
    out.push({
      catalog_key:   `trade_tax_${taxYear}`,
      reminder_type: 'trade_tax_annual',
      title:         `Gewerbesteuererklärung ${taxYear}`,
      due_at:        due,
      metadata:      { period: `${taxYear}`, statutory_ref: '§ 14a GewStG', extended_via_advisor: ext },
    });
  }

  // Jahresabschluss — Frist abhängig von Rechtsform.
  // Kapitalgesellschaften: 6 Monate (§ 264 HGB), Einzelunternehmer / GbR
  // keine gesetzliche Frist (nur intern / für Steuer). Wir emittieren
  // einen freundlichen 30.06.-Reminder für Kapitalgesellschaften.
  if (profile.legal_form === 'ug' || profile.legal_form === 'gmbh' || profile.legal_form === 'ag') {
    out.push({
      catalog_key:   `annual_financials_${taxYear}`,
      reminder_type: 'annual_financials',
      title:         `Jahresabschluss ${taxYear} — Aufstellung`,
      due_at:        isoAt9utc(taxYear + 1, 5 /* Jun */, 30),
      metadata:      { period: `${taxYear}`, statutory_ref: '§ 264 Abs. 1 HGB' },
    });
  }

  return out;
}

function ustAdvanceFilings(taxYear: number, profile: FilingProfile): CatalogReminder[] {
  if (profile.ust_cadence === 'none') return [];

  const out: CatalogReminder[] = [];

  if (profile.ust_cadence === 'monthly') {
    // Monatliche Voranmeldung: 10. des Folgemonats.
    for (let m = 0; m < 12; m++) {
      const period = `${taxYear}-${String(m + 1).padStart(2, '0')}`;
      const dueY = m === 11 ? taxYear + 1 : taxYear;
      const dueM = m === 11 ? 0           : m + 1;
      out.push({
        catalog_key:   `ust_advance_${period}`,
        reminder_type: 'ust_advance',
        title:         `USt-Voranmeldung ${period}`,
        due_at:        isoAt9utc(dueY, dueM, 10),
        metadata:      { period, statutory_ref: '§ 18 Abs. 1 UStG' },
      });
    }
    return out;
  }

  // Quarterly — 10. des Folgemonats nach Quartalsende.
  const quarterEnds: Array<{ q: string; dueY: number; dueM: number }> = [
    { q: 'Q1', dueY: taxYear,     dueM: 3  /* Apr */ },
    { q: 'Q2', dueY: taxYear,     dueM: 6  /* Jul */ },
    { q: 'Q3', dueY: taxYear,     dueM: 9  /* Oct */ },
    { q: 'Q4', dueY: taxYear + 1, dueM: 0  /* Jan */ },
  ];
  for (const { q, dueY, dueM } of quarterEnds) {
    const period = `${taxYear}-${q}`;
    out.push({
      catalog_key:   `ust_advance_${period}`,
      reminder_type: 'ust_advance',
      title:         `USt-Voranmeldung ${period}`,
      due_at:        isoAt9utc(dueY, dueM, 10),
      metadata:      { period, statutory_ref: '§ 18 Abs. 2 UStG' },
    });
  }
  return out;
}

function payrollFilings(taxYear: number, profile: FilingProfile): CatalogReminder[] {
  // Allow-list, not deny-list: only Kapitalgesellschaften (UG, GmbH, AG)
  // get the 12 Lohnsteueranmeldungen by default. Einzel/GbR/other are
  // skipped because they often have no employees. Users who DO run
  // payroll under a non-Kapitalgesellschaft form can still create the
  // reminders manually via the "Neue Erinnerung"-Modal.
  const PAYROLL_FORMS: ReadonlyArray<FilingProfile['legal_form']> = ['ug', 'gmbh', 'ag'];
  if (!PAYROLL_FORMS.includes(profile.legal_form)) return [];

  const out: CatalogReminder[] = [];
  for (let m = 0; m < 12; m++) {
    const period = `${taxYear}-${String(m + 1).padStart(2, '0')}`;
    const dueY = m === 11 ? taxYear + 1 : taxYear;
    const dueM = m === 11 ? 0           : m + 1;
    out.push({
      catalog_key:   `payroll_filing_${period}`,
      reminder_type: 'payroll_filing',
      title:         `Lohnsteueranmeldung ${period}`,
      due_at:        isoAt9utc(dueY, dueM, 10),
      metadata:      { period, statutory_ref: '§ 41a EStG' },
    });
  }
  return out;
}

export function buildAnnualDeadlines(
  taxYear: number, profile: FilingProfile,
): CatalogReminder[] {
  return [
    ...ustAdvanceFilings(taxYear, profile),
    ...payrollFilings(taxYear, profile),
    ...annualReturns(taxYear, profile),
  ].sort((a, b) => a.due_at.localeCompare(b.due_at));
}

// ── Urgency classification ────────────────────────────────────────

export type ReminderUrgency = 'overdue' | 'due_soon' | 'upcoming';

export function urgencyOf(
  due_at: string, now: number = Date.now(),
): ReminderUrgency {
  const dueDate = new Date(due_at);
  if (Number.isNaN(dueDate.getTime())) return 'upcoming';
  // Catalog entries store 09:00 UTC for visual stability, but tax
  // deadlines are all-day — a 10. April filing isn't actually
  // overdue at 09:00 UTC on the 10th. Compare against the END of the
  // due date's calendar day so the badge flips to "Überfällig" only
  // when the filing day has fully passed.
  const cutoff = Date.UTC(
    dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate(),
    23, 59, 59, 999,
  );
  const diff = cutoff - now;
  if (diff < 0) return 'overdue';
  if (diff < 7 * 24 * 60 * 60 * 1000) return 'due_soon';
  return 'upcoming';
}

export const URGENCY_LABEL: Record<ReminderUrgency, string> = {
  overdue:  'Überfällig',
  due_soon: 'In Kürze',
  upcoming: 'Bevorstehend',
};
