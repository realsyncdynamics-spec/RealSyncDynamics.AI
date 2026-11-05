/**
 * Unternehmens-Landing v5 (/unternehmen) — Vertrag: SSoT-Status, Hero-Tafeln,
 * Produkt-Dialog (Tabs, Seiten, Tastatur, Fokus), Demos, Kontaktformular,
 * Produktfarben/Legende/Produkte-Menü und Deep-Links (#voice-agent, #sites).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { CompanyLanding } from '../../src/pages/CompanyLanding';
import { COMPANY_LINKS, COMPANY_PRODUCTS, dialogTabForHash } from '../../src/components/landing/company/companyProducts';
import { validateCompanyContact } from '../../src/components/landing/company/CompanyContactForm';
import { getImplementation, STATUS_LABEL } from '../../src/product/implementation-status';

// Die 3D-Szene braucht WebGL; im DOM-Test genügt, dass sie nicht mountet.
vi.mock('../../src/components/landing/company/spaceSceneV5', () => ({ mountSpaceScene: () => () => {} }));

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.style.overflow = '';
});

const mount = () =>
  render(
    <MemoryRouter initialEntries={['/unternehmen']}>
      <Routes>
        <Route path="/unternehmen" element={<CompanyLanding />} />
      </Routes>
    </MemoryRouter>,
  );

describe('Unternehmens-Landing v5 – Status aus der SSoT', () => {
  it('jede Tafel trägt den Status ihres implementation-status-Eintrags', () => {
    for (const p of COMPANY_PRODUCTS) {
      const item = getImplementation(p.ssotId);
      expect(item, p.ssotId).toBeDefined();
      expect(p.status).toBe(item!.status);
      expect(p.statusLabel).toBe(STATUS_LABEL[item!.status]);
    }
  });

  it('Voice zeigt das Onboarding (Preview), die Telefonie bleibt Coming Soon', () => {
    const voice = COMPANY_PRODUCTS.find((p) => p.id === 'voice')!;
    expect(voice.ssotId).toBe('voice-agent-onboarding');
    expect(voice.status).toBe('preview');
    expect(getImplementation('voice-telephony')?.status).toBe('coming-soon');
    expect(COMPANY_LINKS.voiceOnboarding).toBe('https://voice.realsyncdynamicsai.de/onboarding.html');
  });

  it('nennt keine Voice-Preise außerhalb von shared/pricing.ts', () => {
    const view = mount();
    expect(view.container.textContent).not.toMatch(/\b(89|199|349)\s?€/);
  });
});

describe('Unternehmens-Landing v5 – Seite', () => {
  it('rendert H1, Statusleiste und die drei Tafeln mit SSoT-Tags', () => {
    const view = mount();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('RealSync Dynamics & AI');
    expect(view.container.querySelectorAll('h1')).toHaveLength(1);
    for (const p of COMPANY_PRODUCTS) {
      const tile = screen.getByTestId(`product-tile-${p.id}`);
      expect(tile).toHaveTextContent(p.name);
      expect(tile).toHaveTextContent(p.statusLabel);
    }
    expect(screen.getByLabelText('Status')).toHaveTextContent(`VOICE AGENT · ${STATUS_LABEL.preview}`);
  });

  it('verlinkt interne Ziele relativ und das Voice-Onboarding im neuen Tab', () => {
    const view = mount();
    const legal = screen.getByRole('navigation', { name: 'Rechtliches' });
    for (const [name, href] of [
      ['Impressum', '/impressum'],
      ['Datenschutz', '/datenschutz'],
      ['AGB', '/agb'],
      ['Widerruf', '/widerruf'],
      ['AVV', '/legal/avv'],
      ['Sub-Prozessoren', '/legal/sub-processors'],
    ] as const) {
      expect(within(legal).getByRole('link', { name })).toHaveAttribute('href', href);
    }
    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
    const gos = view.container.querySelector('#p-os')!;
    expect(within(gos as HTMLElement).getByRole('link', { name: 'Free Audit starten' })).toHaveAttribute('href', '/audit');
    expect(within(gos as HTMLElement).getByRole('link', { name: 'Zur Plattform' })).toHaveAttribute('href', '/demo-tour/dashboard');
  });

  it('Governance-Tafel ist ein Anker auf #p-os, die anderen öffnen den Dialog', () => {
    mount();
    expect(screen.getByTestId('product-tile-governance')).toHaveAttribute('href', '#p-os');
    expect(screen.getByTestId('product-tile-voice')).toHaveAttribute('aria-haspopup', 'dialog');
    expect(screen.getByTestId('product-tile-builder')).toHaveAttribute('aria-haspopup', 'dialog');
  });
});

describe('Unternehmens-Landing v5 – Produkt-Dialog', () => {
  it('öffnet per Tafel, Pfeile wechseln Produkt bzw. Seite, Esc schließt, Fokus kehrt zurück', async () => {
    mount();
    const tile = screen.getByTestId('product-tile-voice');
    tile.focus();
    fireEvent.click(tile);

    const dialog = screen.getByRole('dialog', { name: 'Produkte im Detail' });
    const productTabs = within(within(dialog).getByRole('tablist', { name: 'Produkte' })).getAllByRole('tab');
    expect(productTabs).toHaveLength(3);
    expect(productTabs[1]).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(productTabs[1]);
    expect(document.body.style.overflow).toBe('hidden');

    // Pfeil in der Produkt-Leiste → nächstes Produkt
    fireEvent.keyDown(productTabs[1], { key: 'ArrowRight' });
    expect(productTabs[2]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(productTabs[2], { key: 'ArrowLeft' });
    expect(productTabs[1]).toHaveAttribute('aria-selected', 'true');

    // Pfeil im Inhalt → nächste Seite
    expect(within(dialog).getByText('1 / 5')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByTestId('pm-page'), { key: 'ArrowRight' });
    expect(within(dialog).getByText('2 / 5')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
    await waitFor(() => expect(document.activeElement).toBe(tile));
  });

  it('„Prüfung live testen“ öffnet direkt die Governance-Demo und liefert ein Ergebnis', () => {
    vi.useFakeTimers();
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Prüfung live testen' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Prüfung live erleben' })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Kundendaten exportieren' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Prüfung starten' }));
    act(() => {
      vi.advanceTimersByTime(3400);
    });
    expect(within(dialog).getByRole('status')).toHaveTextContent('Blockiert – keine Einwilligung für Export.');
    expect(within(dialog).getByText(/^EVIDENCE · SHA-256 [0-9a-f]{16}…$/)).toBeInTheDocument();
  });

  it('Voice-Onboarding endet im Link auf die Subdomain (neuer Tab)', () => {
    mount();
    fireEvent.click(screen.getByTestId('product-tile-voice'));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Einrichten' }));
    fireEvent.click(within(dialog).getByRole('tab', { name: /Freigabe/ }));
    const link = within(dialog).getByRole('link', { name: 'Onboarding fortsetzen' });
    expect(link).toHaveAttribute('href', COMPANY_LINKS.voiceOnboarding);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('Vorlage anfragen schließt den Dialog und belegt die Nachricht vor', () => {
    mount();
    fireEvent.click(screen.getByTestId('product-tile-builder'));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Vorlagen' }));
    fireEvent.click(within(dialog).getByRole('button', { name: /Handwerk/ }));
    fireEvent.click(within(dialog).getByRole('link', { name: 'Vorlage „Handwerk“ anfragen' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Nachricht')).toHaveValue('Ich interessiere mich für die Landingpage-Vorlage „Handwerk“.');
  });
});

describe('Unternehmens-Landing v5 – Kontaktformular', () => {
  it('verlangt eine gültige E-Mail, die Nachricht ist optional', () => {
    expect(validateCompanyContact({ name: '', email: 'x', company: '', message: '' }).email).toBeDefined();
    expect(validateCompanyContact({ name: 'A', email: 'kontakt@beispiel.de', company: '', message: '' })).toEqual({});
    expect(validateCompanyContact({ name: '', email: 'kontakt@beispiel.de', company: '', message: 'x'.repeat(4001) }).message).toBeDefined();
  });

  it('sendet ohne gültige E-Mail nichts und zeigt den Hinweis', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Nachricht senden' }));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('contact-note')).toHaveTextContent('Bitte eine gültige E-Mail-Adresse angeben.');
    expect(screen.getByLabelText('E-Mail')).toHaveAttribute('aria-invalid', 'true');
  });
});

/** Zeigt Pfad+Hash und navigiert im Verlauf (Zurück/Vorwärts wie im Browser). */
function HistoryProbe() {
  const loc = useLocation();
  const nav = useNavigate();
  return (
    <>
      <output data-testid="loc">{loc.pathname + loc.hash}</output>
      <button type="button" data-testid="go-back" onClick={() => nav(-1)}>
        zurück
      </button>
      <button type="button" data-testid="go-forward" onClick={() => nav(1)}>
        vor
      </button>
    </>
  );
}

