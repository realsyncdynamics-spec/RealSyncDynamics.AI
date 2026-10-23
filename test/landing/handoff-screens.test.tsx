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
    // Offene Beta: 0 € bis Beta-Ende, Listenpreis nur durchgestrichen als „danach“.
    expect(within(growth).getByText(formatPriceEur(0).replace(/\s+/g, ' '))).toBeInTheDocument();
    expect(within(growth).getByText('kostenlos bis 31. Januar 2027')).toBeInTheDocument();
    const listPrice = within(growth).getByTestId('pricing-list-price-growth');
    expect(listPrice).toHaveTextContent(/^danach/);
    expect(listPrice.querySelector('s')).toHaveTextContent(formatPriceEur(planById('growth').price.monthlyEur).replace(/\s+/g, ' '));
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

  it('shows the statutory VAT note from the company SSOT', () => {
    mount();
    expect(screen.getByTestId('pricing-tax-note')).toHaveTextContent('Angebot nur für Unternehmer (B2B) – alle Preise zzgl. gesetzlicher Umsatzsteuer.');
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

  it('starts the real scan right after step 1 and shows the score from the report only', () => {
    const onRun = vi.fn();
    const onReveal = vi.fn();
    const props = { initialDomain: 'muster.de', running: false, error: null, onReset: vi.fn(), onRun, onReveal };
    const view = render(<MemoryRouter><AuditStepper {...props} report={null} /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ihr KI-Bestand in vier Fragen.');
    expect(screen.getByLabelText('Hauptdomain')).toHaveValue('muster.de');
    fireEvent.change(screen.getByLabelText('E-Mail für den Bericht'), { target: { value: 'a@b.de' } });
    // Lead + Scan gehen nach Schritt 1 an den Server — nicht erst nach vier Fragen.
    expect(screen.getByTestId('audit-start')).toHaveTextContent('Kostenlosen Governance Scan starten');
    fireEvent.click(screen.getByTestId('audit-start'));
    expect(onRun).toHaveBeenCalledTimes(1);
    expect(onRun).toHaveBeenCalledWith({ domain: 'muster.de', email: 'a@b.de', company: '', marketingConsent: false, honeypot: '' });
    expect(screen.getByRole('button', { name: /TISAX \/ DORA/ })).toBeDisabled();
    // Zurück und unverändert erneut absenden löst keinen zweiten Scan aus.
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    fireEvent.click(screen.getByTestId('audit-start'));
    expect(onRun).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('audit-next'));
    fireEvent.click(screen.getByTestId('audit-next'));
    fireEvent.click(screen.getByRole('radio', { name: 'Agentur' }));
    expect(onReveal).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('audit-reveal'));
    expect(onReveal).toHaveBeenCalledTimes(1);
    expect(onRun).toHaveBeenCalledTimes(1);

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

  it('re-runs the scan when the domain changes after going back', () => {
    const onRun = vi.fn();
    render(<MemoryRouter><AuditStepper initialDomain="muster.de" running={false} error={null} report={null} onReset={vi.fn()} onRun={onRun} /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('E-Mail für den Bericht'), { target: { value: 'a@b.de' } });
    fireEvent.click(screen.getByTestId('audit-start'));
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    fireEvent.change(screen.getByLabelText('Hauptdomain'), { target: { value: 'https://www.andere-firma.de/impressum' } });
    fireEvent.click(screen.getByTestId('audit-start'));
    expect(onRun).toHaveBeenCalledTimes(2);
    expect(onRun.mock.calls[1]![0]).toMatchObject({ domain: 'andere-firma.de' });
  });

  it('rejects invalid domains and e-mails before anything is sent', () => {
    const onRun = vi.fn();
    render(<MemoryRouter><AuditStepper initialDomain="" running={false} error={null} report={null} onReset={vi.fn()} onRun={onRun} /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Hauptdomain'), { target: { value: 'localhost' } });
    fireEvent.change(screen.getByLabelText('E-Mail für den Bericht'), { target: { value: 'a@b.de' } });
    expect(screen.getByTestId('audit-start')).toBeDisabled();
    expect(screen.getByText('Bitte eine gültige Domain angeben, z. B. muster.de.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Hauptdomain'), { target: { value: 'muster.de' } });
    fireEvent.change(screen.getByLabelText('E-Mail für den Bericht'), { target: { value: 'kein-at-zeichen' } });
    expect(screen.getByTestId('audit-start')).toBeDisabled();
    expect(onRun).not.toHaveBeenCalled();
  });

  it('shows the privacy notice and keeps the honeypot hidden and out of tab order', () => {
    render(<MemoryRouter><AuditStepper initialDomain="muster.de" running={false} error={null} report={null} onReset={vi.fn()} onRun={vi.fn()} /></MemoryRouter>);
    expect(screen.getByTestId('audit-privacy-notice')).toHaveTextContent(/Domain, E-Mail/);
    expect(screen.getByTestId('audit-privacy-notice')).toHaveTextContent(/Werbliche E-Mails nur mit Ihrer Einwilligung/);
    const hp = document.getElementById('audit-company-website') as HTMLInputElement;
    expect(hp).toBeTruthy();
    expect(hp.tabIndex).toBe(-1);
    expect(hp.closest('[aria-hidden="true"]')).not.toBeNull();
    // Einwilligung ist optional und standardmäßig aus.
    expect(screen.getByTestId('audit-followup-consent')).not.toBeChecked();
  });

  it('is operable on mobile keyboards (input types, autocomplete)', () => {
    render(<MemoryRouter><AuditStepper initialDomain="" running={false} error={null} report={null} onReset={vi.fn()} onRun={vi.fn()} /></MemoryRouter>);
    const domain = screen.getByLabelText('Hauptdomain');
    const email = screen.getByLabelText('E-Mail für den Bericht');
    expect(domain).toHaveAttribute('inputmode', 'url');
    expect(domain).toHaveAttribute('autocomplete', 'url');
    expect(email).toHaveAttribute('type', 'email');
    expect(email).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Unternehmen')).toHaveAttribute('autocomplete', 'organization');
  });

  it('surfaces a scan error while the visitor is still answering', () => {
    const props = { initialDomain: 'muster.de', report: null, onReset: vi.fn(), onRun: vi.fn() };
    const view = render(<MemoryRouter><AuditStepper {...props} running error={null} /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('E-Mail für den Bericht'), { target: { value: 'a@b.de' } });
    fireEvent.click(screen.getByTestId('audit-start'));
    expect(screen.getByTestId('audit-running-background')).toBeInTheDocument();
    view.rerender(<MemoryRouter><AuditStepper {...props} running={false} error="Der Scan konnte nicht abgeschlossen werden. Ihre Angaben sind gespeichert." /></MemoryRouter>);
    expect(screen.getByTestId('audit-error-early')).toHaveTextContent(/Ihre Angaben sind gespeichert/);
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
