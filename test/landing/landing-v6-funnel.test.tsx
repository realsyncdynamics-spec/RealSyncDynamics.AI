/**
 * Startseite `/` (Landing v6) — Trichter-Vertrag: Beta-Hinweis unter dem
 * Hero-CTA, Check → Scan mit eigener Quelle, Beweis-Abschnitte vor Agenten.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingV6View } from '../../src/components/landing/v6/LandingV6View';
import { useLandingV6 } from '../../src/components/landing/v6/useLandingV6';
import { BETA } from '../../src/config/beta';
import { CTA } from '../../src/content/runtimeVocab';

function Harness() {
  return <LandingV6View v={useLandingV6()} />;
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const mount = () => render(<MemoryRouter initialEntries={['/']}><Harness /></MemoryRouter>);

it('keeps the free scan as primary hero CTA and adds the beta offer below it', () => {
  mount();
  expect(screen.getByTestId('hero-primary-cta')).toHaveAttribute('href', '/audit?source=landing-v6');
  const beta = screen.queryByTestId('hero-beta-link');
  if (!(BETA.active && BETA.publicOffer)) {
    expect(beta).toBeNull();
    return;
  }
  expect(beta).toHaveTextContent(`Offene Beta: kostenlos testen bis ${BETA.endsLabel} · keine Kreditkarte`);
  // Claims-Grenze aus config/beta.ts: bis WP-3 nur „kostenlos testen“ versprechen.
  expect(beta).not.toHaveTextContent(/alle Funktionen/);
  const href = beta?.getAttribute('href') ?? '';
  expect(href.startsWith('/welcome?')).toBe(true);
  expect(new URLSearchParams(href.split('?')[1]).get('source')).toBe('landing-v6-hero');
});

it('routes the self-check into the domain scan with its own source', () => {
  const view = mount();
  const check = within(view.container.querySelector('#check') as HTMLElement);
  expect(check.getByText(/den kostenlosen Website-Check starten/)).toBeInTheDocument();
  fireEvent.click(check.getAllByRole('radio')[0]);
  expect(check.getByText(/Ihre Einschätzung mit dem kostenlosen Website-Check Ihrer Domain belegen/)).toBeInTheDocument();
  expect(check.getByTestId('check-audit-cta')).toHaveAttribute('href', '/audit?source=landing-v6-check');
});

it('shows proof (Control Room, Evidence) before Agent Governance', () => {
  const view = mount();
  const ids = Array.from(view.container.querySelectorAll('section[id]')).map((s) => s.id);
  expect(ids.indexOf('produkt')).toBeLessThan(ids.indexOf('control-room'));
  expect(ids.indexOf('control-room')).toBeLessThan(ids.indexOf('evidence'));
  expect(ids.indexOf('evidence')).toBeLessThan(ids.indexOf('agenten'));
  expect(ids.indexOf('agenten')).toBeLessThan(ids.indexOf('check'));
});

it('offers both website paths: automatic SiteOS draft and individual web design', () => {
  const view = mount();
  const ids = Array.from(view.container.querySelectorAll('section[id]')).map((s) => s.id);
  expect(ids.indexOf('websites')).toBeGreaterThan(-1);
  expect(ids.indexOf('websites')).toBeLessThan(ids.indexOf('preise'));
  const sec = within(screen.getByTestId('landing-websites'));
  expect(view.container.querySelector('[data-website-cta="auto"]')).toHaveAttribute('href', '/build');
  expect(view.container.querySelector('[data-website-cta="custom"]')).toHaveAttribute(
    'href',
    '/web-studio?source=landing-v6-websites',
  );
  // Ehrlicher Status: Builder/Veröffentlichung sind Preview, nur Weg 1 trägt das Badge.
  expect(sec.getAllByText('PREVIEW')).toHaveLength(1);
  // Design-DNA (AGENTS.md): 90°-Ecken im ganzen Abschnitt, Status-Metadaten in Monospace.
  expect(sec.getByText('PREVIEW').style.fontFamily).toMatch(/monospace/);
  for (const el of screen.getByTestId('landing-websites').querySelectorAll<HTMLElement>('[style*="border-radius"]')) {
    expect(el.style.borderRadius).toMatch(/^0(px)?$/);
  }
  expect(sec.getByRole('link', { name: 'Leistungsumfang ansehen' })).toHaveAttribute('href', '/frontend-builder');
  // Haupt-CTA der Dienstleistung ist die kanonische Ausnahme aus runtimeVocab.
  expect(view.container.querySelector('[data-website-cta="custom"]')).toHaveTextContent(CTA.webdesign);
  expect(sec.queryByText(/Projekt mit Dominik besprechen/)).toBeNull();
  // Erweiterung: individuelle Dashboards, Bots/Workflows nur „soweit verfügbar“.
  const ext = within(screen.getByTestId('landing-websites-extension'));
  for (const branche of ['Handwerk', 'Arztpraxis', 'Kanzlei']) expect(ext.getByText(branche)).toBeInTheDocument();
  expect(ext.getByText(/Bots .*KI-Workflows und Integrationen/)).toBeInTheDocument();
  expect(ext.getByText(/tatsächlich verfügbar/)).toBeInTheDocument();
  // Hauptnavigation erst ab 1180 px (jsdom: 1024) — Footer-Navigation rendert immer.
  expect(within(screen.getByRole('navigation', { name: 'Produkt' })).getByRole('link', { name: 'Websites' }))
    .toHaveAttribute('href', '#websites');
});

it('keeps the public beta offer while list prices stay in the SSoT', () => {
  const view = mount();
  const pricing = view.container.querySelector('#preise') as HTMLElement;
  // Entscheidung 21.10.2026: Beta-Angebot bleibt, bis sein Ende gesondert freigegeben wird.
  expect(BETA.publicOffer).toBe(true);
  if (!BETA.active) return;
  expect(pricing).toHaveTextContent(`kostenlos bis ${BETA.endsLabel}`);
  expect(pricing).toHaveTextContent('79 €');
  expect(pricing).toHaveTextContent('249 €');
  expect(pricing).toHaveTextContent('699 €');
});

it('keeps one filled CTA in the hero and ties the plan row to it with its own source', () => {
  mount();
  const plans = within(screen.getByRole('group', { name: 'Pläne und Preise' }));
  const links = plans.getAllByRole('link').filter((a) => a.hasAttribute('data-hero-cta') && a.getAttribute('data-hero-cta')!.startsWith('plan-'));
  expect(links.length).toBeGreaterThan(0);
  for (const a of links) {
    const href = a.getAttribute('href') ?? '';
    expect(new URLSearchParams(href.split('?')[1]).get('source')).toBe('landing-v6-hero');
  }
  // Enterprise bleibt erreichbar, jetzt als Teil der Preiszeile statt als zweiter Hero-Button.
  const enterprise = screen.getByTestId('hero-secondary-cta');
  expect(enterprise).toHaveAttribute('href', '/contact-sales?tier=enterprise&source=landing-v6');
  expect(enterprise).toHaveTextContent('Auf Anfrage');
  expect(plans.getByRole('link', { name: 'Leistungen vergleichen' })).toHaveAttribute('href', '#preise');
});
