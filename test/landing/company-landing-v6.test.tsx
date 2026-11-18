/**
 * Unternehmens-Landing v6 (/design/unternehmen-v6, Vorschau) — Vertrag:
 * SSoT-Status, Preise aus shared/pricing.ts, Button-Hierarchie, erlaubte CTAs,
 * Branchen-Auswahl, Anliegen im Kontaktformular.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CompanyLandingV6, MIN_VOICE_EUR } from '../../src/pages/CompanyLandingV6';
import { COMPANY_LINKS, COMPANY_PRODUCTS } from '../../src/components/landing/company/companyProducts';
import { composeCompanyMessage } from '../../src/components/landing/company/CompanyContactForm';
import { PRICING_TAX_NOTE, VOICE_STANDALONE_OFFERS } from '../../shared/pricing';
import { SEO_CONFIG } from '../../src/config/seo';

const root = resolve(__dirname, '../..');
const PATH = '/design/unternehmen-v6';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const mount = () =>
  render(
    <MemoryRouter initialEntries={[PATH]}>
      <Routes>
        <Route path={PATH} element={<CompanyLandingV6 />} />
      </Routes>
    </MemoryRouter>,
  );

describe('Unternehmens-Landing v6 – Routing und SEO', () => {
  it('ist eine Vorschau-Route; / und /unternehmen bleiben unverändert', () => {
    const app = readFileSync(resolve(root, 'src/App.tsx'), 'utf8');
    expect(app).toContain(`path="${PATH}" element={<CompanyLandingV6 />}`);
    expect(app).toMatch(/path="\/"\s+element=\{<LandingV6/);
    expect(app).toContain('path="/unternehmen" element={<CompanyLanding />}');
  });

  it('ist noindex und kanonisch auf /unternehmen', () => {
    const seo = SEO_CONFIG[PATH];
    expect(seo?.noIndex).toBe(true);
    expect(seo?.canonical).toMatch(/\/unternehmen$/);
  });
});

describe('Unternehmens-Landing v6 – Inhalte', () => {
  it('rendert genau eine H1 mit dem Nutzenversprechen', () => {
    const view = mount();
    expect(view.container.querySelectorAll('h1')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('KI im Betrieb');
  });

  it('jede Produktkarte trägt den Status aus der SSoT', () => {
    mount();
    for (const p of COMPANY_PRODUCTS) {
      const card = screen.getByTestId(`product-card-${p.id}`);
      expect(card).toHaveTextContent(p.name);
      expect(card).toHaveTextContent(p.statusLabel);
    }
  });

  it('zeigt die Voice-Preise genau aus shared/pricing.ts', () => {
    mount();
    expect(MIN_VOICE_EUR).toBe(Math.min(...VOICE_STANDALONE_OFFERS.map((o) => o.monthlyEur)));
    for (const o of VOICE_STANDALONE_OFFERS) {
      const card = screen.getByTestId(`voice-offer-${o.id}`);
      expect(card).toHaveTextContent(o.name);
      expect(card).toHaveTextContent(`${o.monthlyEur} €`);
    }
    expect(screen.getByTestId('voice-note')).toHaveTextContent('Telefonie ist in Vorbereitung');
    expect(screen.getByTestId('voice-note')).toHaveTextContent(PRICING_TAX_NOTE);
  });

  it('hält die Preiszahlen nicht hart im Seitenquelltext', () => {
    const src = readFileSync(resolve(root, 'src/pages/CompanyLandingV6.tsx'), 'utf8');
    for (const o of VOICE_STANDALONE_OFFERS) expect(src).not.toMatch(new RegExp(`\\b${o.monthlyEur}\\s?€`));
  });

  it('Hero: ein primärer und ein sekundärer Button, Audit-CTA auch in der Navigation', () => {
    mount();
    const primary = screen.getByTestId('hero-primary-cta');
    expect(primary).toHaveClass('btn-primary');
    expect(primary).toHaveAttribute('href', COMPANY_LINKS.audit);
    expect(screen.getByTestId('hero-secondary-cta')).toHaveClass('btn-secondary');
    expect(screen.getByTestId('nav-audit-cta')).toHaveAttribute('href', COMPANY_LINKS.audit);
    const hero = screen.getByRole('heading', { level: 1 }).closest('section')!;
    expect(hero.querySelectorAll('.btn-primary')).toHaveLength(1);
  });

  it('nutzt keine verbotenen CTA-Begriffe und keine Antwortzeit-Zusage', () => {
    const view = mount();
    const ctas = Array.from(view.container.querySelectorAll('a, button')).map((el) => el.textContent ?? '');
    for (const text of ctas) expect(text).not.toMatch(/\b(Pilot|Demo|Call|Sales|Beratung|Termin)\b/i);
    expect(view.container.textContent).not.toMatch(/Werktag/);
  });

  it('öffnet das Voice-Onboarding im neuen Tab', () => {
    mount();
    const cta = screen.getByTestId('voice-onboarding-cta');
    expect(cta).toHaveAttribute('href', COMPANY_LINKS.voiceOnboarding);
    expect(cta).toHaveAttribute('target', '_blank');
    expect(cta.getAttribute('rel')).toContain('noopener');
  });

  it('Branchen-Auswahl: genau eine aktiv, Schutzstufe für Kanzlei', () => {
    mount();
    const group = screen.getByRole('group', { name: 'Branche wählen' });
    const chips = within(group).getAllByRole('button');
    expect(chips.filter((c) => c.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
    fireEvent.click(within(group).getByRole('button', { name: 'Kanzlei' }));
    expect(within(group).getByRole('button', { name: 'Kanzlei' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('branch-info')).toHaveTextContent('Erhöhte Schutzstufe');
  });
});

describe('Unternehmens-Landing v6 – Kontaktformular', () => {
  it('stellt das Anliegen der Nachricht voran', () => {
    expect(composeCompanyMessage('Kostenloses Audit', ' Hallo ')).toBe('Anliegen: Kostenloses Audit\n\nHallo');
    expect(composeCompanyMessage('Kostenloses Audit', '')).toBe('Anliegen: Kostenloses Audit');
    expect(composeCompanyMessage('', ' Hallo ')).toBe('Hallo');
  });

  it('sendet Anliegen und Herkunftspfad an sales-lead', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    mount();
    fireEvent.change(screen.getByLabelText('Anliegen'), { target: { value: 'Voice Agent Onboarding' } });
    fireEvent.change(screen.getByLabelText('E-Mail'), { target: { value: 'kunde@example.org' } });
    fireEvent.change(screen.getByLabelText('Nachricht'), { target: { value: 'Wir sind eine Werkstatt.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Nachricht senden' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    const call = calls.find(([url]) => String(url).includes('sales-lead'));
    expect(call).toBeDefined();
    const body = JSON.parse(String(call![1].body));
    expect(body.message).toBe('Anliegen: Voice Agent Onboarding\n\nWir sind eine Werkstatt.');
    expect(body.path).toBe(PATH);
    expect(body.source).toBe('company-landing');
    await waitFor(() => expect(screen.getByTestId('contact-note')).toHaveTextContent('Danke'));
  });
});
