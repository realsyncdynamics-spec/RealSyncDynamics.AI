import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { TaskBoard } from '../../src/features/command-center/TaskBoard';
import { mk } from './taskFixtures';

const rpcMock = vi.fn(async (..._a: unknown[]) => ({ data: {}, error: null as null | { message: string } }));
let result: { data: unknown[]; error: { message: string } | null } = { data: [], error: null };
vi.mock('../../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => ({
    from: () => { const c: Record<string, unknown> = {}; c.select = () => c; c.order = () => c; c.limit = () => Promise.resolve(result); return c; },
    rpc: (...a: unknown[]) => rpcMock(...a),
  }),
}));

beforeEach(() => { result = { data: [], error: null }; rpcMock.mockClear(); });

describe('TaskBoard', () => {
  it('leer: ehrlich leer, 7 Spalten sichtbar', async () => {
    render(<TaskBoard />);
    await waitFor(() => expect(screen.getByTestId('tasks-empty')).toBeTruthy());
    for (const l of ['BACKLOG', 'GEPLANT', 'IN ARBEIT', 'WARTET AUF ENTSCHEIDUNG', 'BLOCKIERT', 'IN PRÜFUNG', 'ERLEDIGT']) {
      expect(screen.getByRole('region', { name: l })).toBeTruthy();
    }
  });
  it('Quellenfehler sichtbar', async () => {
    result = { data: [], error: { message: 'column board_status does not exist' } };
    render(<TaskBoard />);
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/board_status/));
  });
  it('Karten in Spalten mit Pflichtfeldern; Sperre sichtbar', async () => {
    result = { data: [
      mk('aaaaaaaa-0000', { agent: 'grok:github-bot', claimed_by: 'grok:github-bot', claim_expires_at: '2999-01-01T00:00:00Z', status: 'in_progress' }),
      mk('bbbbbbbb-0000', { board_status: 'awaiting_decision', depends_on: ['aaaaaaaa-0000'], priority: 'high' }),
    ], error: null };
    render(<TaskBoard />);
    await waitFor(() => expect(screen.getAllByTestId('task-card')).toHaveLength(2));
    const inArbeit = screen.getByRole('region', { name: 'IN ARBEIT' });
    expect(within(inArbeit).getByText('T-AAAAAAAA')).toBeTruthy();
    expect(within(inArbeit).getByText(/gesperrt durch grok:github-bot/)).toBeTruthy();
    const wait = screen.getByRole('region', { name: 'WARTET AUF ENTSCHEIDUNG' });
    expect(within(wait).getByText('1 offen von 1')).toBeTruthy();
    expect(within(wait).getByText('hoch')).toBeTruthy();
  });
  it('ERLEDIGT erst mit Nachweis; RPC move_agent_task', async () => {
    result = { data: [mk('cccccccc-0000')], error: null };
    render(<TaskBoard />);
    await waitFor(() => expect(screen.getByTestId('task-card')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Verschieben T-CCCCCCCC'), { target: { value: 'done' } });
    const btn = screen.getByRole('button', { name: 'Übernehmen' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Prüfnachweis T-CCCCCCCC'), { target: { value: 'PR #2091' } });
    fireEvent.click(btn);
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));
    const [fn, args] = rpcMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(fn).toBe('move_agent_task');
    expect(args).toMatchObject({ p_task_id: 'cccccccc-0000', p_board_status: 'done' });
    expect((args.p_evidence as Array<{ ref: string }>)[0]!.ref).toBe('PR #2091');
  });
  it('Serverablehnung angezeigt; Listenansicht; axe', async () => {
    result = { data: [mk('dddddddd-0000')], error: null };
    rpcMock.mockResolvedValueOnce({ data: {}, error: { message: 'nur Owner/Admin des Mandanten' } });
    const { container } = render(<TaskBoard />);
    await waitFor(() => expect(screen.getByTestId('task-card')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Verschieben T-DDDDDDDD'), { target: { value: 'planned' } });
    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Owner\/Admin/));
    const res = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect(res.violations.map((v) => v.id)).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Liste' }));
    expect(screen.getAllByTestId('task-row')).toHaveLength(1);
    expect(screen.getByText('BACKLOG')).toBeTruthy();
  });
});
