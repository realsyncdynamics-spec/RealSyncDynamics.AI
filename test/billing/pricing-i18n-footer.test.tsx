/**
 * /pricing: Fusszeile und Disclaimer folgen der aktiven Sprache.
 * Steuerhinweis (§ 19 / Regelbesteuerung) bleibt bewusst unberührt (#1748).
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
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

it('keeps German footer and disclaimer under DE', () => {
  mount();
  expect(screen.getByTestId('pricing-trust-note')).toHaveTextContent(
    /Free Audit kostenlos · 14 Tage kostenlos testen/,
  );
  expect(screen.getByTestId('pricing-trial-foot')).toHaveTextContent(/kein Account nötig/);
  expect(screen.getByTestId('pricing-trial-foot')).toHaveTextContent(/Tage kostenlos testen/);
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
    /Free Audit free of charge · 14-day free trial/,
  );
  expect(screen.getByTestId('pricing-trust-note')).not.toHaveTextContent(/kostenlos testen/);

  expect(screen.getByTestId('pricing-trial-foot')).toHaveTextContent(/no account needed/);
  expect(screen.getByTestId('pricing-trial-foot')).toHaveTextContent(/free trial/);
  expect(screen.getByTestId('pricing-trial-foot')).toHaveTextContent(/and/);
  expect(screen.getByTestId('pricing-trial-foot')).not.toHaveTextContent(/kein Account nötig/);

  expect(screen.getByTestId('pricing-disclaimer')).toHaveTextContent(
    /Our outputs are methodologically and technically sound/,
  );
  expect(screen.getByTestId('pricing-disclaimer')).toHaveTextContent(/100% legally secure/);
  expect(screen.getByTestId('pricing-disclaimer')).not.toHaveTextContent(/Unsere Outputs/);
});
