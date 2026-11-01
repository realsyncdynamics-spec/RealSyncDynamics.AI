import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { MonitoringView } from '../../src/features/command-center/MonitoringView';
import { formatCount, formatUsd, sortEvents, type CriticalEvent } from '../../src/features/command-center/monitoring';

type R = { data: unknown[] | null; error: { message: string } | null };
let tables: Record<string, R> = {};
let rpc: R = { data: [], error: null };
vi.mock('../../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => ({
    from: (t: string) => { const c: Record<string, unknown> = {}; c.select = () => c; c.order = () => c; c.limit = () => Promise.resolve(tables[t] ?? { data: [], error: null }); return c; },
    rpc: () => Promise.resolve(rpc),
  }),
}));
beforeEach(() => { tables = {}; rpc = { data: [], error: null }; });

describe('monitoring helpers', () => {
  it('fehlende Werte sind UNBEKANNT, nicht 0', () => {
    expect(formatUsd(null)).toBe('UNBEKANNT');
    expect(formatUsd('abc')).toBe('UNBEKANNT');
    expect(formatUsd('0.03')).toMatch(/0,03 USD/);
    expect(formatCount(undefined)).toBe('UNBEKANNT');
    expect(formatCount('1000.000000')).toBe('1.000');
  });
  it('sortiert nach Schwere, dann Zeit', () => {
    const e = (severity: CriticalEvent['severity'], at: string): CriticalEvent => ({ at, severity, kind: 'k', category: 'health', subject_id: at, message: at });
    expect(sortEvents([e('low', '2026-10-30T10:00:00Z'), e('high', '2026-10-29T10:00:00Z'), e('high', '2026-10-30T09:00:00Z')]).map((x) => x.at))
      .toEqual(['2026-10-30T09:00:00Z', '2026-10-29T10:00:00Z', '2026-10-30T10:00:00Z']);
  });
});

describe('MonitoringView', () => {
  it('leer: ehrliche Leerzustände; Health für Nicht-Operatoren UNBEKANNT', async () => {
    rpc = { data: null, error: { message: 'nur Plattform-Operatoren' } };
    render(<MonitoringView />);
    await waitFor(() => expect(screen.getByTestId('events-empty')).toBeTruthy());
    expect(screen.getByTestId('costs-empty')).toBeTruthy();
    expect(screen.getByTestId('audit-empty')).toBeTruthy();
    expect(screen.getByText(/UNBEKANNT – nur für Plattform-Operatoren/)).toBeTruthy();
  });
  it('Quellenfehler → UNBEKANNT statt Zahlen', async () => {
    tables.cc_cost_by_source_v = { data: null, error: { message: 'relation does not exist' } };
    render(<MonitoringView />);
    await waitFor(() => expect(screen.getByText(/Kostenquelle: UNBEKANNT \(relation does not exist\)/)).toBeTruthy());
    expect(screen.queryAllByTestId('cost-row')).toHaveLength(0);
  });
  it('zeigt Ereignisse (Schwere zuerst), Kosten mit Basis, Health, Audit; axe', async () => {
    tables.cc_critical_events_v = { data: [
      { at: '2026-10-30T10:00:00Z', kind: 'claim_conflict', severity: 'low', category: 'coordination', subject_id: 't1', message: 'Doppelbearbeitung abgewiesen (b)' },
      { at: '2026-10-29T10:00:00Z', kind: 'critical_approval', severity: 'high', category: 'security', subject_id: 'd1', message: 'Freigabe L4 (approve)' },
    ], error: null };
    tables.cc_cost_by_source_v = { data: [
      { source: 'tenant_cost_ledger', month: '2026-10-01T00:00:00Z', metric: 'llm_estimate', basis: 'geschaetzt', cost_usd: '0.005', tokens: null, entries: 1, last_at: null },
    ], error: null };
    tables.cc_audit_feed_v = { data: [{ at: '2026-10-30T10:00:00Z', source: 'approval', event: 'approve', subject_type: 'decision', subject_id: 'abcdef1234', actor: null }], error: null };
    rpc = { data: [{ function_name: 'scheduler-dispatch', last_status: 'success', last_executed_at: '2026-10-30T10:00:00Z', failures_24h: 0, runs_24h: '12' }], error: null };
    const { container } = render(<MonitoringView />);
    await waitFor(() => expect(screen.getAllByTestId('critical-event')).toHaveLength(2));
    expect(screen.getAllByTestId('critical-event')[0]!.textContent).toMatch(/Hoch.*Sicherheit.*Freigabe L4/);
    const row = screen.getByTestId('cost-row');
    expect(within(row).getByText('geschaetzt')).toBeTruthy();
    expect(within(row).getByText('UNBEKANNT')).toBeTruthy();
    expect(screen.getByTestId('health-row').textContent).toMatch(/12 Läufe, 0 Fehler/);
    expect(screen.getByTestId('audit-row').textContent).toMatch(/Akteur UNBEKANNT/);
    const res = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect(res.violations.map((v) => v.id)).toEqual([]);
  });
});
