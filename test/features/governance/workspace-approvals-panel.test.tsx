/**
 * Workspace-Freigaben (Ansicht): Entscheidung nur bei offenen, nicht
 * abgelaufenen Anfragen; Fehlerzustände getrennt.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { WorkspaceApproval } from '../../../src/features/governance/workspaceApprovalsApi';

const FUTURE = new Date(Date.now() + 3_600_000).toISOString();
const PAST = new Date(Date.now() - 3_600_000).toISOString();

function approval(overrides: Partial<WorkspaceApproval> = {}): WorkspaceApproval {
  return {
    id: 'a1',
    tenant_id: 't1',
    agent_id: 'RSD-02',
    action_type: 'send_email',
    target_resource: 'thread-42',
    payload_hash: 'b'.repeat(64),
    status: 'PENDING',
    requested_at: '2026-11-22T09:00:00Z',
    expires_at: FUTURE,
    decided_by: null,
    decided_at: null,
    execution_id: null,
    executed_at: null,
    ...overrides,
  };
}

const api = vi.hoisted(() => ({
  list: vi.fn(),
  decide: vi.fn(),
}));
vi.mock('../../../src/features/governance/workspaceApprovalsApi', async (orig) => {
  const actual = await orig<typeof import('../../../src/features/governance/workspaceApprovalsApi')>();
  return { ...actual, listWorkspaceApprovals: api.list, decideWorkspaceApproval: api.decide };
});

import { WorkspaceApprovalsPanel } from '../../../src/features/governance/WorkspaceApprovalsPanel';

function renderPanel() {
  return render(
    <MemoryRouter>
      <WorkspaceApprovalsPanel activeTenantId="t1" />
    </MemoryRouter>,
  );
}

describe('WorkspaceApprovalsPanel', () => {
  beforeEach(() => {
    api.list.mockReset();
    api.decide.mockReset();
  });

  it('zeigt offene Anfragen mit Genehmigen/Ablehnen und lädt nach der Entscheidung neu', async () => {
    api.list.mockResolvedValue({ ok: true, approvals: [approval()] });
    api.decide.mockResolvedValue({ ok: true, status: 'APPROVED' });
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('workspace-approvals-list')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Genehmigen/ }));
    await waitFor(() => expect(api.decide).toHaveBeenCalledWith('a1', true));
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
  });

  it('bietet bei abgelaufener Frist keine Entscheidung an', async () => {
    api.list.mockResolvedValue({ ok: true, approvals: [approval({ expires_at: PAST })] });
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('workspace-approvals-list')).toBeTruthy());
    expect(screen.queryByRole('button', { name: /Genehmigen/ })).toBeNull();
    expect(screen.getByText('Abgelaufen', { selector: 'span' })).toBeTruthy();
  });

  it('zeigt Rechtefehler bei der Entscheidung als Alert', async () => {
    api.list.mockResolvedValue({ ok: true, approvals: [approval()] });
    api.decide.mockResolvedValue({
      ok: false,
      error: { kind: 'error', code: 'APPROVAL_NOT_FOUND', message: 'Freigabe nicht gefunden oder keine Berechtigung.' },
    });
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('workspace-approvals-list')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Ablehnen/ }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/keine Berechtigung/));
  });

  it('trennt „nicht eingerichtet“, Fehler und leer', async () => {
    api.list.mockResolvedValueOnce({ ok: false, error: { kind: 'unavailable' } });
    const { unmount } = renderPanel();
    await waitFor(() => expect(screen.getByTestId('workspace-approvals-unavailable')).toBeTruthy());
    expect(screen.queryByRole('alert')).toBeNull();
    unmount();

    api.list.mockResolvedValueOnce({ ok: false, error: { kind: 'error', code: 'LIST_FAILED', message: 'Freigaben konnten nicht geladen werden.' } });
    api.list.mockResolvedValueOnce({ ok: true, approvals: [] });
    renderPanel();
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Erneut laden/ }));
    await waitFor(() => expect(screen.getByTestId('workspace-approvals-empty')).toBeTruthy());
  });
});
