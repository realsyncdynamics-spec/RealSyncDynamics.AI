import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { GrokNotice } from '../../src/components/landing/v8/GrokNotice';
import { LandingV8Home } from '../../src/components/landing/v8/LandingV8Pages';
import { LandingV8Shell } from '../../src/components/landing/v8/LandingV8Shell';
import {
  GROK_NOTICE_PLACEHOLDER,
  V8_PRODUCTS_PATH,
  grokNoticeEnabled,
  grokNoticeText,
  registrationHref,
} from '../../src/marketing/landing-v8/public-config';

describe('Landing v8 App-Origin', () => {
  it('baut die Registrierung aus der gesetzten Origin und /welcome', () => {
    expect(registrationHref('https://app.realsyncdynamicsai.de/', 'https://preview.pages.dev')).toBe(
      'https://app.realsyncdynamicsai.de/welcome',
    );
    expect(registrationHref('https://app.realsyncdynamicsai.de', 'https://preview.pages.dev')).toBe(
      'https://app.realsyncdynamicsai.de/welcome',
    );
  });

  it('fällt ohne Origin auf den aktuellen Host zurück', () => {
    expect(registrationHref('', 'https://preview.pages.dev')).toBe('https://preview.pages.dev/welcome');
    expect(registrationHref('   ', 'https://preview.pages.dev')).toBe('https://preview.pages.dev/welcome');
  });

  it('verdrahtet die App-Domain nicht fest und bietet Produkte ansehen', () => {
    render(
      <MemoryRouter>
        <LandingV8Shell>
          <LandingV8Home />
        </LandingV8Shell>
      </MemoryRouter>,
    );
    const registrations = screen.getAllByRole('link', { name: 'Registrierung' });
    expect(registrations.length).toBeGreaterThan(0);
    for (const link of registrations) {
      const href = link.getAttribute('href') ?? '';
      expect(href).toBe(registrationHref());
      expect(href.endsWith('/welcome')).toBe(true);
      expect(href).not.toContain('app.realsyncdynamicsai.de');
    }
    const products = screen.getAllByRole('link', { name: 'Produkte ansehen' });
    expect(products.length).toBeGreaterThan(0);
    for (const link of products) {
      expect(link.getAttribute('href')).toBe(V8_PRODUCTS_PATH);
    }
  });
});

describe('Landing v8 Grok-Hinweis', () => {
  it('bleibt aus, außer das Flag ist genau 1', () => {
    expect(grokNoticeEnabled('')).toBe(false);
    expect(grokNoticeEnabled('0')).toBe(false);
    expect(grokNoticeEnabled('true')).toBe(false);
    expect(grokNoticeEnabled(undefined)).toBe(false);
    expect(grokNoticeEnabled('1')).toBe(true);
    expect(grokNoticeText('')).toBeNull();
    expect(grokNoticeText('1')).toBe(GROK_NOTICE_PLACEHOLDER);
  });

  it('rendert den Platzhalter nur bei eingeschaltetem Flag', () => {
    const off = render(<GrokNotice />);
    expect(off.queryByTestId('v8-grok-notice')).toBeNull();
    expect(off.container.textContent ?? '').not.toMatch(/xAI|Grok/);
    off.unmount();

    render(
      <MemoryRouter>
        <LandingV8Home />
      </MemoryRouter>,
    );
    expect(document.body.textContent ?? '').not.toMatch(/xAI|Grok/);
  });
});
