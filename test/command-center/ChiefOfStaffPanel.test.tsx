import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChiefOfStaffPanel } from '../../src/features/command-center/ChiefOfStaffPanel';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const mocks = vi.hoisted(() => ({
  activeTenantId: null as string | null,
  load: vi.fn(),
}));

vi.mock('../../src/core/access/TenantProvider', () => ({
  useOptionalTenant: () => ({ activeTenantId: mocks.activeTenantId }),
}));
vi.mock('../../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => ({}),
}));
vi.mock('../../src/features/command-center/chiefOfStaffApi', () => ({
  loadPersistedChiefOfStaffInbox: (...args: unknown[]) => mocks.load(...args),
}));

function report(tenant_id: string) {
  return {
    tenant_id, source: 'supabase_agent_os', live_verified: true,
    fetched_at: '2026-11-20T12:00:00Z',
    counts: {
      open_tasks: 3, in_progress_tasks: 1, blocked_tasks: 1,
      failed_tasks: 0, pending_decisions: 1,
      unacknowledged_high_alerts: 0, attention_total: 2,
    },
    items: [
      { id: 'a-only', kind: 'blocked_task', priority: 'critical',
        title: 'Private task from A', agent: 'dev', created_at: '2026-11-20T12:00:00Z' },
    ],
    truncated: false,
  };
}

beforeEach(() => {
  mocks.activeTenantId = null;
  mocks.load.mockReset();
});

describe('ChiefOfStaffPanel', () => {
  it('never requests a tenantless inbox or fabricates zero tasks', async () => {
    render(<ChiefOfStaffPanel />);
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Kein Mandant ausgewählt.');
    expect(mocks.load).not.toHaveBeenCalled();
    expect(screen.queryByText('Keine priorisierten Einträge in den abgefragten Tabellen.')).toBeNull();
  });

  it('shows an authenticated read-only operator summary and does not approve anything', async () => {
    mocks.activeTenantId = A;
    mocks.load.mockResolvedValue(report(A));
    render(<ChiefOfStaffPanel />);
    expect(await screen.findByText('Private task from A')).toBeTruthy();
    expect(screen.getByText('Benötigt Aufmerksamkeit (2)')).toBeTruthy();
    expect(screen.getByText(/Nur Lesemodus/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Freigeben|Ausführen/ })).toBeNull();
    expect(mocks.load).toHaveBeenCalledTimes(1);
    expect(mocks.load.mock.calls[0]?.[1]).toBe(A);
    fireEvent.click(screen.getByRole('button', { name: 'Aktualisieren' }));
    await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(2));
  });

  it('renders an explicit denial rather than empty data on forbidden access', async () => {
    mocks.activeTenantId = A;
    mocks.load.mockRejectedValue({ code: 'forbidden' });
    render(<ChiefOfStaffPanel />);
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent', 'Nur Owner oder Admin dürfen diesen Arbeitsüberblick lesen.',
    );
    expect(screen.queryByText('Benötigt Aufmerksamkeit (0)')).toBeNull();
  });

  it('hides old tenant data synchronously on tenant change, before the next request resolves', async () => {
    mocks.activeTenantId = A;
    mocks.load.mockResolvedValueOnce(report(A));
    mocks.load.mockImplementationOnce(() => new Promise(() => {}));
    const view = render(<ChiefOfStaffPanel />);
    expect(await screen.findByText('Private task from A')).toBeTruthy();
    mocks.activeTenantId = B;
    view.rerender(<ChiefOfStaffPanel />);
    expect(screen.queryByText('Private task from A')).toBeNull();
    expect(screen.getByRole('status').textContent).toMatch(/wird geladen/);
    await waitFor(() => expect(mocks.load.mock.calls[1]?.[1]).toBe(B));
  });
});
