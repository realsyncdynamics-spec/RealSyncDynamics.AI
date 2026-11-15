/**
 * Startseite v3 (Vorschau, /design/startseite-v3): Inhalte aus den Quellen,
 * keine übernommenen Platzhalter aus dem Design-Export, `/` unverändert.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingV3Preview } from '../../src/pages/LandingV3Preview';
import { planCards, PRODUCTS, productStatus, STATUS_TEXT } from '../../src/components/landing/v3/landingV3Data';
import { IMPLEMENTATION_ITEMS } from '../../src/product/implementation-status';
import { pricingTaxNote } from '../../shared/pricing';
import { COMPANY } from '../../src/config/company';

const root = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));

describe('Startseite v3 — Vorschau', () => {
  it('ist isoliert: eigene Route, `/` bleibt Landing v6, noindex', () => {
    const app = read('src/App.tsx');
    expect(app).toMatch(/path="\/"\s+element=\{<LandingV6/);
    expect(app).toContain('path="/design/startseite-v3" element={<LandingV3Preview />}');
    expect(read('src/config/seo.ts')).toMatch(/'\/design\/startseite-v3': \{[\s\S]*?noIndex: true/);
  });

  it('Status-Badges nur aus der Registry; ohne Eintrag kein Badge', () => {
    for (const p of PRODUCTS) {
      const st = productStatus(p);
      if (!p.registryId) {
        expect(st).toBeNull();
        continue;
      }
      const item = IMPLEMENTATION_ITEMS.find((i) => i.id === p.registryId);
      expect(item, p.registryId).toBeTruthy();
      expect(st?.label).toBe(STATUS_TEXT[item!.status]);
    }
  });

  it('Preise und Steuerhinweis aus der SSoT', () => {
    render(<MemoryRouter><LandingV3Preview /></MemoryRouter>);
    for (const card of planCards()) {
      const el = screen.getByTestId(`v3-plan-${card.id}`);
      expect(within(el).getByText(card.price)).toBeInTheDocument();
    }
    expect(screen.getByTestId('v3-tax-note')).toHaveTextContent(pricingTaxNote(COMPANY.taxMode));
  });

  it('rendert alle vier Produkte, AI Receptionist als „In Vorbereitung“, Rechtslinks erreichbar', () => {
    render(<MemoryRouter><LandingV3Preview /></MemoryRouter>);
    expect(screen.getByTestId('v3-hero-heading')).toHaveTextContent('Ihre Ideen.In Bewegung.');
    for (const p of PRODUCTS) expect(screen.getByTestId(`v3-product-${p.key}`)).toHaveAttribute('href', p.href);
    expect(screen.getByTestId('v3-product-receptionist')).toHaveTextContent('In Vorbereitung');
    const legal = screen.getByRole('navigation', { name: 'Rechtliches' });
    for (const [label, href] of [['Impressum', '/impressum'], ['Datenschutz', '/datenschutz'], ['Widerruf', '/widerruf']]) {
      expect(within(legal).getByRole('link', { name: label })).toHaveAttribute('href', href);
    }
  });

  it('übernimmt keine Platzhalter aus dem Export: keine Bot-IDs, keine WhatsApp-Nummer, kein Projekt-Endpunkt, keine festen Preise', () => {
    const src = ['src/pages/LandingV3Preview.tsx', 'src/components/landing/v3/landingV3Data.ts', 'src/components/landing/v3/HeroStage.tsx']
      .map(read)
      .join('\n');
    expect(src).not.toMatch(/4917640132161|wa\.me|be672b50|582308a1|ebljyceifhnlzhjfyxup|functions\/v1/);
    expect(src).not.toMatch(/\b(79|249|699|1\.498) €/);
    expect(src).not.toMatch(/Mit Backend verbunden|Browser-Agent:/);
    expect(src).not.toMatch(/Pilot anfragen|Demo buchen|Termin vereinbaren|Beratung anfragen/);
  });

  it('3D nur lazy und mit Standbild als Rückfall', () => {
    const stage = read('src/components/landing/v3/HeroStage.tsx');
    expect(stage).toContain("import('./heroScene3D')");
    expect(stage).not.toMatch(/^import .*from 'three'/m);
    expect(stage).toContain('prefers-reduced-motion: reduce');
    expect(stage).toContain('/landing-v3/hero-still.jpg');
  });
});
