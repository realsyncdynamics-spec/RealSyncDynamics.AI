/**
 * Startseite `/` — Vertrag der Governance-OS-Positionierung: Hero, geführte
 * Demonstration, Signature Pipeline, Beispiel-Kennzeichnung, Governance-Check.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DesignGovernanceAiLanding } from '../../src/pages/design/DesignGovernanceAiLanding';
import { resetLangForTests } from '../../src/i18n/useLang';
import {
  AGENT_GOVERNANCE_RUNTIME_SUMMARY,
  AGENT_RUNTIME_BOUNDARY,
  DEMO_LABEL,
  GOVERNANCE_AI_HERO_TEST_SUBSTRING,
  GOVERNANCE_OS_ENTRY_PATH,
  PROVIDER_NEUTRALITY_SUMMARY,
} from '../../src/components/governance-frontend/hero-content';
import { getImplementation, STATUS_LABEL } from '../../src/product/implementation-status';
import { CTA } from '../../src/content/runtimeVocab';

function stubMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: reduce && query.includes('reduce'),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })));
}

beforeEach(() => {
  localStorage.clear();
  resetLangForTests();
  stubMotion(false);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); resetLangForTests(); });
const mount = () => render(<MemoryRouter initialEntries={['/']}><DesignGovernanceAiLanding /></MemoryRouter>);

it('renders the Governance OS hero: category eyebrow, H1, six-stage loop and CTAs', () => {
  const view = mount();
  expect(screen.getByText('REALSYNCDYNAMICS.AI / KONTROLL- UND NACHWEISSCHICHT FÜR KI')).toBeInTheDocument();
  const h1 = screen.getByRole('heading', { level: 1 });
  // E-F3 (2026-09-27): verbindliche H1 — genau dieser Satz, nicht „Governance OS
  // für KI-Agenten". `textContent` fügt die drei Zeilen-Spans ohne Trenner
  // zusammen, deshalb der normalisierte Vergleich auf den ganzen Satz.
  expect((h1.textContent ?? '').replace(/\s+/g, ' ').trim()).toBe(
    'Die Kontrollschicht für KI im Unternehmen.',
  );
  expect(h1.querySelector('.rs-hero__h1-accent')).toHaveTextContent('Unternehmen.');
  // FE-001 prüft `/` über diese Konstante — sie muss in der echten H1 stehen.
  expect(h1.textContent).toContain(GOVERNANCE_AI_HERO_TEST_SUBSTRING);
  expect(
    screen.getByText(
      'RealSyncDynamics.AI macht sichtbar, welche KI-Systeme, Bots und Agenten im Einsatz sind, welche Daten sie nutzen, welche Regeln gelten und welche Nachweise entstehen.',
    ),
  ).toBeInTheDocument();
  // Kein „autonome KI" mehr im Hero — Agenten-Autonomie ist nicht live.
  expect(view.container.querySelector('.rs-hero')!.textContent).not.toMatch(/autonom/i);
  // Regulierung ist nicht die Produktidentität: kein Normen-Badge im Hero.
  expect(screen.queryByText('EU AI Act · DSGVO · ISO 42001')).toBeNull();
  const loop = view.container.querySelector('.rs-loop') as HTMLElement;
  for (const word of ['DISCOVER', 'ASSESS', 'GOVERN', 'EXECUTE', 'VERIFY', 'PROVE']) {
    expect(within(loop).getByText(word)).toBeInTheDocument();
  }
  expect(screen.getByText(AGENT_GOVERNANCE_RUNTIME_SUMMARY.de)).toBeInTheDocument();
  expect(screen.getByText(PROVIDER_NEUTRALITY_SUMMARY.de)).toBeInTheDocument();
  expect(screen.getByText('STACKIT')).toBeInTheDocument();
  expect(screen.getAllByText('Geplant').length).toBeGreaterThan(0);
  expect(
    screen.getByText(/Geplant markiert Optionen, die als Provider-Pfad vorgesehen/),
  ).toBeInTheDocument();

  // Primär-CTA führt in den Scan, nicht in die Demo-Pipeline.
  const primary = view.container.querySelectorAll('[data-hero-cta="audit"]');
  expect(primary).toHaveLength(1);
  expect(primary[0]).toHaveAttribute('href', '/audit');
  expect(primary[0]).toHaveTextContent('Kostenlosen KI-/DSGVO-Scan starten');
  expect(screen.getByTestId('hero-primary-cta')).toBe(primary[0]);

  // Sekundär-CTA = Enterprise. Label aus der CTA-SSoT (einzige kontaktbasierte
  // CTA, runtimeVocab.CTA.enterprise) — kein zweites Kontakt-Label.
  const secondary = screen.getByTestId('hero-secondary-cta');
  expect(secondary).toHaveAttribute('href', '/contact-sales?tier=enterprise&source=home-hero');
  expect(secondary).toHaveTextContent(CTA.enterprise);

  // Der Architektur-Einstieg bleibt erreichbar (jetzt als Textlink).
  expect(screen.getByTestId('hero-architecture-link')).toHaveAttribute('href', '#architecture');
  expect(screen.getByTestId('hero-architecture-link')).toHaveTextContent('Architektur ansehen');
  expect(within(screen.getByTestId('hero-status')).getByText(/eu-central-1/i)).toBeInTheDocument();
});

it('keeps every in-page anchor resolvable', () => {
  const view = mount();
  const anchors = Array.from(view.container.querySelectorAll('a[href^="/#"], a[href^="#"]'));
  expect(anchors.length).toBeGreaterThan(0);
  for (const a of anchors) {
    const id = a.getAttribute('href')!.replace(/^\/?#/, '');
    expect(view.container.querySelector(`#${id}`), id).not.toBeNull();
  }
});

it('shows the AI Governance OS target picture inside the architecture section', () => {
  const view = mount();
  const architecture = view.container.querySelector('#architecture') as HTMLElement;
  const target = screen.getByTestId('governance-os-target');

  // Wiederverwendete Sektion, keine neue Sektion daneben.
  expect(architecture.contains(target)).toBe(true);
  expect(view.container.querySelectorAll('section#architecture')).toHaveLength(1);

  for (const step of ['observe', 'evaluate', 'decide', 'act', 'verify', 'record', 'learn']) {
    expect(screen.getByTestId(`loop-stage-${step}`)).toBeInTheDocument();
  }

  // Genau eine Loop-Stufe trägt einen Statuswert, und zwar Learn = COMING SOON.
  const learn = screen.getByTestId('loop-stage-learn');
  expect(within(learn).getByText(STATUS_LABEL['coming-soon'])).toBeInTheDocument();
  const badgesImLoop = Array.from(
    target.querySelectorAll('[data-testid^="loop-stage-"] .os-status'),
  );
  expect(badgesImLoop).toHaveLength(1);
  expect(badgesImLoop[0]).toHaveTextContent(STATUS_LABEL['coming-soon']);

  expect(screen.getByText(AGENT_RUNTIME_BOUNDARY)).toBeInTheDocument();
});

it('reads every entry-path status from implementation-status, never from landing copy', () => {
  mount();
  const pfad = screen.getByTestId('governance-os-entry-path');
  expect(pfad.children).toHaveLength(GOVERNANCE_OS_ENTRY_PATH.length);

  // Erwartete Reihenfolge laut Brief — Scan live, Core live, Agenten Preview,
  // Agent OS Premium Coming Soon. Der Wert kommt aus der Registry, nicht aus
  // dieser Zeile: fällt ein Status dort, fällt dieser Test.
  const erwartet = ['live', 'live', 'preview', 'coming-soon'] as const;
  GOVERNANCE_OS_ENTRY_PATH.forEach((stage, i) => {
    const item = getImplementation(stage.statusId);
    expect(item, stage.statusId).toBeDefined();
    expect(item!.status, stage.statusId).toBe(erwartet[i]);
    const cell = screen.getByTestId(`entry-stage-${stage.statusId}`);
    expect(within(cell).getByText(stage.label)).toBeInTheDocument();
    expect(within(cell).getByText(STATUS_LABEL[item!.status])).toBeInTheDocument();
  });
});

it('labels demo panels as demo data and keeps the control room free of fake KPIs', () => {
  mount();
  // Guided demo surfaces remain explicitly labeled.
  for (const id of ['system-story-visual', 'pipeline-panel'] as const) {
    expect(within(screen.getByTestId(id)).getByText(DEMO_LABEL)).toBeInTheDocument();
  }

  // Control Room shows capabilities only — no demo label, no fake numbers.
  const room = screen.getByTestId('control-room');
  expect(within(room).queryByText(DEMO_LABEL)).toBeNull();
  expect(within(room).getByText('LIVE NACH LOGIN')).toBeInTheDocument();
  expect(within(room).getByText('Policy Decision Point')).toBeInTheDocument();
  expect(within(room).getByText(/allow · warn · block · require_approval · log_only/)).toBeInTheDocument();
  expect(within(room).getByText('Freigaben')).toBeInTheDocument();
  expect(within(room).getByText('Blockierungen')).toBeInTheDocument();
  expect(within(room).getByText('Evidence')).toBeInTheDocument();
  const roomText = room.textContent ?? '';
  expect(roomText).not.toMatch(/\b12\b/);
  expect(roomText).not.toMatch(/\b184\b/);
  expect(roomText).not.toMatch(/\b1[.\u00a0]?248\b/);
});

it('pipeline pauses at approval until an approver releases it', () => {
  stubMotion(true);
  mount();
  const panel = screen.getByTestId('pipeline-panel');
  expect(within(screen.getByTestId('pipeline-stage-approval')).getByText('REQUIRED · WARTET')).toBeInTheDocument();
  expect(screen.getByTestId('pipeline-stage-execution')).toHaveAttribute('data-state', 'pending');

  fireEvent.click(within(panel).getByRole('button', { name: 'Als Approver freigeben' }));
  expect(within(screen.getByTestId('pipeline-stage-approval')).getByText('APPROVED')).toBeInTheDocument();
  expect(within(screen.getByTestId('pipeline-stage-execution')).getByText('RELEASED')).toBeInTheDocument();
  expect(within(screen.getByTestId('pipeline-stage-evidence')).getByText('RECORDED')).toBeInTheDocument();
});

it('pipeline closes the gate on a policy violation and still records evidence', () => {
  stubMotion(true);
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Policy-Verstoß' }));
  expect(within(screen.getByTestId('pipeline-stage-policy')).getByText('BLOCKED')).toBeInTheDocument();
  expect(within(screen.getByTestId('pipeline-stage-execution')).getByText('NOT EXECUTED')).toBeInTheDocument();
  expect(within(screen.getByTestId('pipeline-stage-evidence')).getByText('RECORDED')).toBeInTheDocument();
});

it('pipeline animates stage by stage without reduced motion', () => {
  vi.useFakeTimers();
  mount();
  expect(screen.getByTestId('pipeline-stage-request')).toHaveAttribute('data-state', 'current');
  act(() => { vi.advanceTimersByTime(480); });
  expect(screen.getByTestId('pipeline-stage-request')).toHaveAttribute('data-state', 'done');
});

it('self-check result counts only the given answers and links to real routes', () => {
  const view = mount();
  const check = view.container.querySelector('#governance-check') as HTMLElement;
  const section = within(check);
  expect(section.getByText(/Beantworten Sie die Fragen/)).toBeInTheDocument();
  fireEvent.click(section.getAllByLabelText('Ja')[0]);
  fireEvent.click(section.getAllByLabelText('Nein')[1]);
  expect(section.getByText('1 von 8 Kontrollen vorhanden')).toBeInTheDocument();
  expect(section.getByText(/2 von 8 beantwortet · 1 offen oder unklar/)).toBeInTheDocument();
  expect(section.getByRole('link', { name: /Governance-Scan starten/ })).toHaveAttribute('href', '/audit');
  expect(section.getByRole('link', { name: 'Enterprise anfragen' })).toHaveAttribute('href', '/contact-sales?tier=enterprise&source=home-check');
});

it('shows Enterprise on request, without a public price', () => {
  const view = mount();
  const pricing = view.container.querySelector('#pricing') as HTMLElement;
  expect(within(pricing).getByText('ENTERPRISE')).toBeInTheDocument();
  expect(within(pricing).getByText('Auf Anfrage')).toBeInTheDocument();
});

it('uses the Europe map v2 with WebP + PNG sources and no colour-mode switch', () => {
  const view = mount();
  const map = screen.getByTestId('hero-map');
  expect(map.querySelectorAll('source[type="image/webp"][srcset="/europe-map-v2.webp"]').length).toBeGreaterThan(0);
  expect(map.querySelectorAll('img[src="/europe-map-v2.png"]').length).toBe(2);
  expect(view.container.querySelector('[data-landing-mode]')).toBeNull();
  expect(screen.queryByRole('radiogroup')).toBeNull();
  expect(screen.queryByText('DUNKEL')).toBeNull();
});

it('switches DE → EN and persists the language', () => {
  const view = mount();
  fireEvent.click(screen.getAllByTestId('lang-toggle')[0]);
  expect(localStorage.getItem('rsd-lang')).toBe('en');
  expect(screen.getByText('REALSYNCDYNAMICS.AI / CONTROL AND EVIDENCE LAYER FOR AI')).toBeInTheDocument();
  expect(screen.getByTestId('hero-primary-cta')).toHaveTextContent('Start the free AI / GDPR scan');
  expect(screen.getByTestId('hero-primary-cta')).toHaveAttribute('id', 'scan-cta');
  expect(screen.getByText(AGENT_GOVERNANCE_RUNTIME_SUMMARY.en)).toBeInTheDocument();
  expect(screen.getByText(PROVIDER_NEUTRALITY_SUMMARY.en)).toBeInTheDocument();
  expect(screen.getByTestId('hero-secondary-cta')).toHaveTextContent('Enterprise inquiry');
  expect(screen.getByTestId('hero-architecture-link')).toHaveTextContent('View the architecture');
  view.unmount();
  mount();
  expect(screen.getAllByTestId('lang-toggle')[0]).toHaveAttribute('data-lang', 'en');
});

it('opens the mobile menu with all screens and closes on Escape', () => {
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Navigation öffnen' }));
  const dialog = screen.getByRole('dialog');
  const menu = within(dialog);
  expect(menu.getByRole('link', { name: 'Preise' })).toHaveAttribute('href', '/#pricing');
  expect(menu.getByRole('link', { name: 'Governance' })).toHaveAttribute('href', '/governance-runtime');
  expect(menu.getByRole('link', { name: /Governance-Scan starten/ })).toHaveAttribute('href', '#pipeline');
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
});
