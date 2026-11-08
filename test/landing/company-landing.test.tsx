/**
 * Unternehmens-Landing v5 (/unternehmen) — Vertrag: SSoT-Status, Hero-Tafeln,
 * Produkt-Dialog (Tabs, Seiten, Tastatur, Fokus), Demos, Kontaktformular.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CompanyLanding } from '../../src/pages/CompanyLanding';
import { COMPANY_LINKS, COMPANY_PRODUCTS, voiceAddonOffer } from '../../src/components/landing/company/companyProducts';
import { PAGE_DIALOG_ATTR } from '../../src/config/pageDialog';
import { COMPANY } from '../../src/config/company';
import { ADDONS, formatNetVatGrossEur, pricingTaxNote } from '../../shared/pricing';
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

  it('Pakete-Seite zeigt den Voice-Add-on-Preis und den Steuerhinweis aus der SSoT', () => {
    mount();
    fireEvent.click(screen.getByTestId('product-tile-voice'));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Pakete' }));
    const addon = ADDONS.find((a) => a.id === 'voice')!;
    expect(within(dialog).getByTestId('voice-addon-price')).toHaveTextContent(formatNetVatGrossEur(addon.priceEur, COMPANY.taxMode));
    expect(within(dialog).getByTestId('voice-addon-price')).toHaveTextContent(addon.priceNote);
    expect(within(dialog).getByTestId('voice-addon-tax')).toHaveTextContent(pricingTaxNote(COMPANY.taxMode));
    expect(dialog.textContent).not.toMatch(/\b(89|199|349)\s?€/);
  });

  it('bei § 19 UStG (EXEMPT) wird keine USt ausgewiesen', () => {
    const offer = voiceAddonOffer('EXEMPT')!;
    expect(offer.price).not.toMatch(/USt|netto|brutto/);
    expect(offer.taxNote).toMatch(/§ 19 UStG/);
    const standard = voiceAddonOffer('EU_STANDARD')!;
    expect(standard.price).toMatch(/zzgl\. 19 % USt/);
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
    // Telefonie ist Coming Soon: Statusleiste und Tafel versprechen keine laufende Telefonannahme.
    expect(screen.getByLabelText('Status')).toHaveTextContent('VOICE AGENT · TELEFONANNAHME IN VORBEREITUNG');
    expect(screen.getByTestId('product-tile-voice')).toHaveTextContent('Telefonannahme in Vorbereitung');
    expect(view.container.textContent).not.toMatch(/Kein Anruf geht verloren|nimmt Anrufe an|Telefon erreichbar/);
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

    expect(document.body.hasAttribute(PAGE_DIALOG_ATTR)).toBe(true);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
    expect(document.body.hasAttribute(PAGE_DIALOG_ATTR)).toBe(false);
    await waitFor(() => expect(document.activeElement).toBe(tile));
  });

  it('Pfeiltasten im Voice-Onboarding wechseln den Schritt, nicht die Dialogseite', () => {
    mount();
    fireEvent.click(screen.getByTestId('product-tile-voice'));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Einrichten' }));
    expect(within(dialog).getByText('5 / 5')).toBeInTheDocument();

    const steps = within(within(dialog).getByRole('tablist', { name: 'Einrichtung' })).getAllByRole('tab');
    fireEvent.keyDown(steps[0], { key: 'ArrowRight' });
    expect(steps[1]).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(steps[1]);
    fireEvent.keyDown(steps[1], { key: 'ArrowLeft' });
    expect(steps[0]).toHaveAttribute('aria-selected', 'true');

    // Auch auf Branchen-Knöpfen blättert ← nicht zurück auf „Anruf testen“.
    fireEvent.keyDown(within(dialog).getByRole('button', { name: 'Metzgerei' }), { key: 'ArrowLeft' });
    expect(within(dialog).getByText('5 / 5')).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Welche Branche?' })).toBeInTheDocument();
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
