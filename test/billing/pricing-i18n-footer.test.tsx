/**
 * /pricing: Fusszeile und Disclaimer folgen der aktiven Sprache.
 * Steuerhinweis (§ 19 / Regelbesteuerung) bleibt bewusst unberührt (#1748).
 */
import { afterEach, beforeEach, expect, it, onTestFinished, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PricingPage } from '../../src/features/billing/PricingPage';
import { resetLangForTests } from '../../src/i18n/useLang';

beforeEach(() => {
  localStorage.clear();
  resetLangForTests();
  Element.prototype.scrollIntoView = () => {};
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetLangForTests();
});

const mount = () =>
  render(
    <MemoryRouter initialEntries={['/pricing']}>
      <PricingPage />
    </MemoryRouter>,
  );

// Default-Build = offene Beta (VITE_BETA_PHASE nicht gesetzt): Fusszeile
// spricht von der Beta statt vom 14-Tage-Trial.
it('keeps German footer and disclaimer under DE', () => {
  mount();
  expect(screen.getByTestId('pricing-trust-note')).toHaveTextContent(
    /Free Audit kostenlos · Beta kostenlos bis 31. Januar 2027/,
  );
  expect(screen.getByTestId('pricing-trial-foot')).toHaveTextContent(/kein Account nötig/);
  expect(screen.getByTestId('pricing-trial-foot')).toHaveTextContent(
    /Starter, Growth und Agency: kostenlos bis 31. Januar 2027/,
  );
  expect(screen.getByTestId('pricing-trial-foot')).not.toHaveTextContent(/14 Tage/);
  expect(screen.getByTestId('pricing-disclaimer')).toHaveTextContent(
    /Unsere Outputs sind methodisch und technisch fundiert/,
  );
  expect(screen.getByTestId('pricing-disclaimer')).toHaveTextContent(/100 % rechtssicher/);
});

it('renders English footer and disclaimer under EN', () => {
  mount();
  fireEvent.click(screen.getByTestId('lang-toggle'));
  expect(screen.getByTestId('lang-toggle')).toHaveAttribute('data-lang', 'en');

  expect(screen.getByTestId('pricing-trust-note')).toHaveTextContent(
    /Free Audit free of charge · Beta free until 31 January 2027/,
  );
  expect(screen.getByTestId('pricing-trust-note')).not.toHaveTextContent(/kostenlos/);

  expect(screen.getByTestId('pricing-trial-foot')).toHaveTextContent(/no account needed/);
  expect(screen.getByTestId('pricing-trial-foot')).toHaveTextContent(/free until 31 January 2027/);
  expect(screen.getByTestId('pricing-trial-foot')).toHaveTextContent(/and/);
  expect(screen.getByTestId('pricing-trial-foot')).not.toHaveTextContent(/kein Account nötig/);

  expect(screen.getByTestId('pricing-disclaimer')).toHaveTextContent(
    /Our outputs are methodologically and technically sound/,
  );
  expect(screen.getByTestId('pricing-disclaimer')).toHaveTextContent(/100% legally secure/);
  expect(screen.getByTestId('pricing-disclaimer')).not.toHaveTextContent(/Unsere Outputs/);
});

it('shows the beta notice and sends self-service plans to the beta signup, not to checkout', () => {
  // jsdom navigiert nicht — href-Zuweisung wird ersetzt und beobachtet
  // (Muster aus test/consent-pixels.test.ts).
  const assign = vi.fn();
  const realLocation = window.location;
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...realLocation, set href(v: string) { assign(v); } },
  });
  onTestFinished(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
  });
  mount();
  expect(screen.getByTestId('pricing-beta-notice')).toHaveTextContent(/Offene Beta/);
  expect(screen.getByTestId('pricing-beta-notice')).toHaveTextContent(/Enterprise bleibt auf Anfrage/);

  const growth = screen.getByTestId('pricing-card-growth');
  expect(growth).toHaveTextContent(/kostenlos bis 31. Januar 2027/);
  expect(screen.getByTestId('pricing-list-price-growth')).toHaveTextContent(/Listenpreis/);
  expect(screen.getByTestId('pricing-book-growth')).toHaveTextContent('Kostenlos testen');
  fireEvent.click(screen.getByTestId('pricing-book-growth'));
  expect(assign).toHaveBeenCalledWith(expect.stringMatching(/^\/welcome\?beta=1&plan=growth&source=pricing/));

  // Enterprise bleibt Vertragsplan: kein Betrag, kein Beta-Weg.
  const enterprise = screen.queryByTestId('pricing-card-enterprise');
  if (enterprise) {
    expect(enterprise).toHaveTextContent(/Auf Anfrage/);
    expect(screen.queryByTestId('pricing-list-price-enterprise')).toBeNull();
  }
});
