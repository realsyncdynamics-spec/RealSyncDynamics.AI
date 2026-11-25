import { describe, it, expect, beforeEach } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AskAiPill } from '../../src/components/AskAiPill';
import { AssistentChip } from '../../src/components/AssistentChip';
import { openAssistant } from '../../src/features/assistant/openAssistant';

// jsdom hat keinen IntersectionObserver; der Chip nutzt ihn für die Hero-CTA.
class NoopIO {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds = [0];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}

beforeEach(() => {
  (globalThis as unknown as { IntersectionObserver: typeof NoopIO }).IntersectionObserver = NoopIO;
});

function renderAt(path: string, withChip: boolean) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/ki-bots" element={<p>KI-Bots-Seite</p>} />
        <Route path="*" element={<AskAiPill />} />
      </Routes>
      {withChip && <AssistentChip />}
    </MemoryRouter>,
  );
}

describe('<AskAiPill>', () => {
  it('zeigt „KI fragen“ mit Rückfall-Link auf die KI-Bots-Seite', () => {
    const { getByTestId } = renderAt('/', false);
    const pill = getByTestId('ask-ai-pill');
    expect(pill).toHaveTextContent('KI fragen');
    expect(pill).toHaveAttribute('href', '/ki-bots?source=ki-fragen');
  });

  it('öffnet den öffentlichen Assistenten, wenn der Chip montiert ist', () => {
    const { getByTestId, getByRole, queryByText } = renderAt('/', true);
    const dialog = getByRole('dialog', { hidden: true });
    expect(dialog).toHaveAttribute('aria-hidden', 'true');

    act(() => {
      fireEvent.click(getByTestId('ask-ai-pill'));
    });

    expect(dialog).toHaveAttribute('aria-hidden', 'false');
    // Kein Seitenwechsel: der Link-Rückfall wurde unterdrückt.
    expect(queryByText('KI-Bots-Seite')).toBeNull();
  });

  it('navigiert auf die KI-Bots-Seite, wenn kein Assistent verfügbar ist', () => {
    const { getByTestId, getByText } = renderAt('/', false);
    act(() => {
      fireEvent.click(getByTestId('ask-ai-pill'));
    });
    expect(getByText('KI-Bots-Seite')).toBeInTheDocument();
  });

  it('openAssistant() meldet false, wenn der Chip auf der Route ausgeblendet ist', () => {
    renderAt('/dashboard', true);
    expect(openAssistant()).toBe(false);
  });
});
