/**
 * Governance OS Handoff v2 — Login, Preise, Audit-Stepper.
 * Sichert die Zusagen, die vom Prototyp abweichen müssen (echter Score,
 * Jahresabrechnung Coming Soon, Enterprise „Auf Anfrage").
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PricingPage } from '../../src/features/billing/PricingPage';
import { AuditStepper, recommendPlan } from '../../src/components/audit/AuditStepper';
import { resetLangForTests } from '../../src/i18n/useLang';
import { formatPriceEur, planById } from '../../src/config/pricing';
import { BETA } from '../../src/config/beta';

beforeEach(() => {
  localStorage.clear();
  resetLangForTests();
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('/pricing (Handoff v2)', () => {
  const mount = () => render(<MemoryRouter initialEntries={['/pricing']}><PricingPage /></MemoryRouter>);

  it('renders Free Audit + four sellable cards, enterprise on request', () => {
    mount();
    expect(screen.getByTestId('pricing-free-audit')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-testid^="pricing-card-"]')).toHaveLength(4);
    const enterprise = screen.getByTestId('pricing-card-enterprise');
    expect(within(enterprise).getByText('Auf Anfrage')).toBeInTheDocument();
    expect(within(enterprise).getByTestId('pricing-book-enterprise')).toHaveTextContent('Enterprise anfragen');
    expect(document.body.textContent).not.toContain('Gespräch anfragen');
  });

  it('hides the yearly toggle while Stripe yearly prices are unwired', () => {
    mount();
    expect(screen.queryByTestId('pricing-billing-yearly')).not.toBeInTheDocument();
    expect(screen.getByTestId('pricing-yearly-disabled')).toBeInTheDocument();
    const growth = screen.getByTestId('pricing-card-growth');
    // Offene Beta (Default-Build): 0 € plus durchgestrichener Listenpreis.
    expect(within(growth).getByTestId('pricing-list-price-growth')).toHaveTextContent(
      formatPriceEur(planById('growth').price.monthlyEur).replace(/\s+/g, ' '),
    );
    expect(within(growth).getByTestId('pricing-book-growth')).toHaveTextContent('Kostenlos testen');
    expect(within(screen.getByTestId('pricing-card-enterprise')).getByText('Auf Anfrage')).toBeInTheDocument();
  });

  it('keeps nav and plan copy in the same language after toggle', () => {
    mount();
    fireEvent.click(screen.getByTestId('lang-toggle'));
    expect(screen.getByTestId('lang-toggle')).toHaveAttribute('data-lang', 'en');
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    const growth = screen.getByTestId('pricing-card-growth');
    expect(growth).toHaveAttribute('data-lang', 'en');
    expect(within(growth).getByText(/AI governance that monitors itself/i)).toBeInTheDocument();
    expect(within(growth).getByTestId('pricing-book-growth')).toHaveTextContent('Try for free');
    expect(within(screen.getByTestId('pricing-card-enterprise')).getByText('On request')).toBeInTheDocument();
    expect(within(screen.getByTestId('pricing-card-enterprise')).getByTestId('pricing-book-enterprise')).toHaveTextContent(
      'Enterprise inquiry',
    );
  });

  it('shows the VAT note (Regelbesteuerung) and net+gross per tile', () => {
    mount();
    expect(screen.getByTestId('pricing-tax-note')).toHaveTextContent('zzgl. 19 % USt');
    expect(screen.getByTestId('pricing-tax-note')).not.toHaveTextContent('§ 19');
    // Beta-Karten tragen die USt-Zeile im Listenpreis, sonst eigene Zeile.
    const starterVat = BETA.active ? 'pricing-list-price-starter' : 'pricing-vat-starter';
    expect(screen.getByTestId(starterVat)).toHaveTextContent(/94,01/);
  });

  it.runIf(BETA.active)('adds the net/VAT note to every beta text (DE)', () => {
    mount();
    expect(screen.getByTestId('pricing-beta-notice')).toHaveTextContent('Listenpreise (netto zzgl. 19 % USt)');
    expect(screen.getByTestId('pricing-list-price-growth')).toHaveTextContent(/netto zzgl\. 19 % USt · 296,31\s€ brutto/);
    expect(screen.queryByTestId('pricing-vat-growth')).toBeNull();
    expect(screen.getByTestId('pricing-trial-foot')).toHaveTextContent('danach Listenpreis (netto zzgl. 19 % USt)');
    expect(document.body.textContent).not.toContain('§ 19');
  });

  it.runIf(BETA.active)('adds the net/VAT note to every beta text (EN)', () => {
    mount();
    fireEvent.click(screen.getByTestId('lang-toggle'));
    expect(screen.getByTestId('pricing-beta-notice')).toHaveTextContent('list prices shown apply (net, plus 19% VAT)');
    expect(screen.getByTestId('pricing-list-price-growth')).toHaveTextContent(/net, plus 19% VAT · 296,31\s€ gross/);
    expect(screen.getByTestId('pricing-trial-foot')).toHaveTextContent('then list price (net, plus 19% VAT)');
  });
});

describe('/audit stepper', () => {
  it('recommends plans by role, frameworks and systems — never by score', () => {
    expect(recommendPlan('enterprise', [], [])).toBe('enterprise');
    expect(recommendPlan('agency', ['dsgvo'], [])).toBe('agency');
    expect(recommendPlan('self', ['dsgvo', 'nis2'], [])).toBe('growth');
    expect(recommendPlan('team', ['dsgvo'], ['hr'])).toBe('growth');
    expect(recommendPlan('self', ['dsgvo', 'ai_act'], ['chatbot'])).toBe('starter');
  });

  it('runs the real scan callback and shows the score from the report only', () => {
    const onRun = vi.fn();
    const props = { initialDomain: 'muster.de', running: false, error: null, onReset: vi.fn(), onRun };
    const view = render(<MemoryRouter><AuditStepper {...props} report={null} /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ihr KI-Bestand in vier Fragen.');
    expect(screen.getByLabelText('Hauptdomain')).toHaveValue('muster.de');
    fireEvent.change(screen.getByLabelText('E-Mail für den Bericht'), { target: { value: 'a@b.de' } });
    fireEvent.click(screen.getByTestId('audit-next'));
    expect(screen.getByRole('button', { name: /TISAX \/ DORA/ })).toBeDisabled();
    fireEvent.click(screen.getByTestId('audit-next'));
    fireEvent.click(screen.getByTestId('audit-next'));
    fireEvent.click(screen.getByRole('radio', { name: 'Agentur' }));
    fireEvent.click(screen.getByTestId('audit-start'));
    expect(onRun).toHaveBeenCalledWith({ domain: 'muster.de', email: 'a@b.de', company: '', marketingConsent: false });

    view.rerender(
      <MemoryRouter>
        <AuditStepper
          {...props}
          report={{ domain: 'muster.de', score: 63, issues: [{ id: '1', severity: 'critical', title: 'Tracking vor Einwilligung', paragraph_ref: 'Art. 6 DSGVO' }] }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('audit-score-ring')).toHaveAccessibleName(/63 \/ 100/);
    expect(screen.getByText('Tracking vor Einwilligung')).toBeInTheDocument();
    expect(screen.getByTestId('audit-plan-recommendation')).toHaveTextContent('Agency');
  });

  it('AuditLanding still calls gdpr-audit and keeps the ?domain= prefill', () => {
    const src = readFileSync(resolve('src/pages/AuditLanding.tsx'), 'utf8');
    expect(src).toContain("postEdgeFunction<Report>('gdpr-audit'");
    // Vorbelegung läuft über den gemeinsamen Helper (liest `domain` zuerst).
    expect(src).toContain('readAuditPrefill(window.location.search)');
    expect(src).not.toMatch(/92\s*-\s*/);
  });
});

describe('/login', () => {
  it('is its own route and keeps /welcome', () => {
    const app = readFileSync(resolve('src/App.tsx'), 'utf8');
    expect(app).toMatch(/path="\/login" element=\{<LoginPage \/>\}/);
    expect(app).toContain('path="/welcome" element={<Welcome />}');
    const login = readFileSync(resolve('src/pages/LoginPage.tsx'), 'utf8');
    expect(login).toContain('signInWithOtp');
    expect(login).toContain('OAuthProviderButtons');
    const redirects = readFileSync(resolve('public/_redirects'), 'utf8');
    expect(redirects).not.toMatch(/^\/login\s/m);
  });
});
