/**
 * Landing „Studio“ (/design/landing-studio): Glas/Neon-Vorschau.
 * Vertrag: keine eigene Datenhaltung — Produkte, Status, Preise, Steuerhinweis
 * und Ziele kommen aus landingV3Data.ts; Vorschau ist noIndex und nicht `/`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingStudio } from '../../src/pages/LandingStudio';
import { planCards, PRODUCTS, RECEPTIONIST, STATUS_TEXT } from '../../src/components/landing/v3/landingV3Data';
import { pricingTaxNote } from '../../shared/pricing';
import { COMPANY } from '../../src/config/company';
import { CI_FORBIDDEN_CTA } from '../../src/content/runtimeVocab';

const root = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));

describe('Landing „Studio“ — /design/landing-studio', () => {
  it('ist nur Vorschau: eigene Route, noIndex, `/` bleibt Startseite v3', () => {
    const app = read('src/App.tsx');
    expect(app).toContain('<Route path="/design/landing-studio" element={<LandingStudio />} />');
    expect(app).toContain('<Route path="/" element={<LandingV3 />} />');
    expect(read('src/config/seo.ts')).toMatch(/'\/design\/landing-studio': \{[\s\S]*?noIndex: true/);
  });

  it('verlinkt alle Produkte auf ihre echten Ziele (Builder, Bots, Optimizer, Governance OS)', () => {
    render(<MemoryRouter><LandingStudio /></MemoryRouter>);
    for (const p of PRODUCTS) expect(screen.getByTestId(`studio-product-${p.key}`)).toHaveAttribute('href', p.href);
    expect(screen.getByTestId('studio-login')).toHaveAttribute('href', '/welcome');
  });

  it('AI Receptionist mit Registry-Status, Warteliste und Chat-Assistent', () => {
    render(<MemoryRouter><LandingStudio /></MemoryRouter>);
    expect(screen.getByTestId('studio-receptionist')).toHaveTextContent(STATUS_TEXT[RECEPTIONIST.status]);
    expect(screen.getByTestId('studio-receptionist-waitlist')).toHaveAttribute('href', RECEPTIONIST.waitlistHref);
    expect(screen.getByTestId('studio-receptionist-try')).toHaveAttribute('href', RECEPTIONIST.tryHref);
  });

  it('Preise und Steuerhinweis aus der SSoT, keine fest eingetragenen Voice-Preise', () => {
    render(<MemoryRouter><LandingStudio /></MemoryRouter>);
    for (const card of planCards()) {
      const el = screen.getByTestId(`studio-plan-${card.id}`);
      expect(within(el).getByText(card.price.replace(/\s+/g, ' '))).toBeInTheDocument();
    }
    expect(screen.getByTestId('studio-tax-note')).toHaveTextContent(pricingTaxNote(COMPANY.taxMode));
    const src = read('src/pages/LandingStudio.tsx');
    expect(src).not.toMatch(/\b(89|199|349)\s?€/);
  });

  it('keine verbotenen CTAs, Check führt in den Audit-Funnel', () => {
    const src = read('src/pages/LandingStudio.tsx');
    for (const phrase of CI_FORBIDDEN_CTA) expect(src).not.toContain(phrase);
    expect(src).toContain('/audit?domain=');
  });
});
