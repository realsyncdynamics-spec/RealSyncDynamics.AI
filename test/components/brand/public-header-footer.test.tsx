import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PublicHeader } from '../../../src/components/brand/PublicHeader';
import { PublicFooter } from '../../../src/components/brand/PublicFooter';
import { PublicPageFrame } from '../../../src/components/brand/PublicPageFrame';
import { GovernanceFooter } from '../../../src/components/landing/GovernanceFooter';
import { LandingFooter, LandingHeader } from '../../../src/components/landing/LandingShell';
import { PUBLIC_FOOTER_LINKS } from '../../../src/config/public-nav';
import { CI_FORBIDDEN_CTA } from '../../../src/content/runtimeVocab';

afterEach(cleanup);

const wrap = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

function assertNoForbiddenCta(text: string) {
  for (const phrase of [...CI_FORBIDDEN_CTA, 'Demo', 'Pilot', 'Call']) {
    expect(text).not.toContain(phrase);
  }
}

describe('PublicFooter', () => {
  it('renders all legal links incl. Impressum from PUBLIC_FOOTER_LINKS', () => {
    wrap(<PublicFooter />);
    const legal = screen.getByRole('navigation', { name: 'Rechtliches' });
    for (const link of PUBLIC_FOOTER_LINKS) {
      expect(within(legal).getByRole('link', { name: link.label })).toHaveAttribute('href', link.to);
    }
    expect(within(legal).getByRole('link', { name: 'Impressum' })).toHaveAttribute('href', '/impressum');
  });

  it('company/legal text matches GovernanceFooter exactly', () => {
    const a = wrap(<PublicFooter />).container.textContent;
    cleanup();
    const b = wrap(<GovernanceFooter />).container.textContent;
    expect(a).toBe(b);
  });

  it('contains no forbidden CTAs', () => {
    assertNoForbiddenCta(wrap(<PublicFooter />).container.textContent ?? '');
  });
});

describe('PublicHeader', () => {
  it('renders LangToggle, nav and CTA', () => {
    wrap(
      <PublicHeader nav={[{ label: 'Produkt', to: '/runtime' }]} cta={{ label: 'Kostenlos starten', to: '/audit' }} />,
    );
    expect(screen.getByTestId('lang-toggle')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Produkt' })).toHaveAttribute('href', '/runtime');
    expect(screen.getByRole('link', { name: /Kostenlos starten/ })).toHaveAttribute('href', '/audit');
  });

  it('mobile menu toggles via button and closes on Escape', () => {
    wrap(<PublicHeader nav={[{ label: 'Produkt', to: '/runtime' }]} />);
    const btn = screen.getByRole('button', { name: 'Navigation öffnen' });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('navigation', { name: 'Hauptnavigation mobil' })).toBeInTheDocument();
    fireEvent.keyDown(btn, { key: 'Escape' });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(btn);
  });

  it('PublicPageFrame renders header, main and footer without forbidden CTAs', () => {
    const { container } = wrap(<PublicPageFrame>Inhalt</PublicPageFrame>);
    expect(screen.getByTestId('public-header')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('Inhalt');
    expect(screen.getByTestId('public-footer')).toBeInTheDocument();
    assertNoForbiddenCta(container.textContent ?? '');
  });
});

describe('LandingShell uses the shared chrome with identical targets', () => {
  it('header keeps nav, login and trial CTA targets', () => {
    wrap(<LandingHeader />);
    expect(screen.getByTestId('public-header')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Runtime SaaS' })).toHaveAttribute('href', '/runtime');
    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/app');
    expect(screen.getByRole('link', { name: /14 Tage testen/ })).toHaveAttribute('href', '/welcome?source=landing-trial');
  });

  it('footer keeps Warteliste + legal links', () => {
    wrap(<LandingFooter />);
    expect(screen.getByRole('link', { name: 'Warteliste' })).toHaveAttribute('href', '/warteliste');
    expect(screen.getAllByRole('link', { name: 'Impressum' }).length).toBeGreaterThan(0);
  });

  it('footer link labels contain no Demo', () => {
    wrap(<LandingFooter />);
    const footer = screen.getByTestId('public-footer');
    const labels = within(footer).getAllByRole('link').map((el) => el.textContent ?? '');
    for (const label of labels) {
      expect(label).not.toMatch(/Demo/i);
    }
  });
});
