import { describe, it, expect } from 'vitest';
import {
  buildAnnualDeadlines,
  urgencyOf,
  type FilingProfile,
} from '../../../src/features/finance/deadlineCatalog';

const QUARTERLY_GMBH: FilingProfile = {
  ust_cadence: 'quarterly',
  has_tax_advisor: false,
  legal_form: 'gmbh',
};

const MONTHLY_EINZEL: FilingProfile = {
  ust_cadence: 'monthly',
  has_tax_advisor: false,
  legal_form: 'einzelunternehmer',
};

const KLEINUNTERNEHMER: FilingProfile = {
  ust_cadence: 'none',
  has_tax_advisor: false,
  legal_form: 'einzelunternehmer',
};

describe('buildAnnualDeadlines — USt-Voranmeldung', () => {
  it('emits 12 monthly entries due on the 10th of the next month', () => {
    const cats = buildAnnualDeadlines(2026, MONTHLY_EINZEL);
    const monthly = cats.filter((c) => c.reminder_type === 'ust_advance');
    expect(monthly).toHaveLength(12);

    const january = monthly.find((c) => c.catalog_key === 'ust_advance_2026-01');
    expect(january?.due_at.startsWith('2026-02-10')).toBe(true);

    const december = monthly.find((c) => c.catalog_key === 'ust_advance_2026-12');
    // December 2026 → due January 10th, 2027.
    expect(december?.due_at.startsWith('2027-01-10')).toBe(true);
  });

  it('emits 4 quarterly entries on the 10th after the quarter end', () => {
    const cats = buildAnnualDeadlines(2026, QUARTERLY_GMBH);
    const quarterly = cats.filter((c) => c.reminder_type === 'ust_advance');
    expect(quarterly).toHaveLength(4);

    const keys = quarterly.map((c) => c.catalog_key).sort();
    expect(keys).toEqual([
      'ust_advance_2026-Q1',
      'ust_advance_2026-Q2',
      'ust_advance_2026-Q3',
      'ust_advance_2026-Q4',
    ]);

    const q1 = quarterly.find((c) => c.catalog_key === 'ust_advance_2026-Q1');
    expect(q1?.due_at.startsWith('2026-04-10')).toBe(true);

    const q4 = quarterly.find((c) => c.catalog_key === 'ust_advance_2026-Q4');
    expect(q4?.due_at.startsWith('2027-01-10')).toBe(true);
  });

  it('emits NO advance filings for the Kleinunternehmer profile', () => {
    const cats = buildAnnualDeadlines(2026, KLEINUNTERNEHMER);
    expect(cats.filter((c) => c.reminder_type === 'ust_advance')).toHaveLength(0);
  });
});

describe('buildAnnualDeadlines — annual returns', () => {
  it('GmbH gets Körperschaftsteuer + Gewerbesteuer + USt-Jahres + Jahresabschluss', () => {
    const cats = buildAnnualDeadlines(2026, QUARTERLY_GMBH);
    const types = new Set(cats.map((c) => c.reminder_type));
    expect(types.has('corporate_tax_annual')).toBe(true);
    expect(types.has('trade_tax_annual')).toBe(true);
    expect(types.has('ust_annual')).toBe(true);
    expect(types.has('annual_financials')).toBe(true);
    expect(types.has('income_tax_annual')).toBe(false);
  });

  it('Einzelunternehmer gets Einkommensteuer + USt-Jahres, no Gewerbesteuer/Jahresabschluss', () => {
    const cats = buildAnnualDeadlines(2026, MONTHLY_EINZEL);
    const types = new Set(cats.map((c) => c.reminder_type));
    expect(types.has('income_tax_annual')).toBe(true);
    expect(types.has('ust_annual')).toBe(true);
    expect(types.has('trade_tax_annual')).toBe(false);
    expect(types.has('annual_financials')).toBe(false);
    expect(types.has('corporate_tax_annual')).toBe(false);
  });

  it('without advisor: annual returns due 31.07 of year + 1', () => {
    const cats = buildAnnualDeadlines(2026, MONTHLY_EINZEL);
    const inc = cats.find((c) => c.reminder_type === 'income_tax_annual');
    expect(inc?.due_at.startsWith('2027-07-31')).toBe(true);
    expect(inc?.metadata.extended_via_advisor).toBe(false);
  });

  it('with advisor: annual returns due end of Feb of year + 2 (28/29)', () => {
    const cats = buildAnnualDeadlines(2026, {
      ...MONTHLY_EINZEL, has_tax_advisor: true,
    });
    const inc = cats.find((c) => c.reminder_type === 'income_tax_annual');
    // 2028 is a leap year → Feb has 29 days.
    expect(inc?.due_at.startsWith('2028-02-29')).toBe(true);
    expect(inc?.metadata.extended_via_advisor).toBe(true);
  });

  it('handles non-leap target year (e.g. 2027 → 2029-02-28)', () => {
    const cats = buildAnnualDeadlines(2027, {
      ...QUARTERLY_GMBH, has_tax_advisor: true,
    });
    const ust = cats.find((c) => c.reminder_type === 'ust_annual');
    expect(ust?.due_at.startsWith('2029-02-28')).toBe(true);
  });

  it('Kleinunternehmer skips USt-Jahres but keeps income tax', () => {
    const cats = buildAnnualDeadlines(2026, KLEINUNTERNEHMER);
    const types = new Set(cats.map((c) => c.reminder_type));
    expect(types.has('ust_annual')).toBe(false);
    expect(types.has('income_tax_annual')).toBe(true);
  });
});

