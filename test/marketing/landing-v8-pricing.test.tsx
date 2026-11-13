import { readFileSync } from 'node:fs';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LandingV8Pricing } from '../../src/components/landing/v8/LandingV8Pages';
import { SOLUTIONS } from '../../src/marketing/products/registry';
import {
  V8_PLAN_IDS,
  V8_PRICE_SUFFIX,
  V8_VOICE_PLACEHOLDER,
  v8PlanCards,
  v8PriceLine,
} from '../../src/marketing/products/pricing';
import { PLANS } from '../../shared/pricing';

const norm = (value: string) => value.replace(/\u00a0|\u202f/g, ' ');
const TAX_ASIDE = /mwst|umsatzsteuer|\bbrutto\b|zzgl|inkl\./i;

describe('Landing v8 Preise', () => {
  it('liest 79, 249, 699 und 1.498 und hängt nur „/ Monat, netto“ an', () => {
    const cards = v8PlanCards();
    expect(cards.map((card) => card.id)).toEqual([...V8_PLAN_IDS]);
    expect(cards.map((card) => card.monthlyEur)).toEqual([79, 249, 699, 1498]);
    expect(cards.map((card) => norm(v8PriceLine(card)))).toEqual([
      `79 € ${V8_PRICE_SUFFIX}`,
      `249 € ${V8_PRICE_SUFFIX}`,
      `699 € ${V8_PRICE_SUFFIX}`,
      `1.498 € ${V8_PRICE_SUFFIX}`,
    ]);
  });

  it('lässt Voice als Platzhalter ohne Betrag und ohne Abrechnungseinheit', () => {
    expect(PLANS.map((plan) => plan.id as string)).not.toContain('voice');
    expect(V8_VOICE_PLACEHOLDER.priceLabel).toBe('Preis auf Anfrage');
    expect(V8_VOICE_PLACEHOLDER.note).toBe('als Add-on oder Inklusivkontingent, je nach Tarif');
    expect(V8_VOICE_PLACEHOLDER.priceLabel).not.toMatch(/\d/);
    expect(V8_VOICE_PLACEHOLDER.note).not.toMatch(/minute|monat|€/i);
    expect(JSON.stringify(V8_VOICE_PLACEHOLDER)).not.toMatch(/89|199|349|150|0,25/);
  });

  it('zeigt die Preiszeile ohne weiteren Steuerhinweis', () => {
    const { container } = render(
      <MemoryRouter>
        <LandingV8Pricing />
      </MemoryRouter>,
    );
    const text = norm(container.textContent ?? '');
    expect(text).toContain('79 €');
    expect(text).toContain('249 €');
    expect(text).toContain('699 €');
    expect(text).toContain('1.498 €');
    expect(text).toContain('/ Monat, netto');
    expect(text).toContain('Preis auf Anfrage');
    expect(text).toContain('als Add-on oder Inklusivkontingent, je nach Tarif');
    expect(text).not.toMatch(TAX_ASIDE);
    expect(text).not.toMatch(/89\s*€|199\s*€|349\s*€|150\s*€|0,25/);

    const source = readFileSync('src/components/landing/v8/LandingV8Pages.tsx', 'utf8');
    expect(source).not.toMatch(/Demo anfragen/);
  });

  it('nennt nur Handwerk, Praxis und Kanzlei', () => {
    expect(SOLUTIONS.map((item) => item.name)).toEqual(['Handwerk', 'Praxis', 'Kanzlei']);
  });
});
