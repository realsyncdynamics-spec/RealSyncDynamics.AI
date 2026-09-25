import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { COMPANY } from '@/src/config/company';
import { translate } from '@/src/i18n/handoff';

/**
 * Kleinunternehmerregelung (§ 19 UStG): Wir berechnen keine Umsatzsteuer.
 * Kundensichtbare Texte dürfen deshalb weder „zzgl. USt.“ noch „inkl. MwSt.“
 * noch „netto“ als Preiszusatz behaupten. Der Wächter prüft die Quellen der
 * öffentlichen Seiten, der Preis-/Rechtstexte und die Pitch-Deck-Vorlage.
 *
 * Bewusst NICHT geprüft: das Finanzmodul (`src/features/finance`, dort geht
 * es um die Belege der Kunden), Stripe-Parameter, interne Kommentare in
 * Backend-Code und die Compliance-Inhalte zu fremden Pflichtangaben.
 */

const ROOT = join(__dirname, '..', '..');

const CUSTOMER_FACING_ROOTS = [
  'src/pages',
  'src/features/billing',
  'src/features/legal',
  'src/components',
  'src/marketing',
  'src/content',
  'public',
];

const CUSTOMER_FACING_FILES = [
  'index.html',
  'src/config/seo.ts',
  'src/enterprise-os/pages/LegalPage.tsx',
  'supabase/functions/pitch-deck-pdf/index.ts',
];

const TEXT_EXT = /\.(tsx?|jsx?|mjs|html|json|txt|md|xml)$/;

function walk(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (TEXT_EXT.test(name) && st.size < 2_000_000) out.push(p);
  }
}

function customerFacingFiles(): string[] {
  const files: string[] = [];
  for (const r of CUSTOMER_FACING_ROOTS) walk(join(ROOT, r), files);
  for (const f of CUSTOMER_FACING_FILES) files.push(join(ROOT, f));
  return files;
}

const TAX_WORD = '(?:USt\\.?|MwSt\\.?|Umsatzsteuer|Mehrwertsteuer)';
const FORBIDDEN: Array<{ label: string; re: RegExp }> = [
  { label: 'zzgl. USt/MwSt', re: new RegExp(`zzgl\\.?\\s*(?:der\\s+)?(?:gesetzl\\w*\\s+)?${TAX_WORD}`, 'i') },
  { label: 'inkl. USt/MwSt', re: new RegExp(`inkl\\.?\\s*(?:der\\s+)?(?:gesetzl\\w*\\s+)?${TAX_WORD}`, 'i') },
  { label: 'plus/incl./excl. VAT/tax', re: /\b(?:plus|incl\.?|excl\.?|including|excluding)\s+(?:VAT|tax)\b/i },
  { label: 'netto/brutto als Preiszusatz', re: /\b(?:netto|brutto)\b/i },
  { label: 'Prices net/gross', re: /\bprices?\s+(?:are\s+)?(?:net|gross)\b/i },
];

describe('§ 19 UStG — kundensichtbare Steuerhinweise', () => {
  it('COMPANY-SSOT steht auf Kleinunternehmer ohne USt-IdNr.', () => {
    expect(COMPANY.taxMode).toBe('EXEMPT');
    expect(COMPANY.vatId ?? '').toBe('');
  });

  it('keine kundensichtbare Quelle behauptet ausgewiesene Umsatzsteuer oder Nettopreise', () => {
    const hits: string[] = [];
    for (const file of customerFacingFiles()) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        for (const { label, re } of FORBIDDEN) {
          if (re.test(line)) hits.push(`${relative(ROOT, file)}:${i + 1} [${label}] ${line.trim().slice(0, 120)}`);
        }
      });
    }
    expect(hits).toEqual([]);
  });

  it('JSON-LD-Angebote setzen kein valueAddedTaxIncluded', () => {
    // Bei § 19 UStG fällt keine Umsatzsteuer an. true („inkl. USt.“) und
    // false („zzgl. USt.“) wären beide eine falsche Aussage, deshalb bleibt
    // die Eigenschaft weg. Der Preis ist der Endpreis.
    for (const f of ['index.html', 'src/config/seo.ts']) {
      expect(readFileSync(join(ROOT, f), 'utf8')).not.toMatch(/valueAddedTaxIncluded/);
    }
  });

  it('Enterprise-Konfigurator nennt den § 19-Hinweis, Audit Pro das Endpreis-Label', () => {
    expect(readFileSync(join(ROOT, 'src/pages/EnterpriseKonfigurator.tsx'), 'utf8'))
      .toContain('Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.');
    expect(readFileSync(join(ROOT, 'src/pages/AuditPro.tsx'), 'utf8')).toMatch(/499 € <span[^>]*>Endpreis<\/span>/);
    expect(readFileSync(join(ROOT, 'supabase/functions/pitch-deck-pdf/index.ts'), 'utf8'))
      .toContain('Gemäß § 19 UStG wird keine Umsatzsteuer berechnet');
  });

  it('Preisseite: wirksame Texte nennen § 19 UStG und keine Nettopreise (DE/EN)', () => {
    for (const lang of ['de', 'en'] as const) {
      expect(translate(lang, 'pricingSub')).not.toMatch(/netto|\bnet\b/i);
      expect(translate(lang, 'pricingFoot')).toContain('§ 19 UStG');
    }
  });
});
