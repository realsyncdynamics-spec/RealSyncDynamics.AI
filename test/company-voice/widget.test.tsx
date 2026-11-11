import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingV6 } from '../../src/pages/LandingV6';
import { CompanyVoiceWidget } from '../../src/components/landing/v6/CompanyVoiceWidget';
import { COMPANY } from '../../src/config/company';
import { monthlyPriceText, planByKey } from '../../shared/pricing';

const starter = planByKey('starter');
if (!starter) throw new Error('starter missing');

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
  class FakeRecognition extends EventTarget {
    lang = '';
    interimResults = false;
    continuous = false;
    start(): void {}
    stop(): void {}
    abort(): void {}
    onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null = null;
    onerror: ((event: { error: string }) => void) | null = null;
    onend: (() => void) | null = null;
  }
  Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, writable: true, value: FakeRecognition });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, 'webkitSpeechRecognition');
});

function mountWidget() {
  return render(
    <MemoryRouter>
      <div className="lv6">
        <CompanyVoiceWidget />
      </div>
    </MemoryRouter>,
  );
}

it('öffnet die Demo per Tastatur, beantwortet Text und verweigert Lücken', async () => {
  mountWidget();
  const launcher = screen.getByRole('button', { name: /Demo/ });
  expect(launcher).toHaveAttribute('aria-expanded', 'false');
  launcher.focus();
  fireEvent.click(launcher);

  const dialog = screen.getByRole('dialog', { name: 'Fragen zum Unternehmen' });
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(screen.getByRole('list', { name: 'Transkript' })).toBeInTheDocument();
  expect(screen.getByText(/kuratierte Fakten/)).toBeInTheDocument();

  const mic = await waitFor(() => screen.getByRole('button', { name: 'Sprechen' }));
  expect(mic).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Hinweis gelesen, Mikrofon freigeben' }));
  expect(screen.getByRole('button', { name: 'Sprechen' })).toBeEnabled();

  const input = screen.getByRole('textbox', { name: 'Frage als Text' });
  fireEvent.change(input, { target: { value: 'Kostet der Starter 49 Euro?' } });
  fireEvent.click(screen.getByRole('button', { name: 'Antwort anzeigen' }));
  const spoken = () => screen.getAllByRole('listitem')
    .filter((item) => item.querySelector('span')?.textContent === 'Untertitel')
    .map((item) => item.textContent ?? '')
    .join('\n');
  expect(spoken()).toContain(monthlyPriceText(starter));
  expect(spoken()).not.toMatch(/\b49\b/);
  expect(spoken()).not.toContain(COMPANY.supportPhoneOptional ?? '4013');

  fireEvent.change(input, { target: { value: 'Wie wird das Wetter in Tokio?' } });
  fireEvent.click(screen.getByRole('button', { name: 'Antwort anzeigen' }));
  expect(screen.getByText(/nichts vor/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Kontakt' })).toHaveAttribute('href', '/kontakt');

  fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(launcher);
});

it('zeigt den Demo-Einstieg auf der Startseite', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <LandingV6 />
    </MemoryRouter>,
  );
  expect(screen.getByTestId('landing-v6')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Demo/ })).toBeInTheDocument();
  expect(document.body.textContent).not.toContain(COMPANY.supportPhoneOptional);
});