const mountAt = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path="/unternehmen"
          element={
            <>
              <CompanyLanding />
              <HistoryProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

const productTabs = () =>
  within(within(screen.getByRole('dialog', { name: 'Produkte im Detail' })).getByRole('tablist', { name: 'Produkte' })).getAllByRole('tab');

describe('Unternehmens-Landing v5 – Produktfarben', () => {
  it('legt die Produktfarben als Tokens an (Gold, Blau, Pink) und trennt Status davon', () => {
    const css = readFileSync(join(__dirname, '../../src/components/landing/company/company-landing-v5.css'), 'utf8');
    expect(css).toMatch(/--product-governance:\s*#ffb347/i);
    expect(css).toMatch(/--product-voice:\s*#5b8dff/i);
    expect(css).toMatch(/--product-sites:\s*#ff4f81/i);
    expect(css).toMatch(/--status-live:/);
    expect(css).toMatch(/--status-preview:/);
    expect(COMPANY_PRODUCTS.map((p) => [p.id, p.accentVar, p.colorName])).toEqual([
      ['governance', '--product-governance', 'Gold'],
      ['voice', '--product-voice', 'Blau'],
      ['builder', '--product-sites', 'Pink'],
    ]);
  });

  it('Kacheln tragen Produkt, Anker und ein Status-Symbol passend zur SSoT', () => {
    mount();
    for (const p of COMPANY_PRODUCTS) {
      const tile = screen.getByTestId(`product-tile-${p.id}`);
      expect(tile).toHaveAttribute('data-product', p.id);
      const tag = tile.querySelector('.tag')!;
      expect(tag).toHaveClass(`st-${p.status}`);
      expect(tag.querySelector(`.sdot.st-${p.status}`)).not.toBeNull();
      expect(tag).toHaveTextContent(p.statusLabel);
    }
    expect(screen.getByTestId('product-tile-voice')).toHaveAttribute('id', 'voice-agent');
    expect(screen.getByTestId('product-tile-builder')).toHaveAttribute('id', 'sites');
  });

  it('zeigt die Legende über den Kacheln im Bereich #produkte', () => {
    const view = mount();
    const zone = view.container.querySelector('#produkte')!;
    const legend = within(zone as HTMLElement).getByTestId('product-legend');
    expect(legend).toHaveTextContent(
      'Unsere drei Produkte – farblich gekennzeichnet: Gold = Governance OS · Blau = Voice Agent · Pink = Landingpage Builder',
    );
    expect(legend.compareDocumentPosition(screen.getByTestId('product-tile-governance')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('vergibt keine ID doppelt – auch nicht mit offenem Dialog', () => {
    mountAt('/unternehmen#sites');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const ids = Array.from(document.querySelectorAll('[id]')).map((e) => e.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });
});

describe('Unternehmens-Landing v5 – Produkte-Menü', () => {
  it('klappt drei verlinkbare Produkte auf; Esc schließt und fokussiert den Button', () => {
    mountAt('/unternehmen');
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' });
    const btn = within(nav).getByRole('button', { name: /Produkte/ });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    // Kein separater Nav-Eintrag „Governance OS“ mehr (E4) – nur im Menü.
    expect(within(nav).queryByRole('link', { name: /Governance OS/ })).toBeNull();

    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    const menu = document.getElementById('nav-produkte-menu')!;
    const links = within(menu).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Governance OSGold', 'Voice AgentBlau', 'Landingpage BuilderPink']);
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['#p-os', '/unternehmen#voice-agent', '/unternehmen#sites']);
    expect(links.map((l) => l.closest('[data-product]')?.getAttribute('data-product'))).toEqual(['governance', 'voice', 'builder']);

    fireEvent.keyDown(links[1], { key: 'Escape' });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(btn);
  });

  it('Menüeintrag öffnet den Dialog über den Hash; Zurück schließt, Vorwärts öffnet wieder', () => {
    mountAt('/unternehmen');
    fireEvent.click(screen.getByRole('button', { name: /Produkte/ }));
    fireEvent.click(within(document.getElementById('nav-produkte-menu')!).getByRole('link', { name: /Voice Agent/ }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/unternehmen#voice-agent');
    expect(productTabs()[1]).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(screen.getByTestId('go-back'));
    expect(screen.getByTestId('loc')).toHaveTextContent(/^\/unternehmen$/);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('go-forward'));
    expect(screen.getByTestId('loc')).toHaveTextContent('/unternehmen#voice-agent');
    expect(productTabs()[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('Esc nach Menü-Aufruf geht im Verlauf zurück (kein Hash bleibt stehen)', () => {
    mountAt('/unternehmen');
    fireEvent.click(screen.getByRole('button', { name: /Produkte/ }));
    fireEvent.click(within(document.getElementById('nav-produkte-menu')!).getByRole('link', { name: /Landingpage Builder/ }));
    expect(productTabs()[2]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('loc')).toHaveTextContent(/^\/unternehmen$/);
  });
});

describe('Unternehmens-Landing v5 – Deep-Links', () => {
  it('ordnet nur Voice und Builder einem Dialog-Tab zu', () => {
    expect(dialogTabForHash('#voice-agent')).toBe(1);
    expect(dialogTabForHash('#sites')).toBe(2);
    expect(dialogTabForHash('#p-os')).toBe(-1);
    expect(dialogTabForHash('')).toBe(-1);
    expect(dialogTabForHash('#kontakt')).toBe(-1);
  });

  it.each([
    ['#voice-agent', 1],
    ['#sites', 2],
  ] as const)('Direktaufruf %s öffnet den Dialog auf Tab %i', (hash, tab) => {
    mountAt(`/unternehmen${hash}`);
    expect(productTabs()[tab]).toHaveAttribute('aria-selected', 'true');
  });

  it('Schließen nach Direktaufruf entfernt den Hash per replace (Neuladen öffnet nicht erneut)', () => {
    mountAt('/unternehmen#voice-agent');
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('loc')).toHaveTextContent(/^\/unternehmen$/);
  });

  it('#p-os öffnet keinen Dialog', () => {
    mountAt('/unternehmen#p-os');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

