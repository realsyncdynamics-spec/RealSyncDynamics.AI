/**
 * Bot auf der Startseite: startet eingeklappt, keine automatische
 * Tonwiedergabe, Schließen per Escape gibt den Fokus zurück.
 * Simulierte Browser-APIs (speechSynthesis, fetch).
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CompanyVoiceWidget } from '../../src/components/landing/v6/CompanyVoiceWidget';

const speak = vi.fn();
const cancel = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
  speak.mockReset();
  cancel.mockReset();
  vi.stubGlobal('speechSynthesis', { speak, cancel, getVoices: () => [{ lang: 'de-DE', name: 'Google Deutsch' }], speaking: false });
  vi.stubGlobal('SpeechSynthesisUtterance', class { text: string; lang = ''; rate = 1; voice: unknown = null; constructor(t: string) { this.text = t; } });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mount() {
  return render(
    <MemoryRouter>
      <div className="lv6">
        <CompanyVoiceWidget />
      </div>
    </MemoryRouter>,
  );
}

it('startet eingeklappt: kein Dialog, nur der Öffnen-Knopf', () => {
  mount();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByTestId('company-voice-launcher')).toHaveAttribute('aria-expanded', 'false');
});

it('liest Antworten nicht automatisch vor, sondern nur nach Einschalten', () => {
  mount();
  fireEvent.click(screen.getByTestId('company-voice-launcher'));
  const toggle = screen.getByTestId('company-voice-read-aloud');
  expect(toggle).toHaveAttribute('aria-pressed', 'false');

  fireEvent.change(screen.getByTestId('company-voice-input'), { target: { value: 'Was kostet Starter?' } });
  fireEvent.click(screen.getByRole('button', { name: 'Antwort anzeigen' }));
  expect(speak).not.toHaveBeenCalled();

  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-pressed', 'true');
  fireEvent.change(screen.getByTestId('company-voice-input'), { target: { value: 'Was kostet Growth?' } });
  fireEvent.click(screen.getByRole('button', { name: 'Antwort anzeigen' }));
  expect(speak).toHaveBeenCalled();
});

it('Escape schließt den Dialog und gibt den Fokus an den Öffnen-Knopf zurück', () => {
  mount();
  const launcher = screen.getByTestId('company-voice-launcher');
  fireEvent.click(launcher);
  const dialog = screen.getByRole('dialog');
  fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(launcher);
});
