/**
 * Landing v4 „Klassisch" (`/`) — Vertrag: H1, Betriebsschleife, CTAs in echte
 * Routen, auflösbare In-Page-Anker, Roadmap-Filter, Scan-Formular.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { LandingV4 } from '../../src/pages/LandingV4';
import { resetLangForTests, setLang } from '../../src/i18n/useLang';
import { PUBLIC_ROADMAP_COPY } from '../../src/product/implementation-status-public';

// Die 3D-Szene braucht WebGL; im DOM-Test genügt, dass sie nicht mountet.
vi.mock('../../src/components/landing/v4/heroEarthScene', () => ({ mountHeroEarth: () => () => {} }));

beforeEach(() => {
  localStorage.clear();
  resetLangForTests();
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetLangForTests();
});

function Where() {
  const loc = useLocation();
  return <p data-testid="where">{loc.pathname + loc.search}</p>;
}

const mount = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<LandingV4 />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

it('renders the v4 hero: H1, loop and CTAs into real routes', () => {
  const view = mount();
  // Default-Sprache DE: H1 und Lede deutsch (Produktname bleibt EN).
  screen.getByRole('heading', { level: 1, name: /AI Compliance\s*Operations OS für Europa/ });
  expect(view.container.querySelectorAll('h1')).toHaveLength(1);
  expect(screen.getByTestId('v4-hero-heading')).toHaveTextContent(/für Europa/);
  expect(view.container.querySelector('.loop')?.textContent).toBe('DiscoverClassifyEnforceProve');
  expect(view.container.querySelector('#scan')).toHaveAttribute('href', '/audit');
  expect(view.container.querySelector('#scan')).toHaveAttribute('data-hero-cta', '');
  expect(view.container.querySelector('#scan')).toHaveTextContent('Free Governance Audit');
  expect(screen.getByTestId('v4-hero-lede')).toHaveTextContent(
    'Runtime-Governance für regulierte KI.Kontinuierliche Evidenz. Menschliche Kontrolle. EU-nativ by Design.',
  );
  expect(view.container.querySelector('header .cta-label-mobile')).toHaveTextContent('Audit starten');
  const secondary = view.container.querySelector('.hero .btn-ghost');
  expect(secondary).toHaveAttribute('href', '/governance-runtime');
  expect(secondary?.textContent).toMatch(/Runtime ansehen/);
  expect(secondary?.textContent).not.toMatch(/Live|Demo/i);
  expect(view.container.querySelector('header .cta-pill')).toHaveAttribute('href', '/audit');
  // LIVE_CAPS: Klassifizierung claims public classifier only (no inventory persist).
  const classify = Array.from(view.container.querySelectorAll('#platform .card')).find((c) =>
    c.querySelector('h3')?.textContent?.includes('EU-AI-Act-Klassifizierung'),
  );
  expect(classify).toBeTruthy();
  expect(classify).toHaveAttribute('href', '/ai-act-klassifikator');
  expect(classify?.textContent).not.toMatch(/als Inventar führen/i);
  expect(classify?.textContent).toMatch(/Klassifikator|Risikoklasse/i);
});

it('renders English hero heading and lede when EN is active', () => {
  setLang('en');
  mount();
  screen.getByRole('heading', { level: 1, name: /AI Compliance\s*Operations OS for Europe/ });
  expect(screen.getByTestId('v4-hero-heading')).toHaveTextContent(/for Europe/);
  expect(screen.getByTestId('v4-hero-heading')).not.toHaveTextContent(/für Europa/);
  expect(screen.getByTestId('v4-hero-lede')).toHaveTextContent(
    'Runtime governance for regulated AI.Continuous evidence. Human control. EU-native by design.',
  );
  expect(screen.getByTestId('v4-hero-lede')).not.toHaveTextContent(/regulierter KI/);
});

it('presents the governance loop as four ordered, clearly titled steps', () => {
  mount();
  const loop = screen.getByRole('region', { name: 'Governance Loop' });
  const list = within(loop).getByRole('list');
  expect(list.tagName).toBe('OL');
  const steps = within(list).getAllByRole('listitem');
  expect(steps).toHaveLength(4);
  expect(steps.map((step) => within(step).getByRole('heading', { level: 3 }).textContent))
    .toEqual(['Discover', 'Classify', 'Enforce', 'Prove']);
  expect(steps[2]).toHaveTextContent('Menschen geben frei');
  expect(steps[3]).toHaveTextContent('Drift erkennen');
});

it('keeps live module badges distinct from planned capabilities and policy example data', () => {
  const view = mount();
  const cards = Array.from(view.container.querySelectorAll('#platform .card'))
    .filter((card) => card.querySelector('h3'));
  expect(cards).toHaveLength(7);
  for (const card of cards) {
    expect(card.querySelector('.card-tag.status[data-st="live"]')).toHaveTextContent('LIVE');
    expect(card.querySelector('h3')).not.toHaveAttribute('style');
    expect(card.querySelector('.body')).not.toBeEmptyDOMElement();
  }
  expect(cards.filter((card) => card.tagName === 'A').map((card) => card.getAttribute('href')))
    .toEqual(['/ai-act-klassifikator', '/evidence', '/runtime']);
  expect(cards[1]).toHaveTextContent('ohne Speichern ins Inventar');
  const planned = view.container.querySelector('#platform .rm-card.dashed')!;
  expect(planned.querySelector('[data-st="live"]')).toBeNull();
  expect(planned).toHaveTextContent('noch nicht in Produktion');
  const preview = view.container.querySelector('#dashboard .app')!;
  expect(preview).toHaveAttribute('data-example-preview', 'true');
  expect(preview.querySelector('.panel-head')).toHaveTextContent('POLICY PACKS');
  const frameworks = preview.querySelectorAll('.fw');
  expect(frameworks).toHaveLength(6);
  expect(frameworks[4]).toHaveTextContent('TISAXNEXT');
  expect(frameworks[5]).toHaveTextContent('DORANEXT');
});

it('keeps every in-page anchor resolvable and every route link relative', () => {
  const view = mount();
  for (const a of Array.from(view.container.querySelectorAll('a'))) {
    const href = a.getAttribute('href')!;
    expect(href, a.textContent ?? '').toMatch(/^[#/]/);
    if (href.startsWith('#') && href !== '#top') {
      expect(view.container.querySelector(href), href).not.toBeNull();
    }
  }
});

it('filters roadmap groups by status', () => {
  const view = mount();
  const groups = () =>
    Array.from(view.container.querySelectorAll<HTMLElement>('#roadmap .group-head'))
      .filter((h) => (h.parentElement as HTMLElement).style.display !== 'none')
      .map((h) => h.querySelector('h3')?.textContent);
  expect(groups()).toEqual(['Live', 'In Arbeit', 'Geplant']);
  fireEvent.click(screen.getByRole('button', { name: 'In Arbeit' }));
  expect(groups()).toEqual(['In Arbeit']);
  expect(screen.getByRole('button', { name: 'In Arbeit' })).toHaveAttribute('aria-pressed', 'true');
});

it('roadmap comes from public copy and omits redirect-only design landings', () => {
  const view = mount();
  const roadmap = view.container.querySelector('#roadmap')!;
  expect(roadmap.textContent).toContain('ehrlich gekennzeichnet');
  expect(roadmap.textContent).toContain('Compliance Command Center');
  expect(roadmap.textContent).toContain('/ai-act-klassifikator');
  expect(roadmap.textContent).toContain('EU-AI-Act-Inventar');
  expect(roadmap.textContent).toMatch(/nicht freigeschaltet|Inventar speichern/i);
  expect(roadmap.textContent).not.toContain('Product-Registry');
  expect(roadmap.textContent).not.toContain('CommandCenterDashboard');
  expect(roadmap.textContent).not.toContain('AgentOsPanel');
  expect(roadmap.textContent).not.toContain('produktionsreifer E2E-Pfad offen');
  expect(roadmap.textContent).not.toContain('sind aber nicht der Live-Hero');
  expect(roadmap.textContent).not.toContain('/ai-act-governance');
  expect(roadmap.textContent).not.toContain('als Inventar führen');
  expect(roadmap.textContent).not.toContain('/design/ledger');
  expect(roadmap.textContent).not.toContain('/design/tribunal');
  expect(roadmap.textContent).not.toContain('Evidence Ledger Landing (Design)');
  expect(roadmap.textContent).not.toContain('Tribunal Landing (Design)');
  // Agent OS preview cards must not advertise a live /app/dashboard mount.
  const previewCards = Array.from(roadmap.querySelectorAll('.rm-card.dashed h4'))
    .filter((h) => h.textContent?.includes('Agent OS') || h.textContent?.includes('Agent OS™') || h.textContent?.includes('RealSync Agent OS'));
  for (const h of previewCards) {
    const card = h.closest('.rm-card');
    expect(card?.querySelector('u')?.textContent ?? '').not.toBe('/app/dashboard');
  }
});

it('skips roadmap items without public copy instead of crashing /', () => {
  const id = 'command-center';
  const saved = PUBLIC_ROADMAP_COPY[id];
  expect(saved).toBeDefined();
  delete PUBLIC_ROADMAP_COPY[id];
  try {
    const view = mount();
    const roadmap = view.container.querySelector('#roadmap')!;
    expect(roadmap).not.toBeNull();
    expect(roadmap.textContent).not.toContain('Compliance Command Center');
    expect(roadmap.querySelectorAll('.rm-card').length).toBeGreaterThan(0);
  } finally {
    PUBLIC_ROADMAP_COPY[id] = saved;
  }
});

it('marks the dashboard preview as example data (visible, not only aria)', () => {
  const view = mount();
  const section = view.container.querySelector('#dashboard')!;
  const dash = section.querySelector('.app')!;
  const note = screen.getByTestId('v4-dash-example-note');
  expect(dash).toHaveAttribute('data-demo-kpis', 'true');
  expect(dash.getAttribute('aria-label')).toMatch(/Beispielansicht|Beispieldaten/i);
  expect(dash.querySelector('.url')?.textContent).toBe('realsyncdynamicsai.de/app/dashboard');
  expect(dash.querySelector('.url')?.textContent).not.toContain('realsyncdynamics.ai');
  expect(dash.querySelector('.app-bar .tag')?.textContent).toBe('Beispielansicht');
  // Note sits outside the dark preview frame (sibling before .app), clearly readable.
  expect(dash.contains(note)).toBe(false);
  expect(note.compareDocumentPosition(dash) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(note.textContent).toMatch(/Beispieldaten.*keine echten Messwerte.*eigenen Scan/i);
});

it('marks the dashboard preview in EN when language is English', () => {
  setLang('en');
  mount();
  expect(screen.getByTestId('v4-dash-example-note').textContent).toMatch(
    /Example data.*not real measurements.*own scan/i,
  );
  const dash = document.querySelector('#dashboard .app')!;
  expect(dash.querySelector('.app-bar .tag')?.textContent).toBe('Example view');
  expect(dash.getAttribute('aria-label')).toMatch(/Example view|sample data/i);
});

it('roadmap public markup leaks no internal registry details', () => {
  const view = mount();
  const roadmap = view.container.querySelector('#roadmap')!;
  const text = roadmap.textContent ?? '';
  for (const banned of [
    'CommandCenterDashboard',
    'AgentOsPanel',
    '#1743',
    '#1331',
    'Messung',
    'Dominik',
    'Auto-Merge',
    'optimizer',
    'Kugel',
  ] as const) {
    expect(text.toLowerCase(), banned).not.toContain(banned.toLowerCase());
  }
  expect(text).not.toMatch(/#\d{3,5}/);
  expect(text).not.toMatch(/claude-code-optimizer/i);
  expect(text).not.toContain('Interaktive Governance-Kugel');
  // Internal registry IDs must not leak into public markup (e.g. provider names in ids).
  expect(roadmap.querySelector('[data-impl-id]')).toBeNull();
  expect(roadmap.innerHTML).not.toContain('governance-sphere-interactive');
  expect(roadmap.innerHTML.toLowerCase()).not.toContain('hostinger');
  // PascalCase component-like identifiers (e.g. FooBarPanel) must not appear.
  expect(text).not.toMatch(/\b[A-Z][a-zA-Z]+(?:Dashboard|Panel|View|Shell|Wizard|Host)\b/);
  // Internal tooling routes must not render as public labels.
  const routes = Array.from(roadmap.querySelectorAll('.rm-card u')).map((u) => u.textContent ?? '');
  expect(routes.some((r) => /optimizer|chatbot|siteos/i.test(r))).toBe(false);
});

it('sends the scan form into /audit with the URL', () => {
  mount();
  fireEvent.change(screen.getByLabelText('Website-URL für Governance-Scan'), { target: { value: 'https://example.com' } });
  fireEvent.click(screen.getByRole('button', { name: /Audit starten/ }));
  expect(screen.getByTestId('where')).toHaveTextContent('/audit?url=https%3A%2F%2Fexample.com');
});