describe('buildAnnualDeadlines — payroll', () => {
  it('emits 12 monthly payroll filings for GmbH', () => {
    const cats = buildAnnualDeadlines(2026, QUARTERLY_GMBH);
    expect(cats.filter((c) => c.reminder_type === 'payroll_filing')).toHaveLength(12);
  });

  it('omits payroll filings for Einzelunternehmer / GbR', () => {
    expect(buildAnnualDeadlines(2026, MONTHLY_EINZEL)
      .filter((c) => c.reminder_type === 'payroll_filing')).toHaveLength(0);
    expect(buildAnnualDeadlines(2026, { ...MONTHLY_EINZEL, legal_form: 'gbr' })
      .filter((c) => c.reminder_type === 'payroll_filing')).toHaveLength(0);
  });

  // Regression: prior to PR #248 the deny-list version of the helper
  // emitted 12 payroll reminders for `legal_form='other'` (and for any
  // future-added form), because the guard only excluded einzel/gbr.
  // Allow-list-only behaviour pins this to Kapitalgesellschaften.
  it('omits payroll filings for legal_form=other (unknown form)', () => {
    expect(buildAnnualDeadlines(2026, { ...QUARTERLY_GMBH, legal_form: 'other' })
      .filter((c) => c.reminder_type === 'payroll_filing')).toHaveLength(0);
  });

  it('emits payroll filings for UG + AG (Kapitalgesellschaften)', () => {
    for (const form of ['ug', 'ag'] as const) {
      expect(buildAnnualDeadlines(2026, { ...QUARTERLY_GMBH, legal_form: form })
        .filter((c) => c.reminder_type === 'payroll_filing')).toHaveLength(12);
    }
  });
});

describe('buildAnnualDeadlines — Jahresabschluss', () => {
  it('GmbH/UG/AG get a 30.06.-Jahresabschluss reminder', () => {
    const cats = buildAnnualDeadlines(2026, QUARTERLY_GMBH);
    const fin = cats.find((c) => c.reminder_type === 'annual_financials');
    expect(fin?.due_at.startsWith('2027-06-30')).toBe(true);
    expect(fin?.metadata.statutory_ref).toMatch(/HGB/);
  });

  it('Einzelunternehmer does NOT get a Jahresabschluss reminder', () => {
    expect(buildAnnualDeadlines(2026, MONTHLY_EINZEL)
      .filter((c) => c.reminder_type === 'annual_financials')).toHaveLength(0);
  });
});

describe('buildAnnualDeadlines — sorting + idempotency', () => {
  it('returns entries sorted ascending by due_at', () => {
    const cats = buildAnnualDeadlines(2026, QUARTERLY_GMBH);
    for (let i = 1; i < cats.length; i++) {
      expect(cats[i]!.due_at >= cats[i - 1]!.due_at).toBe(true);
    }
  });

  it('produces stable catalog_keys (idempotent — re-call yields identical keys)', () => {
    const a = buildAnnualDeadlines(2026, QUARTERLY_GMBH).map((c) => c.catalog_key).sort();
    const b = buildAnnualDeadlines(2026, QUARTERLY_GMBH).map((c) => c.catalog_key).sort();
    expect(a).toEqual(b);
  });
});

describe('urgencyOf', () => {
  it('overdue when due_at is in the past', () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(urgencyOf(past)).toBe('overdue');
  });

  it('due_soon when due_at is within 7 days', () => {
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(urgencyOf(soon)).toBe('due_soon');
  });

  it('upcoming when due_at is more than 7 days out', () => {
    const upcoming = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(urgencyOf(upcoming)).toBe('upcoming');
  });

  it('accepts a deterministic `now` override', () => {
    const due = '2026-05-20T09:00:00Z';
    const now = new Date('2026-05-21T00:00:00Z').getTime(); // 1 day later
    expect(urgencyOf(due, now)).toBe('overdue');
  });

  it('falls back to upcoming on invalid input', () => {
    expect(urgencyOf('not-a-date')).toBe('upcoming');
  });

  // Regression: catalog entries stamp 09:00 UTC for visual stability;
  // checking diff against THAT timestamp would flip the badge to
  // "Überfällig" at noon Berlin on the actual filing day even though
  // the deadline runs until end-of-day. Cutoff now = end of due day.
  it('is NOT overdue at 10:00 UTC on the statutory due date', () => {
    const due  = '2026-04-10T09:00:00Z';                   // catalog stamp
    const now  = new Date('2026-04-10T10:00:00Z').getTime(); // 1h after stamp
    expect(urgencyOf(due, now)).toBe('due_soon');
  });

  it('flips to overdue once the calendar day has fully passed', () => {
    const due  = '2026-04-10T09:00:00Z';
    const now  = new Date('2026-04-11T00:00:00.001Z').getTime();
    expect(urgencyOf(due, now)).toBe('overdue');
  });
});
