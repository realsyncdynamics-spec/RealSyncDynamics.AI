/**
 * Landing v8 (/) — Vertrag: Owner-Entwurf 09.11.2026, Status aus der SSoT,
 * Stichwort-Weiterleitung, Pflichtlinks, keine Preise, keine externen Ressourcen.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { LandingV8, routeIntent, titleCase } from '../../src/pages/LandingV8';
import { COMPANY_PRODUCTS } from '../../src/components/landing/company/companyProducts';
import { getImplementation, STATUS_LABEL } from '../../src/product/implementation-status';

// WebGL gibt es in jsdom nicht; die Szene wird dynamisch geladen und hier ersetzt.
vi.mock('../../src/components/landing/v8/orbitScene', () => ({ mountOrbitScene: () => () => {} }));

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Where() {
  const l = useLocation();
  return <output data-testid="where">{l.pathname + l.search}</output>;
}

const mount = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<LandingV8 />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

describe('Landing v8 – Routing und Inhalt', () => {
  it('ist die Startseite; v6 bleibt unter /design/landing-v6', () => {
    const app = readFileSync(resolve(__dirname, '../../src/App.tsx'), 'utf8');
    expect(app).toMatch(/path="\/"\s+element=\{<LandingV8 \/>\}/);
    expect(app).toMatch(/path="\/design\/landing-v6" element=\{<LandingV6 \/>\}/);
  });

  it('rendert genau eine H1 mit dem Claim des Entwurfs', () => {
    mount();
    const h1 = screen.getAllByRole('heading', { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0]).toHaveTextContent('Ein System. Alles im Einklang.');
    expect(screen.getByText('KI steuern. Anfragen verbinden. Digital wachsen.')).toBeInTheDocument();
    expect(screen.getByText('Made in Thüringen. Für den Mittelstand.')).toBeInTheDocument();
  });

  it('nimmt den Status der Chips aus der Registry', () => {
    mount();
    for (const p of COMPANY_PRODUCTS) {
      const item = getImplementation(p.ssotId);
      expect(item, p.ssotId).toBeDefined();
      const chip = screen.getByTestId(`lv8-chip-${p.id}`);
      expect(chip).toHaveAttribute('data-status', item!.status);
      expect(chip).toHaveTextContent(titleCase(STATUS_LABEL[item!.status]));
    }
  });

  it('verlinkt Navigation, Produkte und Pflichtangaben auf echte Routen', () => {
    const { container } = mount();
    const nav = within(screen.getByRole('navigation', { name: 'Hauptnavigation' }));
    expect(nav.getByRole('link', { name: 'Unternehmen' })).toHaveAttribute('href', '/unternehmen');
    expect(nav.getByRole('link', { name: /Login/ })).toHaveAttribute('href', '/login');
    expect(screen.getByTestId('lv8-product-governance')).toHaveAttribute('href', '/audit');
    expect(screen.getByTestId('lv8-product-voice')).toHaveAttribute('href', '/unternehmen');
    expect(screen.getByTestId('lv8-product-builder')).toHaveAttribute('href', '/frontend-builder');
    const legal = within(screen.getByRole('navigation', { name: 'Rechtliches' }));
    for (const [name, href] of [
      ['Impressum', '/impressum'],
      ['Datenschutz', '/datenschutz'],
      ['AGB', '/agb'],
      ['Widerruf', '/widerruf'],
    ] as const) {
      expect(legal.getByRole('link', { name })).toHaveAttribute('href', href);
    }
    for (const a of Array.from(container.querySelectorAll('a[href]'))) {
      expect(a.getAttribute('href')).toMatch(/^[/#]/);
    }
  });

  it('nennt keine Preise und keine unbelegten Kennzahlen', () => {
    const { container } = mount();
    expect(container.textContent).not.toMatch(/€|\bEUR\b|99[,.]9|ISO 27001|SLA/);
  });
});

describe('Landing v8 – Eingabezeile', () => {
  it('leitet Stichworte auf das passende Produkt', () => {
    expect(routeIntent('')).toBeNull();
    expect(routeIntent('   ')).toBeNull();
    expect(routeIntent('Wir verpassen zu viele Anrufe')).toBe('/unternehmen');
    expect(routeIntent('Neue Website für unseren Betrieb')).toBe('/frontend-builder');
    expect(routeIntent('KI datenschutzkonform einsetzen')).toBe('/audit');
    expect(routeIntent('Etwas ganz anderes')).toBe('/kontakt?source=landing-home&nachricht=Etwas%20ganz%20anderes');
  });

  it('navigiert beim Absenden, leere Eingabe bleibt auf der Seite', () => {
    mount();
    const input = screen.getByRole('textbox', { name: 'Was möchten Sie mit RealSync bewegen?' });
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(screen.queryByTestId('where')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: 'Telefon-Assistent' } });
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/unternehmen');
  });
});

describe('Landing v8 – Ressourcen', () => {
  it('lädt Schriften nur selbst gehostet und three.js nur dynamisch', () => {
    const css = readFileSync(resolve(__dirname, '../../src/styles/landing-v8.css'), 'utf8');
    expect(css).not.toMatch(/fonts\.googleapis|fonts\.gstatic|https?:\/\//);
    const page = readFileSync(resolve(__dirname, '../../src/pages/LandingV8.tsx'), 'utf8');
    expect(page).not.toMatch(/from 'three'/);
    expect(page).toContain("import('../components/landing/v8/orbitScene')");
  });
});
