import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { DecisionInbox } from '../../src/features/command-center/DecisionInbox';

const rpcMock = vi.fn(async (..._a: unknown[]) => ({ data: {}, error: null as null | { message: string } }));
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
  getSupabase: () => ({ from: (t: string) => chain(t), rpc: (...a: unknown[]) => rpcMock(...a) }),
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

describe('DecisionInbox — Antwortvorschläge (M3)', () => {
  it('zeigt max. 3 Optionen, Empfehlung, Freigabestufe und Hinweis Empfehlung ≠ Freigabe', async () => {
    tables.agent_questions = { data: [row('m', { question: 'Soll PR 9 gemergt werden?', priority: 'P1', decision_id: 'd1' })], error: null };
    tables.agent_decisions = {
      data: [{
        id: 'd1', recommendation: 'CI prüfen', reason: 'r', risk_level: 'high', reversibility: 'reversible',
        status: 'proposed', proposed_by: 'grok:github-bot',
        options: [
          { label: 'CI prüfen', rationale: 'Checks fehlen', recommended: true },
          { label: 'Merge nach Prüfung', rationale: 'separat freigeben' },
          { label: 'Zurückstellen', rationale: 'offene Punkte' },
          { label: 'Vierte (darf nicht erscheinen)', rationale: 'x' },
        ],
      }],
      error: null,
    };
    render(<DecisionInbox />);
    await waitFor(() => expect(screen.getByTestId('inbox-proposal')).toBeTruthy());
    const opts = screen.getAllByTestId('proposal-option');
    expect(opts).toHaveLength(3);
    expect(opts[0]!.textContent).toMatch(/A · Empfohlen/);
    expect(screen.getByTestId('proposal-level').textContent).toMatch(/L4/);
    expect(screen.getByText(/Empfehlung ≠ Freigabe/)).toBeTruthy();
    const take = screen.getByRole('button', { name: 'Vorschlag übernehmen' }) as HTMLButtonElement;
    expect(take.disabled).toBe(true); // ohne ausdrückliche Bestätigung keine Freigabe
  });

  it('ohne decision_id: "Noch kein Antwortvorschlag"', async () => {
    tables.agent_questions = { data: [row('n', {})], error: null };
    render(<DecisionInbox />);
    await waitFor(() => expect(screen.getByText('Noch kein Antwortvorschlag.')).toBeTruthy());
  });
});

describe('DecisionInbox — Freigabe-Gate (M4)', () => {
  const setup = () => {
    tables.agent_questions = { data: [row('m', { question: 'Soll PR 9 gemergt werden?', decision_id: 'd1' })], error: null };
    tables.agent_decisions = { data: [{ id: 'd1', recommendation: 'A', reason: 'r', risk_level: 'high', reversibility: 'reversible',
      status: 'proposed', proposed_by: 'grok:github-bot',
      options: [{ label: 'A', rationale: 'a', recommended: true }, { label: 'B', rationale: 'b' }] }], error: null };
  };

  it('Freigabe erst nach Bestätigung; ruft resolve_agent_decision mit p_confirm=true und L4', async () => {
    setup(); rpcMock.mockClear();
    render(<DecisionInbox />);
    await waitFor(() => expect(screen.getByTestId('inbox-proposal')).toBeTruthy());
    fireEvent.click(screen.getByRole('checkbox', { name: /ausdrücklich frei \(L4\)/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Alternative B wählen' }));
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));
    expect(rpcMock.mock.calls[0]).toEqual(['resolve_agent_decision', {
      p_decision_id: 'd1', p_action: 'approve', p_option_index: 1, p_approval_level: 'L4', p_confirm: true, p_note: null,
    }]);
  });

  it('Zurückstellen ohne Bestätigung möglich, sendet p_confirm=false', async () => {
    setup(); rpcMock.mockClear();
    render(<DecisionInbox />);
    await waitFor(() => expect(screen.getByTestId('inbox-proposal')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Zurückstellen' }));
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));
    expect((rpcMock.mock.calls[0]![1] as { p_action: string; p_confirm: boolean })).toMatchObject({ p_action: 'defer', p_confirm: false });
  });

  it('Serverseitige Ablehnung wird angezeigt', async () => {
    setup(); rpcMock.mockClear();
    rpcMock.mockResolvedValueOnce({ data: {}, error: { message: 'nur Owner/Admin des Mandanten' } });
    render(<DecisionInbox />);
    await waitFor(() => expect(screen.getByTestId('inbox-proposal')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Ablehnen' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Owner\/Admin/));
  });
});

describe('DecisionInbox — Präzedenzfälle (M7)', () => {
  it('zeigt frühere Entscheidungen nur als Hinweis; Freigabe bleibt gesperrt', async () => {
    tables.agent_questions = { data: [row('p', { question: 'Webhook Retry erhöhen?', decision_id: 'd9' })], error: null };
    tables.agent_decisions = { data: [{ id: 'd9', recommendation: 'A', reason: 'r', risk_level: 'low', reversibility: 'reversible',
      status: 'proposed', proposed_by: 'grok:x', options: [{ label: 'A', rationale: 'a', recommended: true }] }], error: null };
    rpcMock.mockClear();
    rpcMock.mockResolvedValueOnce({ data: [
      { kind: 'decision', id: 'd9', title: 'selbst', status: 'proposed', created_at: '2026-10-30T00:00:00Z' },
      { kind: 'decision', id: 'old', title: 'Webhook Retry 2025', status: 'approved', created_at: '2026-01-01T00:00:00Z' },
    ] as unknown as object, error: null });
    render(<DecisionInbox />);
    await waitFor(() => expect(screen.getByTestId('inbox-proposal')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Frühere Entscheidungen anzeigen' }));
    await waitFor(() => expect(screen.getByTestId('precedents')).toBeTruthy());
    const p = screen.getByTestId('precedents');
    expect(p.textContent).toMatch(/nicht als Freigabe/);
    expect(p.textContent).toMatch(/Webhook Retry 2025/);
    expect(p.textContent).not.toMatch(/selbst/);
    expect(rpcMock.mock.calls[0]![0]).toBe('search_agent_knowledge');
    expect((screen.getByRole('button', { name: 'Vorschlag übernehmen' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
