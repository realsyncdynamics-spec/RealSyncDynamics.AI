import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { CommandCenterView } from '../../src/features/command-center/CommandCenterView';
import { GROK_SOLL_AGENTS, runtimeStaticAgents } from '../../src/features/command-center/agentRegistry';

// Keine Netzwerk-/Live-Daten im Test: Supabase gilt als nicht konfiguriert.
vi.mock('../../src/lib/supabase', () => ({
  isSupabaseConfigured: () => false,
  getSupabase: () => { throw new Error('darf im Test nicht aufgerufen werden'); },
}));

const total = GROK_SOLL_AGENTS.length + runtimeStaticAgents().length;

async function renderView() {
  const utils = render(<CommandCenterView />);
  await waitFor(() => expect(screen.getByText(`${total} von ${total} Agenten`)).toBeTruthy());
  return utils;
}

describe('CommandCenterView', () => {
  it('zeigt alle Code-/Soll-Agenten mit Status UNBEKANNT und ehrlichem Quellenhinweis', async () => {
    await renderView();
    const statuses = screen.getAllByTestId('agent-status').map((n) => n.textContent);
    expect(statuses).toHaveLength(total);
    expect(new Set(statuses)).toEqual(new Set(['UNBEKANNT']));
    expect(screen.getByRole('status').textContent).toMatch(/Supabase nicht konfiguriert/);
  });

  it('Decision Inbox ist ein klarer Platzhalter ohne Fragen', async () => {
    await renderView();
    const inbox = screen.getByRole('complementary', { name: 'Decision Inbox' });
    expect(within(inbox).getByText(/Platzhalter/)).toBeTruthy();
    expect(within(inbox).queryAllByTestId('agent-card')).toHaveLength(0);
  });

  it('Suche und Projekt-/Typfilter wirken', async () => {
    await renderView();
    fireEvent.change(screen.getByLabelText('Agenten suchen'), { target: { value: 'Policy Agent' } });
    expect(screen.getAllByTestId('agent-card')).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Agenten suchen'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Projekt'), { target: { value: 'Governance Runtime' } });
    expect(screen.getAllByTestId('agent-card')).toHaveLength(runtimeStaticAgents().length);
    fireEvent.change(screen.getByLabelText('Projekt'), { target: { value: 'all' } });
    fireEvent.change(screen.getByLabelText('Typ'), { target: { value: 'grok-bot' } });
    expect(screen.getAllByTestId('agent-card')).toHaveLength(GROK_SOLL_AGENTS.length);
  });

  it('Priorität „Nicht gesetzt“ trifft alle (keine erfundenen Prioritäten)', async () => {
    await renderView();
    fireEvent.change(screen.getByLabelText('Priorität'), { target: { value: '__unset__' } });
    expect(screen.getAllByTestId('agent-card')).toHaveLength(total);
  });

  it('mobile Navigation lässt sich öffnen (aria-expanded)', async () => {
    await renderView();
    const btn = screen.getByRole('button', { name: /Navigation/ });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('navigation', { name: 'Command Center (mobil)' })).toBeTruthy();
  });

  it('axe: keine Verstöße (ohne color-contrast, das jsdom nicht berechnen kann)', async () => {
    const { container } = await renderView();
    const res = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(res.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
