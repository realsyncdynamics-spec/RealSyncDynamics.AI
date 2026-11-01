import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { MemoryView } from '../../src/features/command-center/MemoryView';
import { RoutinesView } from '../../src/features/command-center/RoutinesView';

const rpcMock = vi.fn(async (..._a: unknown[]) => ({ data: [] as unknown[], error: null as null | { message: string } }));
let viewResult: { data: unknown[]; error: { message: string } | null } = { data: [], error: null };
vi.mock('../../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => ({
    from: () => { const c: Record<string, unknown> = {}; c.select = () => c; c.order = () => c; c.limit = () => Promise.resolve(viewResult); return c; },
    rpc: (...a: unknown[]) => rpcMock(...a),
  }),
}));
beforeEach(() => { rpcMock.mockReset(); rpcMock.mockResolvedValue({ data: [], error: null }); viewResult = { data: [], error: null }; });

describe('MemoryView', () => {
  it('sucht per RPC und zeigt Treffer mit Art/Status', async () => {
    rpcMock.mockResolvedValueOnce({ data: [
      { kind: 'decision', id: 'd1', title: 'Webhook Retry', snippet: 'A · Begründung', status: 'approved', agent: 'grok:x', created_at: '2026-10-29T10:00:00Z', decision_id: 'd1' },
      { kind: 'memory', id: 'm1', title: 'Webhook-Ausfall', snippet: 'Lösung', status: 'active', agent: null, created_at: '2026-10-28T10:00:00Z', decision_id: null },
    ], error: null });
    const { container } = render(<MemoryView />);
    fireEvent.change(screen.getByLabelText('Gedächtnis durchsuchen'), { target: { value: 'webhook' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Frage' }));
    fireEvent.click(screen.getByRole('button', { name: 'Suchen' }));
    await waitFor(() => expect(screen.getAllByTestId('memory-hit')).toHaveLength(2));
    expect(rpcMock).toHaveBeenCalledWith('search_agent_knowledge', { p_query: 'webhook', p_kinds: ['decision', 'memory'], p_limit: 50, p_match_any: false });
    expect(screen.getByText(/Agent UNBEKANNT/)).toBeTruthy();
    const res = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect(res.violations.map((v) => v.id)).toEqual([]);
  });
  it('leer und Fehler ehrlich', async () => {
    render(<MemoryView />);
    fireEvent.change(screen.getByLabelText('Gedächtnis durchsuchen'), { target: { value: 'nix' } });
    fireEvent.click(screen.getByRole('button', { name: 'Suchen' }));
    await waitFor(() => expect(screen.getByTestId('memory-empty')).toBeTruthy());
    rpcMock.mockResolvedValueOnce({ data: [], error: { message: 'function does not exist' } });
    fireEvent.click(screen.getByRole('button', { name: 'Suchen' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/function does not exist/));
  });
});

describe('RoutinesView', () => {
  it('zeigt Zustände nur aus Läufen; Scan-Zeitplan-Ergebnis UNBEKANNT', async () => {
    viewResult = { data: [
      { source: 'routine', id: 'r1', key: 'daily.drift', label: 'Drift', agent_ref: null, schedule: '0 3 * * *', enabled: true, expected_interval_minutes: null,
        last_run_at: '2026-10-30T03:00:00Z', last_status: 'failure', last_error: 'Timeout', last_summary: null, failures_7d: '2', next_run_at: null },
      { source: 'scan_schedule', id: 's1', key: 'scan:s1', label: 'Scan', agent_ref: null, schedule: 'daily', enabled: true, expected_interval_minutes: null,
        last_run_at: '2026-10-30T03:00:00Z', last_status: null, last_error: null, last_summary: null, failures_7d: null, next_run_at: null },
    ], error: null };
    render(<RoutinesView />);
    await waitFor(() => expect(screen.getAllByTestId('routine-row')).toHaveLength(2));
    expect(screen.getByText('Fehlgeschlagen: Timeout')).toBeTruthy();
    expect(screen.getByText('Ergebnis UNBEKANNT')).toBeTruthy();
    expect(screen.getByText('UNBEKANNT')).toBeTruthy();
  });
  it('leer bzw. Quelle nicht lesbar', async () => {
    const { unmount } = render(<RoutinesView />);
    await waitFor(() => expect(screen.getByTestId('routines-empty')).toBeTruthy());
    unmount();
    viewResult = { data: [], error: { message: 'relation does not exist' } };
    render(<RoutinesView />);
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/relation does not exist/));
  });
});
