import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { DecisionInbox } from '../../src/features/command-center/DecisionInbox';

const tables: Record<string, { data: unknown[]; error: { message: string } | null }> = {};

function chain(table: string) {
  const res = () => Promise.resolve(tables[table] ?? { data: [], error: null });
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'in']) c[m] = () => c;
  c.limit = res;
  c.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => res().then(ok, ko);
  return c;
}

vi.mock('../../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => ({ from: (t: string) => chain(t) }),
}));

const row = (id: string, p: Record<string, unknown>) => ({
  id, agent_ref: 'grok:github-bot', task_ref: null, milestone: 'M2', project: 'RealSyncDynamics.AI',
  question: 'Frage?', context: null, priority: 'P2', status: 'open', dedupe_key: id, is_demo: false,
  created_at: '2026-10-29T10:00:00Z', ...p,
});

beforeEach(() => { for (const k of Object.keys(tables)) delete tables[k]; });

describe('DecisionInbox', () => {
  it('ohne Daten ehrlich leer', async () => {
    tables.agent_questions = { data: [], error: null };
    render(<DecisionInbox />);
    await waitFor(() => expect(screen.getByTestId('inbox-empty')).toBeTruthy());
  });

  it('Quellenfehler wird angezeigt, keine Fragen erfunden', async () => {
    tables.agent_questions = { data: [], error: { message: 'relation does not exist' } };
    render(<DecisionInbox />);
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/relation does not exist/));
    expect(screen.queryAllByTestId('inbox-item')).toHaveLength(0);
  });

  it('sortiert P0 zuerst, fasst Duplikate zusammen, markiert Demo, zeigt Historie', async () => {
    tables.agent_questions = {
      data: [
        row('a', { question: 'Normale Rückfrage?', priority: 'P2' }),
        row('b', { question: 'Merge PR 1?', priority: 'P1', dedupe_key: 'merge' }),
        row('c', { question: 'Merge PR 1?', priority: 'P0', dedupe_key: 'merge', agent_ref: 'grok:rsd-backend', created_at: '2026-10-29T11:00:00Z' }),
        row('d', { question: 'Demo-Frage?', priority: 'P3', is_demo: true }),
      ],
      error: null,
    };
    tables.agent_question_events = {
      data: [{ question_id: 'b', event_type: 'created', from_value: null, to_value: 'open', created_at: '2026-10-29T10:00:00Z' }],
      error: null,
    };
    const { container } = render(<DecisionInbox />);
    await waitFor(() => expect(screen.getAllByTestId('inbox-item')).toHaveLength(3));
    const items = screen.getAllByTestId('inbox-item');
    expect(items.map((i) => within(i).getByTestId('inbox-priority').textContent)).toEqual(['P0', 'P2', 'P3']);
    expect(within(items[0]!).getByTestId('inbox-dup').textContent).toBe('2× gefragt');
    expect(within(items[0]!).getByText(/grok:github-bot, grok:rsd-backend/)).toBeTruthy();
    expect(within(items[0]!).getByText(/Angelegt/)).toBeTruthy();
    expect(within(items[2]!).getByText('DEMO')).toBeTruthy();
    const res = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(res.violations.map((v) => v.id)).toEqual([]);
  });
});
