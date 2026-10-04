/**
 * Steuermodus-Guard: Website und Rechtstexte folgen der Laufzeit.
 *
 * Regelbesteuerung; Stripe Tax DE + OSS registriert seit 25.07.2026, alle
 * Live-Preise `tax_behavior=inclusive`. Solange
 * `COMPANY.taxMode === 'EU_STANDARD'` gilt, darf keine Kundenfläche mehr
 * „§ 19 UStG" oder „Kleinunternehmer" behaupten.
 *
 * Ausnahme: `TaxRemindersView` — dort wählt der *Kunde* sein eigenes
 * Steuerprofil (Option „Kleinunternehmer § 19"), das ist keine Aussage über
 * den Anbieter. `src/i18n/handoff.ts` enthält die Prototyp-Copy unverändert;
 * der dortige `pricingFoot` wird per Override ersetzt und hier über
 * `translate()` geprüft.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { COMPANY } from '../../src/config/company';
import { Impressum } from '../../src/features/legal/Impressum';
import { LegalTerms } from '../../src/features/legal/LegalTerms';
import { HANDOFF_COPY, LANGS, translate } from '../../src/i18n/handoff';
import { PRICING_TAX_MODE, PRICING_TAX_NOTE, PRICING_TAX_NOTE_STANDARD } from '../../shared/pricing';

const SMALL_BUSINESS = /§\s*(?:&nbsp;| )?\s*19\s*UStG|Kleinunternehmer/;

const ROOT = resolve(__dirname, '../..');
const SRC = join(ROOT, 'src');

/** Kunde wählt sein eigenes Profil — keine Aussage über den Anbieter. */
const CUSTOMER_OPTION_ALLOWLIST = new Set(['src/features/finance/TaxRemindersView.tsx']);
/** Prototyp-Copy, unverändert übernommen; Ausgabe wird per `translate()` geprüft. */
const PROTOTYPE_COPY = new Set(['src/i18n/handoff.ts']);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(tsx?|json)$/.test(name) && !/\.(test|spec)\./.test(name)) out.push(full);
  }
  return out;
}

/** Kommentarzeilen sind keine Kundenfläche. */
function isCommentLine(line: string): boolean {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('{/*');
}

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe.skipIf(COMPANY.taxMode !== 'EU_STANDARD')('Regelbesteuerung (taxMode EU_STANDARD)', () => {
  it('COMPANY.taxMode and the edge-function SSoT agree', () => {
    expect(PRICING_TAX_MODE).toBe('EU_STANDARD');
    expect(PRICING_TAX_NOTE).toBe(PRICING_TAX_NOTE_STANDARD);
    expect(PRICING_TAX_NOTE).toMatch(/inkl\. gesetzlicher Umsatzsteuer/);
  });

  it('no customer-facing source under src/ claims § 19 UStG or Kleinunternehmer', () => {
    const hits: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      if (CUSTOMER_OPTION_ALLOWLIST.has(rel) || PROTOTYPE_COPY.has(rel)) continue;
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (!isCommentLine(line) && SMALL_BUSINESS.test(line)) hits.push(`${rel}:${i + 1}`);
        });
    }
    expect(hits).toEqual([]);
  });

  it('every handoff string (de/en) is free of § 19 UStG after overrides', () => {
    for (const lang of LANGS) {
      for (const key of Object.keys(HANDOFF_COPY.de) as (keyof typeof HANDOFF_COPY.de)[]) {
        expect(translate(lang, key), `${lang}.${key}`).not.toMatch(SMALL_BUSINESS);
      }
    }
  });

  it('AGB § 4 (2) states gross prices including statutory VAT', () => {
    const view = render(<MemoryRouter><LegalTerms /></MemoryRouter>);
    const text = (view.container.textContent ?? '').replace(/\s+/g, ' ');
    expect(text).toContain('Alle Preise sind Bruttopreise und enthalten die gesetzliche Umsatzsteuer.');
    expect(text).not.toMatch(SMALL_BUSINESS);
  });

  it('Impressum without VITE_BUSINESS_VAT_ID announces the VAT ID instead of § 19', () => {
    vi.stubEnv('VITE_BUSINESS_VAT_ID', '');
    const view = render(<MemoryRouter><Impressum /></MemoryRouter>);
    const text = view.container.textContent ?? '';
    expect(text).toContain('Die Umsatzsteuer-Identifikationsnummer wird nach Erteilung ergänzt.');
    expect(text).not.toMatch(SMALL_BUSINESS);
  });

  it('Impressum with VITE_BUSINESS_VAT_ID renders the ID per § 27 a UStG', () => {
    vi.stubEnv('VITE_BUSINESS_VAT_ID', 'DE123456789');
    const view = render(<MemoryRouter><Impressum /></MemoryRouter>);
    const text = view.container.textContent ?? '';
    expect(text).toContain('DE123456789');
    expect(text).not.toContain('wird nach Erteilung ergänzt');
    expect(text).not.toMatch(SMALL_BUSINESS);
  });
});
