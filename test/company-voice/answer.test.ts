import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CTA } from '../../src/content/runtimeVocab';
import { COMPANY } from '../../src/config/company';
import { answerCompanyQuestion } from '../../src/lib/company-voice/answer';
import { applyAllowlist } from '../../src/lib/company-voice/allowlist';
import { curatedFacts } from '../../src/lib/company-voice/facts';
import { formatPriceEur, monthlyPriceText, planByKey } from '../../shared/pricing';
import { WEBDESIGN_LINK_LABEL } from '../../src/lib/company-voice/types';

const starter = planByKey('starter');
const free = planByKey('free_audit');
const growth = planByKey('growth');

if (!starter || !free || !growth) throw new Error('pricing catalog missing');

const answer = (question: string) => answerCompanyQuestion(question, curatedFacts(), { publicBeta: false });

describe('Antwortlogik', () => {
  it('nennt Inhaber, Rechtsform, Gewerbe und Sitz aus dem Impressum', () => {
    const impressum = readFileSync(join(process.cwd(), 'src/features/legal/Impressum.tsx'), 'utf8');
    expect(impressum).toContain('Dominik Steiner');
    expect(impressum).toContain('13.05.2026');
    expect(impressum).toContain('Neuhaus am Rennweg');

    const founder = answer('Wer ist der Inhaber?');
    expect(founder.covered).toBe(true);
    expect(founder.text).toContain('Dominik Steiner');
    expect(founder.text).toContain('Einzelunternehmen');

    const trade = answer('Seit wann besteht das Gewerbe?');
    expect(trade.text).toContain('13.05.2026');

    const seat = answer('Wo sitzt das Unternehmen?');
    expect(seat.text).toContain('Neuhaus am Rennweg');
    expect(seat.text).toContain('Thüringen');
  });

  it('nennt Self-Service und den kostenlosen Audit nur mit Preisen aus der Preisliste', () => {
    const price = answer('Was kostet der Self-Service?');
    expect(price.covered).toBe(true);
    expect(price.text).toContain(monthlyPriceText(starter));
    expect(price.text).toContain(formatPriceEur(free.price.monthlyEur));
    expect(price.text).toContain('Free Audit');

    const growthPrice = answer('Was kostet Growth?');
    expect(growthPrice.text).toContain(monthlyPriceText(growth));
    expect(growthPrice.text).not.toContain(monthlyPriceText(starter));
  });

  it('bestätigt keinen erfundenen Preis', () => {
    const wrong = answer('Kostet der Starter 49 Euro?');
    expect(wrong.text).toContain(monthlyPriceText(starter));
    expect(wrong.text).toContain('nicht in der Preisliste');
    expect(wrong.text).not.toMatch(/\b49\b/);
    expect(wrong.text).not.toContain('49 €');
  });

  it('erfindet keinen Webdesign-Preis', () => {
    const design = answer('Was kostet das Webdesign?');
    expect(design.covered).toBe(true);
    expect(design.text).not.toMatch(/€/);
    expect(design.link?.label).toBe(CTA.webdesign);
    expect(design.link?.label).toBe(WEBDESIGN_LINK_LABEL);
  });

  it('sagt bei einer unbekannten Frage ehrlich ab und verweist auf Kontakt', () => {
    const missing = answer('Wie wird das Wetter in Tokio morgen?');
    expect(missing.covered).toBe(false);
    expect(missing.text).toContain('nichts vor');
    expect(missing.text).not.toContain('Tokio');
    expect(missing.link?.href).toBe('/kontakt');
  });

  it('nennt keine Telefonnummer und beschreibt das Produkt ohne Konformitätszusage', () => {
    const phone = answer('Wie ist die Telefonnummer?');
    expect(phone.covered).toBe(false);
    expect(phone.text).not.toContain(COMPANY.supportPhoneOptional);
    expect(phone.text).not.toMatch(/\+?\d[\d\s/-]{6,}/);
    expect(phone.link?.href).toBe('/kontakt');

    const product = answer('Was ist das Produkt?');
    expect(product.text).toContain('Governance OS');
    expect(product.text).toContain('Preview');
    expect(product.text).toContain('Coming Soon');
    expect(product.text.toLowerCase()).not.toContain('garantiert konform');

    const legal = answer('Seid ihr garantiert konform?');
    expect(legal.text.toLowerCase()).not.toContain('garantiert konform');
    expect(legal.text).toContain('Keine Rechtsberatung');
  });

  it('lässt Straße und Telefon aus den kuratierten Fakten', () => {
    const blob = curatedFacts().map((fact) => fact.text).join('\n');
    expect(blob).not.toContain('Schwarzburger');
    expect(blob).not.toContain(COMPANY.supportPhoneOptional ?? '176');
    expect(blob).toContain(COMPANY.headquartersAddress.city);
    expect(blob).toContain(COMPANY.legalForm);
  });
});

describe('Allowlist', () => {
  it('verwirft Preise, Telefon, Dokumente und unbekannte IDs, behält die Time-Manager-Notiz', () => {
    const result = applyAllowlist({
      module: 'time-manager',
      facts: [
        { id: 'pricing.selfService', text: 'Starter kostet 49 € im Monat.' },
        { id: 'company.founder', text: 'Inhaber privat +49 176 4013 2161' },
        { id: 'bucket.file', text: 'supabase/storage/v1/object/private/passport.pdf' },
        { id: 'timeManager.publicNote', text: 'Time Manager: freigegebene Notiz ohne Personendaten.' },
      ],
    });
    const blob = result.facts.map((fact) => fact.text).join('\n');
    expect(result.acceptedRemote).toBe(true);
    expect(blob).not.toMatch(/\b49\b/);
    expect(blob).not.toContain('4013');
    expect(blob).not.toContain('passport');
    expect(blob).toContain('freigegebene Notiz');
    expect(result.facts.find((fact) => fact.id === 'pricing.selfService')?.origin).toBe('curated');
  });

  it('übernimmt eine Notiz mit Telefonnummer nicht', () => {
    const result = applyAllowlist({
      facts: [{ id: 'timeManager.publicNote', text: 'Rückruf unter +49 176 4013 2161 am Montag.' }],
    });
    expect(result.acceptedRemote).toBe(false);
    expect(result.facts.some((fact) => fact.id === 'timeManager.publicNote')).toBe(false);
  });
});
