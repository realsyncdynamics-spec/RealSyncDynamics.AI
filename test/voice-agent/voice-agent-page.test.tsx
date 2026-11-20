/**
 * Voice-Agent-Seite unter `/voice-agent`: Route, CTAs, Status nur aus der
 * Registry, keine Preise und keine Live-Behauptung zur Telefonie.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { VoiceAgentPage } from '../../src/pages/VoiceAgentPage';
import { IMPLEMENTATION_ITEMS } from '../../src/product/implementation-status';

const root = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));

const status = (id: string) => IMPLEMENTATION_ITEMS.find((i) => i.id === id)?.status;

describe('Voice-Agent-Seite — `/voice-agent`', () => {
  it('ist als Route eingetragen und in der Registry belegt', () => {
    expect(read('src/App.tsx')).toContain('<Route path="/voice-agent" element={<VoiceAgentPage />} />');
    expect(status('voice-agent-page')).toBe('preview');
  });

  it('rendert Hero und führt CTAs auf echte Ziele', () => {
    render(<MemoryRouter><VoiceAgentPage /></MemoryRouter>);
    expect(screen.getByTestId('va-hero-heading')).toHaveTextContent('Jede Anfrage angenommen.');
    expect(screen.getByTestId('va-waitlist').getAttribute('href')).toMatch(/^\/warteliste\?interest=bots&source=voice-agent-page-hero$/);
    expect(screen.getByTestId('va-try-chat').getAttribute('href')).toBe('/chatbot/start?source=voice-agent-page');
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' });
    expect(within(nav).getByRole('link', { name: 'Voice Agent' })).toHaveAttribute('aria-current', 'page');
  });

  it('behauptet keine Live-Telefonie, solange die Registry es nicht sagt', () => {
    render(<MemoryRouter><VoiceAgentPage /></MemoryRouter>);
    if (status('voice-telephony') !== 'live') {
      expect(screen.getAllByText(/Telefonie: In Vorbereitung/).length).toBeGreaterThan(0);
      expect(screen.queryByText(/Telefonie ist live/)).toBeNull();
    }
  });

  it('zeigt ohne 3D-Eignung das Standbild', () => {
    render(<MemoryRouter><VoiceAgentPage /></MemoryRouter>);
    const stage = screen.getByTestId('va-bot-stage');
    expect(stage).toHaveAttribute('data-scene', 'still');
    expect(within(stage).getByRole('img')).toBeVisible();
  });

  it('nennt keinen Preis in Euro', () => {
    const { container } = render(<MemoryRouter><VoiceAgentPage /></MemoryRouter>);
    expect(container.textContent).not.toMatch(/\d\s?€/);
    expect(container.textContent).toContain('Preis folgt.');
  });
});
