/**
 * Unternehmens-Landing v5 (/unternehmen) — Vertrag: SSoT-Status, Hero-Tafeln,
 * Produkt-Dialog (Tabs, Seiten, Tastatur, Fokus), Demos, Kontaktformular.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CompanyLanding } from '../../src/pages/CompanyLanding';
import {
  COMPANY_LINKS,
  COMPANY_PRODUCTS,
  COMPANY_TAX_NOTE,
  VOICE_TELEPHONY_NOTE,
  VOICE_TELEPHONY_STATUS,
} from '../../src/components/landing/company/companyProducts';
import { validateCompanyContact } from '../../src/components/landing/company/CompanyContactForm';
import { DEMO_EVIDENCE_NOTE } from '../../src/components/landing/company/CompanyDemos';
import { ASSISTANT_SUPPRESS_ATTR } from '../../src/components/assistantSuppression';
import { getImplementation, STATUS_LABEL } from '../../src/product/implementation-status';
import { PRICING_TAX_MODE, pricingTaxNote } from '../../shared/pricing';
import { getSeoForPath } from '../../src/config/seo';

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
    expect(screen.getByLabelText('Status')).toHaveTextContent('VOICE AGENT · TELEFONANNAHME IN VORBEREITUNG');
  });

  it('Voice-Texte folgen dem Status coming-soon der Telefonie (P1-3)', () => {
    expect(VOICE_TELEPHONY_STATUS).toBe(getImplementation('voice-telephony')!.status);
    expect(VOICE_TELEPHONY_NOTE).toBe('Telefonannahme in Vorbereitung');
    mount();
    const tile = screen.getByTestId('product-tile-voice');
    expect(tile).toHaveTextContent('Telefonannahme in Vorbereitung');
    expect(tile).not.toHaveTextContent('Nimmt Anrufe an');
    fireEvent.click(tile);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Preview · Telefonannahme in Vorbereitung');
    expect(dialog).not.toHaveTextContent('Der Voice Agent geht ans Telefon');
  });

  it('Metadaten (auch og:/twitter:description) sagen keine Telefonannahme zu (P1-3)', () => {
    const { description } = getSeoForPath('/unternehmen');
    expect(description).toContain(VOICE_TELEPHONY_NOTE);
    expect(description).not.toMatch(/nimmt Anrufe an/i);
    expect(description.length).toBeLessThanOrEqual(160);
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

  it('„Prüfung ausprobieren“ öffnet direkt die Governance-Demo und liefert ein Ergebnis', () => {
    vi.useFakeTimers();
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Prüfung ausprobieren' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Prüfung ausprobieren' })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Kundendaten exportieren' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Prüfung starten' }));
    act(() => {
      vi.advanceTimersByTime(3400);
    });
    expect(within(dialog).getByRole('status')).toHaveTextContent('Blockiert – keine Einwilligung für Export.');
    expect(within(dialog).getByText(DEMO_EVIDENCE_NOTE)).toBeInTheDocument();
    expect(within(dialog).queryByText(/SHA-256 [0-9a-f]+/)).toBeNull();
  });

  it('Voice zeigt genau einen sechs Schritte umfassenden Einstieg statt eines Mini-Konfigurators', () => {
    mount();
    fireEvent.click(screen.getByTestId('product-tile-voice'));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Einrichten' }));
    const preview = within(dialog).getByTestId('voice-onboarding-entry');
    expect(within(preview).getByRole('list', { name: 'Sechs Schritte der Voice-Agent-Einrichtung' }).querySelectorAll('li')).toHaveLength(6);
    expect(preview.querySelector('input, select, textarea')).toBeNull();
    expect(preview).toHaveTextContent('Telefonie, Live-Anrufannahme und Checkout werden dadurch nicht aktiviert');
    const link = within(preview).getByRole('link', { name: 'Zum vollständigen 6-Schritte-Onboarding' });
    expect(link).toHaveAttribute('href', COMPANY_LINKS.voiceOnboarding);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('blendet den seitenweiten Assistenten-Chip aus, solange der Dialog offen ist (P1-1)', () => {
    mount();
    expect(document.body.hasAttribute(ASSISTANT_SUPPRESS_ATTR)).toBe(false);
    fireEvent.click(screen.getByTestId('product-tile-builder'));
    expect(document.body.hasAttribute(ASSISTANT_SUPPRESS_ATTR)).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.hasAttribute(ASSISTANT_SUPPRESS_ATTR)).toBe(false);
  });

  it('Pfeiltasten im Voice-Onboarding blättern die Dialogseite nicht (P2)', () => {
    mount();
    fireEvent.click(screen.getByTestId('product-tile-voice'));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Einrichten' }));
    expect(within(dialog).getByText('5 / 5')).toBeInTheDocument();
    const preview = within(dialog).getByTestId('voice-onboarding-entry');
    fireEvent.keyDown(within(preview).getByText('Branche auswählen'), { key: 'ArrowLeft' });
    fireEvent.keyDown(within(preview).getByRole('link', { name: 'Zum vollständigen 6-Schritte-Onboarding' }), { key: 'ArrowLeft' });
    expect(within(dialog).getByText('5 / 5')).toBeInTheDocument();
    // Außerhalb des Onboardings blättern die Pfeile weiter.
    fireEvent.keyDown(screen.getByTestId('pm-page').querySelector('h3')!, { key: 'ArrowLeft' });
    expect(within(dialog).getByText('4 / 5')).toBeInTheDocument();
  });

  it('Fokus bleibt im Dialog, wenn „Weiter“ auf der letzten Seite deaktiviert wird', () => {
    mount();
    fireEvent.click(screen.getByTestId('product-tile-builder'));
    const dialog = screen.getByRole('dialog');
    const weiter = within(dialog).getByRole('button', { name: 'Weiter →' });
    const total = Number(within(dialog).getByText(/^1 \/ \d+$/).textContent!.split('/')[1]);
    weiter.focus();
    for (let i = 1; i < total; i++) fireEvent.click(weiter);
    expect(weiter).toBeDisabled();
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '← Zurück' }));

    // Fokus auf <body> (z. B. nach Klick auf Text): Tab holt ihn in den Dialog zurück.
    (document.activeElement as HTMLElement).blur();
    expect(document.activeElement).toBe(document.body);
    fireEvent.keyDown(document.body, { key: 'Tab' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    (document.activeElement as HTMLElement).blur();
    fireEvent.keyDown(document.body, { key: 'Tab', shiftKey: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('Paket-Seite: keine Beträge, Steuerhinweis aus der SSoT (P1-4)', () => {
    mount();
    fireEvent.click(screen.getByTestId('product-tile-voice'));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Pakete' }));
    const page = screen.getByTestId('pm-page');
    expect(within(page).getByTestId('voice-tax-note')).toHaveTextContent(pricingTaxNote(PRICING_TAX_MODE));
    expect(COMPANY_TAX_NOTE).toBe(pricingTaxNote(PRICING_TAX_MODE));
    expect(page.textContent).not.toMatch(/\d\s?€/);
    expect(page.textContent).not.toMatch(/brutto|\d+\s?% USt/i);
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
