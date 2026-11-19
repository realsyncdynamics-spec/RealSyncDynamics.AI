/**
 * Startseite v3 auf `/`: Inhalte aus den Quellen, keine übernommenen
 * Platzhalter aus dem Design-Export; Landing v6 bleibt als Rückfall.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingV3 } from '../../src/pages/LandingV3';
import { planCards, PRODUCTS, productStatus, RECEPTIONIST, STATUS_TEXT } from '../../src/components/landing/v3/landingV3Data';
import { IMPLEMENTATION_ITEMS } from '../../src/product/implementation-status';
import { pricingTaxNote } from '../../shared/pricing';
import { COMPANY } from '../../src/config/company';

const root = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));

describe('Startseite v3 — `/`', () => {
  it('ist Startseite: `/` rendert v3, alte Vorschau leitet um, v6 bleibt als Rückfall', () => {
    const app = read('src/App.tsx');
    expect(app).toContain('<Route path="/" element={<LandingV3 />} />');
    expect(app).toContain('<Route path="/design/startseite-v3" element={<Navigate to="/" replace />} />');
    expect(app).toContain('<Route path="/design/landing-v6" element={<LandingV6 />} />');
    const seo = read('src/config/seo.ts');
    expect(seo).toMatch(/'\/design\/startseite-v3': \{[\s\S]*?noIndex: true/);
    expect(seo).not.toContain('lv2FaqJsonLd()');
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
    render(<MemoryRouter><LandingV3 /></MemoryRouter>);
    for (const card of planCards()) {
      const el = screen.getByTestId(`v3-plan-${card.id}`);
      // Intl setzt ein geschütztes Leerzeichen („0\u00a0€“); Testing Library normalisiert nur den DOM-Text.
      expect(within(el).getByText(card.price.replace(/\s+/g, ' '))).toBeInTheDocument();
    }
    expect(screen.getByTestId('v3-tax-note')).toHaveTextContent(pricingTaxNote(COMPANY.taxMode));
  });

  it('rendert alle vier Produkte, AI Receptionist als „In Vorbereitung“, Rechtslinks erreichbar', () => {
    render(<MemoryRouter><LandingV3 /></MemoryRouter>);
    expect(screen.getByTestId('v3-hero-heading')).toHaveTextContent('Ihre Ideen.In Bewegung.');
    for (const p of PRODUCTS) expect(screen.getByTestId(`v3-product-${p.key}`)).toHaveAttribute('href', p.href);
    expect(screen.getByTestId('v3-product-receptionist')).toHaveTextContent('In Vorbereitung');
    expect(screen.queryByTestId('v3-product-receptionist')?.tagName).toBe('SECTION');
    const legal = screen.getByRole('navigation', { name: 'Rechtliches' });
    for (const [label, href] of [['Impressum', '/impressum'], ['Datenschutz', '/datenschutz'], ['Widerruf', '/widerruf']]) {
      expect(within(legal).getByRole('link', { name: label })).toHaveAttribute('href', href);
    }
  });

  it('Hauptnavigation führt Voice Agent und Kontakt, Ziele sind echte Routen', () => {
    render(<MemoryRouter><LandingV3 /></MemoryRouter>);
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' });
    expect(within(nav).getByRole('link', { name: 'Voice Agent' })).toHaveAttribute('href', '/phonebot/start');
    expect(within(nav).getByRole('link', { name: 'Kontakt' })).toHaveAttribute('href', '/contact-sales');
    const app = read('src/App.tsx');
    expect(app).toContain('<Route path="/phonebot/start"');
    expect(app).toContain('<Route path="/contact-sales"');
  });

  it('stellt den AI Receptionist als ersten Abschnitt nach dem Hero vor (K4), ohne Live-Versprechen', () => {
    const { container } = render(<MemoryRouter><LandingV3 /></MemoryRouter>);
    const first = container.querySelector('main > section');
    expect(first?.id).toBe('receptionist');
    const section = screen.getByTestId('v3-product-receptionist');
    expect(within(section).getByRole('heading', { level: 2 })).toHaveTextContent(RECEPTIONIST.heading);
    // Status bleibt „In Vorbereitung“, solange Telefonie nicht live ist.
    expect(RECEPTIONIST.status).toBe('coming-soon');
    expect(IMPLEMENTATION_ITEMS.find((i) => i.id === 'voice-telephony')?.status).not.toBe('live');
    expect(within(section).getAllByText(STATUS_TEXT['coming-soon']).length).toBeGreaterThan(0);
    expect(screen.getByTestId('v3-receptionist-waitlist')).toHaveAttribute('href', '/warteliste?interest=bots&source=landing-v3-receptionist');
    const tryLink = screen.getByTestId('v3-receptionist-try');
    expect(tryLink).toHaveAttribute('href', '/chatbot/start?source=landing-v3-receptionist');
    const botStatus = IMPLEMENTATION_ITEMS.find((i) => i.id === RECEPTIONIST.tryRegistryId)!.status;
    expect(tryLink).toHaveTextContent(STATUS_TEXT[botStatus]);
    expect(within(screen.getByTestId('v3-receptionist-steps')).getAllByRole('listitem')).toHaveLength(RECEPTIONIST.steps.length);
    // Hero-Sekundär-CTA und Skip-Link führen zum Receptionist.
    expect(screen.getByRole('link', { name: 'AI Receptionist ansehen' })).toHaveAttribute('href', '#receptionist');
    expect(screen.getByRole('link', { name: 'Zum Inhalt springen' })).toHaveAttribute('href', '#receptionist');
  });

  it('übernimmt keine Platzhalter aus dem Export: keine Bot-IDs, keine WhatsApp-Nummer, kein Projekt-Endpunkt, keine festen Preise', () => {
    const src = [
      'src/pages/LandingV3.tsx',
      'src/components/landing/v3/landingV3Data.ts',
      'src/components/landing/v3/HeroStage.tsx',
      'src/components/landing/v3/SyncHeroStage.tsx',
    ]
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

  it('Hero zeigt SYNC: Szene nur lazy über canRun3D, Standbild als Rückfall', () => {
    const sync = read('src/components/landing/v3/SyncHeroStage.tsx');
    expect(sync).toContain("import('../../visual/sync-mascot/syncMascotScene')");
    expect(sync).not.toMatch(/^import .*from 'three'/m);
    expect(sync).toContain('canRun3D()');
    expect(read('src/pages/LandingV3.tsx')).toContain('<SyncHeroStage');

    // matchMedia meldet hier reduzierte Bewegung → nur das Standbild, keine Szene.
    render(<MemoryRouter><LandingV3 /></MemoryRouter>);
    const stage = screen.getByTestId('v3-sync-stage');
    expect(stage).toHaveAttribute('data-scene', 'still');
    expect(within(stage).getByRole('img', { name: /SYNC, das Maskottchen/ })).toHaveAttribute('src', '/landing-v3/sync-still.jpg');
  });

  it('Hauptbutton im Hero blendet den Assistent-Button aus (data-hero-cta)', () => {
    render(<MemoryRouter><LandingV3 /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Kostenlosen Check starten' })).toHaveAttribute('data-hero-cta', 'landing-v3');
  });
});
