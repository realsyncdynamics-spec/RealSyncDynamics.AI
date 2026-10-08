/**
 * Landing v4 „Klassisch" (`/`) — Vertrag: Control-Plane-Hero (DE/EN),
 * 6-Schritt-Journey, Agent-/Provider-Sektionen, CTAs in echte Routen,
 * auflösbare In-Page-Anker, Roadmap-Filter, Scan-Formular.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { LandingV4 } from '../../src/pages/LandingV4';
import { resetLangForTests, setLang } from '../../src/i18n/useLang';

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

const JOURNEY = ['DISCOVER', 'ASSESS', 'GOVERN', 'EXECUTE', 'VERIFY', 'PROVE'] as const;

it('renders the v4 DE hero: Frontier thesis, 6-step journey and CTAs into real routes', () => {
  const view = mount();
  // Default-Sprache DE: These sichtbar, nicht als EN-Zitat versteckt.
  expect(screen.getByTestId('v4-hero-brand')).toHaveTextContent('REALSYNCDYNAMICS.AI');
  screen.getByRole('heading', {
    level: 1,
    name: /Europa braucht kein weiteres Frontier-Modell\.\s*Europa braucht Kontrolle über\s*Frontier-KI\./,
  });
  expect(view.container.querySelectorAll('h1')).toHaveLength(1);
  expect(screen.getByTestId('v4-hero-heading')).toHaveTextContent(/Frontier-KI/);
  expect(screen.getByTestId('v4-hero-heading')).not.toHaveTextContent(/AI Compliance/);

  const loopText = screen.getByTestId('v4-hero-loop').textContent ?? '';
  for (const step of JOURNEY) {
    expect(loopText).toContain(step);
  }
  expect(loopText).not.toContain('Classify');
  expect(loopText).not.toContain('Enforce');

  expect(screen.getByTestId('v4-hero-lede')).toHaveTextContent(
    'RealSyncDynamics.AI ist die Control Plane für Enterprise-KI.',
  );
  expect(screen.getByTestId('v4-hero-lede')).toHaveTextContent('The Governance OS for Autonomous AI');
  expect(screen.getByTestId('v4-hero-lede')).toHaveTextContent('Any model. Any agent. One control plane.');

  expect(view.container.querySelector('#scan')).toHaveAttribute('href', '/audit');
  expect(view.container.querySelector('#scan')).toHaveAttribute('data-hero-cta', '');
  expect(view.container.querySelector('#scan')).toHaveTextContent('Free Governance Audit');
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
  screen.getByRole('heading', {
    level: 1,
    name: /Europe doesn't need another frontier model\.\s*Europe needs control over\s*frontier AI\./,
  });
  expect(screen.getByTestId('v4-hero-heading')).toHaveTextContent(/frontier AI/);
  expect(screen.getByTestId('v4-hero-heading')).not.toHaveTextContent(/Frontier-KI/);
  expect(screen.getByTestId('v4-hero-lede')).toHaveTextContent(
    'RealSyncDynamics.AI is the control plane for enterprise AI.',
  );
  expect(screen.getByTestId('v4-hero-lede')).toHaveTextContent('The Governance OS for Autonomous AI');
  expect(screen.getByTestId('v4-hero-lede')).toHaveTextContent('Any model. Any agent. One control plane.');
  expect(screen.getByTestId('v4-hero-lede')).not.toMatch(/Control Plane für Enterprise-KI/);
});

it('renders the 6-step journey band and platform steps in DE and EN', () => {
  const view = mount();
  const band = screen.getByTestId('v4-journey-band');
  for (const step of JOURNEY) {
    expect(band.textContent).toContain(step);
  }
  expect(band.textContent).toContain('Entdecken, welche KI läuft.');
  expect(band.textContent).toContain('Compliance mit Evidence beweisen.');
  expect(screen.getByTestId('v4-gov-steps').textContent).toContain('Risiko bewerten.');

  fireEvent.click(screen.getByTestId('lang-toggle'));
  expect(screen.getByTestId('lang-toggle')).toHaveAttribute('data-lang', 'en');
  expect(screen.getByTestId('v4-journey-band').textContent).toContain('Discover what AI is running.');
  expect(screen.getByTestId('v4-journey-band').textContent).toContain('Prove compliance with evidence.');
  expect(screen.getByTestId('v4-gov-steps').textContent).toContain('Assess its risk.');
  expect(view.container.textContent).not.toMatch(/SCAN\s*→\s*BUILD/);
});

it('renders Agent Governance Runtime and provider-neutrality sections in DE and EN', () => {
  mount();
  const agent = screen.getByTestId('v4-agent-runtime');
  expect(agent.textContent).toMatch(/AGENT GOVERNANCE RUNTIME/i);
  expect(agent.textContent).toContain('Werkzeugzugriffe');
  expect(agent.textContent).toContain('Security-Agent');
  expect(screen.getByTestId('v4-architecture-flow').textContent).toMatch(
    /User\/Agent.*Identity.*Tenant.*Policy.*Risk.*Approval.*Execution.*Verification.*Evidence/,
  );

  const providers = screen.getByTestId('v4-provider-neutrality');
  expect(providers.textContent).toContain('Any model. Any agent.');
  expect(providers.textContent).toContain('One control plane.');
  for (const name of ['OpenAI', 'Anthropic', 'Gemini', 'Mistral', 'STACKIT', 'Local models', 'Future models']) {
    expect(screen.getByTestId('v4-provider-list').textContent).toContain(name);
  }
  expect(providers.textContent).not.toMatch(/Partner|zertifiziert|certified partner/i);

  fireEvent.click(screen.getByTestId('lang-toggle'));
  expect(screen.getByTestId('v4-agent-runtime').textContent).toContain('Tool access');
  expect(screen.getByTestId('v4-agent-runtime').textContent).toContain('security agent');
  expect(screen.getByTestId('v4-provider-neutrality').textContent).toContain('under the same governance layer');
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
  expect(groups()).toEqual(['LIVE', 'IN PREVIEW', 'NEXT']);
  fireEvent.click(screen.getByRole('button', { name: 'IN PREVIEW' }));
  expect(groups()).toEqual(['IN PREVIEW']);
  expect(screen.getByRole('button', { name: 'IN PREVIEW' })).toHaveAttribute('aria-pressed', 'true');
});

it('roadmap comes from the registry and omits redirect-only design landings', () => {
  const view = mount();
  const roadmap = view.container.querySelector('#roadmap')!;
  expect(roadmap.textContent).toContain('Product-Registry');
  expect(roadmap.textContent).toContain('Compliance Command Center');
  expect(roadmap.textContent).toContain('CommandCenterDashboard');
  expect(roadmap.textContent).toContain('/ai-act-klassifikator');
  expect(roadmap.textContent).toContain('EU-AI-Act-Inventar (Persistenz)');
  expect(roadmap.textContent).toMatch(/kein Upgrade|keinem Plan/i);
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

it('sends the scan form into /audit with the URL', () => {
  mount();
  fireEvent.change(screen.getByLabelText('Website-URL für Governance-Scan'), { target: { value: 'https://example.com' } });
  fireEvent.click(screen.getByRole('button', { name: /Audit starten/ }));
  expect(screen.getByTestId('where')).toHaveTextContent('/audit?url=https%3A%2F%2Fexample.com');
});
