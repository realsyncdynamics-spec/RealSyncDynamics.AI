/**
 * Runtime-Events-Feed: Zustände bleiben getrennt (fehlende Quelle ≠ Fehler ≠
 * leer), Abfrage ist mandantengebunden, keine Demo-Events.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadRuntimeEvents, shortHash } from '../../../../src/features/governance/dashboard/runtimeEventsFeedData';

const HASH = 'a'.repeat(64);

function fakeClient(result: { data?: unknown; error?: { code?: string; message: string } | null }) {
  const calls: Record<string, unknown[]> = {};
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order']) {
    builder[m] = (...args: unknown[]) => { calls[m] = args; return builder; };
  }
  builder.limit = (...args: unknown[]) => {
    calls.limit = args;
    return Promise.resolve({ data: result.data ?? null, error: result.error ?? null });
  };
  const client = { from: (table: string) => { calls.from = [table]; return builder; } };
  return { client: client as unknown as SupabaseClient, calls };
}

const row = {
  id: 'e1',
  agent_id: 'RSD-02',
  event_type: 'gmail.reply_draft',
  requested_action: 'send_email',
  resource_id: 'thread-42',
  decision: 'require_approval',
  payload_hash: HASH,
  received_at: '2026-11-20T09:15:00Z',
};

describe('loadRuntimeEvents', () => {
  it('liest mandantengebunden aus workspace_events, neueste zuerst', async () => {
    const { client, calls } = fakeClient({ data: [row] });
    const state = await loadRuntimeEvents(client, 'tenant-1');
    expect(calls.from).toEqual(['workspace_events']);
    expect(calls.eq).toEqual(['tenant_id', 'tenant-1']);
    expect(calls.order).toEqual(['received_at', { ascending: false }]);
    expect(state).toMatchObject({ kind: 'value', events: [{ agentId: 'RSD-02', decision: 'require_approval' }] });
  });

  it('meldet fehlende Tabelle als „unavailable“, nicht als Fehler', async () => {
    const { client } = fakeClient({ error: { code: 'PGRST205', message: 'not found' } });
    expect(await loadRuntimeEvents(client, 't')).toEqual({ kind: 'unavailable' });
  });

  it('meldet RLS-/Netzfehler als Fehler, nicht als leer', async () => {
    const { client } = fakeClient({ error: { code: '42501', message: 'permission denied' } });
    expect(await loadRuntimeEvents(client, 't')).toEqual({ kind: 'error', message: 'permission denied' });
  });

  it('verwirft Zeilen mit unbekannter Entscheidung', async () => {
    const { client } = fakeClient({ data: [{ ...row, decision: 'deny' }] });
    expect(await loadRuntimeEvents(client, 't')).toEqual({ kind: 'value', events: [] });
  });

  it('kürzt den Herkunftsnachweis', () => {
    expect(shortHash(HASH)).toBe(`${'a'.repeat(12)}…`);
  });
});

const supa = vi.hoisted(() => ({ result: { data: [] as unknown[], error: null as null | { code?: string; message: string } } }));
vi.mock('../../../../src/lib/supabase', () => ({
  getSupabase: () => {
    const builder: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'order']) builder[m] = () => builder;
    builder.limit = () => Promise.resolve(supa.result);
    return { from: () => builder };
  },
}));

import { RuntimeEventsFeed } from '../../../../src/features/governance/dashboard/RuntimeEventsFeed';

function renderFeed() {
  return render(
    <MemoryRouter>
      <RuntimeEventsFeed activeTenantId="t1" reloadKey={0} dataVersion={0} />
    </MemoryRouter>,
  );
}

describe('RuntimeEventsFeed', () => {
  beforeEach(() => { supa.result = { data: [], error: null }; });

  it('zeigt Events mit Entscheidung, ohne Link auf eine fremde Freigabeansicht', async () => {
    supa.result = { data: [row], error: null };
    renderFeed();
    await waitFor(() => expect(screen.getByTestId('runtime-events-list')).toBeTruthy());
    expect(screen.getByText('RSD-02')).toBeTruthy();
    expect(screen.getByText('Freigabe nötig')).toBeTruthy();
    // /app/approvals liest governance_approvals, nicht workspace_approvals.
    expect(screen.queryByRole('link', { name: 'Freigabe nötig' })).toBeNull();
  });

  it('zeigt Leerzustand ohne Beispieldaten', async () => {
    renderFeed();
    await waitFor(() => expect(screen.getByTestId('runtime-events-empty')).toBeTruthy());
    expect(screen.queryByTestId('runtime-events-list')).toBeNull();
  });

  it('zeigt „nicht eingerichtet“ bei fehlender Tabelle', async () => {
    supa.result = { data: [], error: { code: '42P01', message: 'relation does not exist' } };
    renderFeed();
    await waitFor(() => expect(screen.getByTestId('runtime-events-unavailable')).toBeTruthy());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('zeigt Fehler mit „Erneut laden“ und lädt nach', async () => {
    supa.result = { data: [], error: { code: '42501', message: 'permission denied' } };
    renderFeed();
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    supa.result = { data: [row], error: null };
    fireEvent.click(screen.getByRole('button', { name: /Erneut laden/ }));
    await waitFor(() => expect(screen.getByTestId('runtime-events-list')).toBeTruthy());
  });
});
