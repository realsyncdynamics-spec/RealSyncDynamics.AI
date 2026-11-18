import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { RealOsStart, BROWSER_OPEN_EVENT } from '../../../src/features/realos/RealOsStart';
import { ASSISTANT_PROMPT_EVENT } from '../../../src/components/governance-os/assistantPrompt';

function Where() {
  const { pathname } = useLocation();
  return <p data-testid="where">{pathname}</p>;
}

function renderStart() {
  return render(
    <MemoryRouter initialEntries={['/app/start']}>
      <Routes>
        <Route path="/app/start" element={<RealOsStart />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

const field = () => screen.getByRole('textbox');

afterEach(() => vi.restoreAllMocks());

describe('RealOsStart', () => {
  it('zeigt Überschrift, Schnellstarts und vier Produkte mit Status', () => {
    renderStart();
    expect(screen.getByRole('heading', { level: 1, name: 'Was möchtest du erledigen?' })).toBeTruthy();
    for (const id of ['reception', 'builder', 'optimizer', 'governance']) {
      expect(screen.getByTestId(`realos-card-${id}`)).toBeTruthy();
    }
    expect(screen.getByText('Telefonie: In Vorbereitung')).toBeTruthy();
  });

  it('Modus „Fragen“ übergibt den Text an den Assistenten der Shell', () => {
    const spy = vi.fn();
    window.addEventListener(ASSISTANT_PROMPT_EVENT, spy);
    renderStart();
    fireEvent.change(field(), { target: { value: 'Wie richte ich meinen Bot ein?' } });
    fireEvent.click(screen.getByTestId('realos-submit'));
    window.removeEventListener(ASSISTANT_PROMPT_EVENT, spy);
    expect(spy).toHaveBeenCalledTimes(1);
    expect((spy.mock.calls[0][0] as CustomEvent).detail).toEqual({ prompt: 'Wie richte ich meinen Bot ein?' });
    expect((field() as HTMLTextAreaElement).value).toBe('');
  });

  it('Modus „Öffnen“ lädt Web-Adressen im eingebetteten Browser', () => {
    const spy = vi.fn();
    window.addEventListener(BROWSER_OPEN_EVENT, spy);
    renderStart();
    fireEvent.click(screen.getByTestId('realos-mode-open'));
    fireEvent.change(field(), { target: { value: 'example.de' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    window.removeEventListener(BROWSER_OPEN_EVENT, spy);
    expect((spy.mock.calls[0][0] as CustomEvent).detail).toEqual({ url: 'https://example.de' });
  });

  it('Modus „Öffnen“ navigiert zum passenden Produkt', () => {
    renderStart();
    fireEvent.click(screen.getByTestId('realos-mode-open'));
    fireEvent.change(field(), { target: { value: 'Anfragen per WhatsApp' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(screen.getByTestId('where').textContent).toBe('/app/bots');
  });

  it('ohne Treffer bietet „Öffnen“ den Wechsel zur Frage an', () => {
    renderStart();
    fireEvent.click(screen.getByTestId('realos-mode-open'));
    fireEvent.change(field(), { target: { value: 'xyzqq' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(screen.getByTestId('realos-nomatch')).toBeTruthy();
  });

  it('„Was ist das?“ klappt die Erklärung mit drei Schritten auf', () => {
    renderStart();
    const toggle = screen.getAllByRole('button', { name: 'Was ist das?' })[0];
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const panel = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    expect(panel.hidden).toBe(false);
    expect(panel.querySelectorAll('ol li')).toHaveLength(3);
  });
});
