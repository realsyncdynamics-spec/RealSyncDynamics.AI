/**
 * Startseite `/` (Landing v6) — KMU-Positionierung, Phase 1 (18.10.2026).
 *
 * Vertrag: Zielgruppe und Nutzen im Hero, Prüfen → Verstehen → Handeln →
 * Nachweisen als Prozesskette, Website-Check überall erreichbar, Dashboard nur
 * als gekennzeichnete Vorschau, keine Dauer- oder Konformitätsversprechen.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingV6View } from '../../src/components/landing/v6/LandingV6View';
import { useLandingV6 } from '../../src/components/landing/v6/useLandingV6';
import { PROBLEMS, STEPS, TRUST } from '../../src/components/landing/v6/kmu-content';
import { getImplementation } from '../../src/product/implementation-status';
import { PUBLIC_STATUS_LABEL } from '../../src/product/implementation-status-public';

function Harness() {
  return <LandingV6View v={useLandingV6()} />;
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const mount = () => render(<MemoryRouter initialEntries={['/']}><Harness /></MemoryRouter>);

it('names the SME audience and the benefit in the hero', () => {
  mount();
  expect(screen.getByText('FÜR DEUTSCHE KLEINE UND MITTLERE UNTERNEHMEN')).toBeInTheDocument();
  const h1 = screen.getByRole('heading', { level: 1 });
  expect(h1).toHaveTextContent('KI und Datenschutz verstehen.Risiken erkennen.Maßnahmen nachweisen.');
  expect(screen.getByText(/unterstützt Ihr Unternehmen dabei, Risiken auf Ihrer Website/)).toBeInTheDocument();
  expect(screen.getByTestId('hero-primary-cta')).toHaveTextContent('Jetzt kostenlosen Website-Check starten');
  expect(screen.getByTestId('hero-how-cta')).toHaveAttribute('href', '#produkt');
  // KMU zuerst, ohne die bestehenden Segmente auszuschließen.
  expect(screen.getByTestId('hero-segments')).toHaveTextContent(/SaaS-Unternehmen, Agenturen und Compliance-Verantwortliche/);
  expect(screen.getByText('Einfacher Einstieg. Verständliche Ergebnisse. Keine IT-Kenntnisse erforderlich.')).toBeInTheDocument();
});

it('shows the four-step chain in order, each with example and platform feature', () => {
  const view = mount();
  const chain = view.container.querySelector('#produkt ol') as HTMLElement;
  const steps = within(chain).getAllByRole('listitem');
  expect(steps.map((s) => within(s).getByRole('heading').textContent)).toEqual(['Prüfen', 'Verstehen', 'Handeln', 'Nachweisen']);
  for (const [i, s] of steps.entries()) {
    expect(s).toHaveTextContent(STEPS[i].example);
    expect(s).toHaveTextContent(STEPS[i].feature);
  }
});

it('separates what the scan sees from what only the company can provide', () => {
  const view = mount();
  const section = within(view.container.querySelector('#probleme') as HTMLElement);
  expect(section.getByRole('heading', { level: 2 })).toHaveTextContent('Wissen Sie, welche digitalen Risiken Ihr Unternehmen betreffen?');
  expect(PROBLEMS.some((p) => p.source === 'company')).toBe(true);
  expect(section.getAllByText('Braucht Ihre Angaben').length).toBeGreaterThan(0);
  expect(section.getByText(/Interne Datenverarbeitung und KI-Nutzung im Betrieb erfasst er nicht vollständig/)).toBeInTheDocument();
});

it('derives the monitoring label from implementation-status', () => {
  mount();
  const status = getImplementation('continuous-domain-monitoring')?.status ?? 'coming-soon';
  const note = screen.getByTestId('monitoring-status');
  if (status === 'live') expect(note).toHaveTextContent('verfügbar');
  else expect(note).toHaveTextContent(`„${PUBLIC_STATUS_LABEL.de[status]}“`);
});

it('links every trust statement to a checkable source', () => {
  const view = mount();
  const trust = within(view.container.querySelector('#vertrauen') as HTMLElement);
  for (const t of TRUST) {
    const link = trust.getByRole('link', { name: t.link });
    expect(link).toHaveAttribute('href', t.href);
    if (t.href.startsWith('#')) expect(view.container.querySelector(t.href)).not.toBeNull();
  }
});

it('labels the dashboard as a preview with example data', () => {
  const view = mount();
  const dash = within(view.container.querySelector('#control-room') as HTMLElement);
  expect(dash.getByText('Vorschau · Beispieldaten')).toBeInTheDocument();
  expect(dash.getByText(/keine Kundendaten, keine echte Bewertung/)).toBeInTheDocument();
  expect(dash.getByRole('list', { name: 'Risikobereiche' })).toBeInTheDocument();
});

it('keeps every website-check CTA on /audit and links the journey to real routes', () => {
  const view = mount();
  const checkLinks = screen.getAllByRole('link', { name: /Website-Check/ });
  expect(checkLinks.length).toBeGreaterThan(3);
  for (const a of checkLinks) expect(a.getAttribute('href')).toMatch(/^\/audit\?source=landing-v6/);

  const journey = within(view.container.querySelector('#start') as HTMLElement);
  expect(journey.getByRole('link', { name: 'Konto anlegen' }).getAttribute('href')).toMatch(/^\/welcome\?/);
  expect(journey.getByRole('link', { name: 'Ich habe schon ein Konto' })).toHaveAttribute('href', '/login');
});

it('lists the industries and keeps the web design offer secondary', () => {
  const view = mount();
  const branchen = within(view.container.querySelector('#branchen') as HTMLElement);
  for (const t of ['Handwerk & Dienstleister', 'Kanzleien', 'Arztpraxen', 'Agenturen & Beratungen', 'Mittelstand']) {
    expect(branchen.getByRole('heading', { name: t })).toBeInTheDocument();
  }
  const ids = Array.from(view.container.querySelectorAll('section[id]')).map((s) => s.id);
  expect(ids.indexOf('webdesign')).toBeGreaterThan(ids.indexOf('preise'));
});

it('makes no duration or compliance promises', () => {
  const { container } = mount();
  const text = container.textContent ?? '';
  expect(text).not.toMatch(/90 Sekunden|90 s\b|unter 90/);
  expect(text).not.toMatch(/garantiert|zertifiziert|100 ?% (DSGVO|konform)/i);
  // „konform“ nur verneint (FAQ/Disclaimer), nie als Zusage.
  for (const m of text.matchAll(/[^.]*konform[^.]*\./gi)) {
    expect(m[0]).toMatch(/Nein|keine|nicht/);
  }
});
