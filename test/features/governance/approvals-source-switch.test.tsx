/**
 * /app/approvals: `?quelle=workspace` zeigt die Workspace-Freigaben
 * (workspace_approvals); ohne Parameter bleibt die Governance-Quelle
 * (governance_approvals) unverändert der Standard.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

const mocks = vi.hoisted(() => ({
  listApprovals: vi.fn(),
  listWorkspaceApprovals: vi.fn(),
}));

vi.mock('../../../src/features/kodee/connections/AuthGate', () => ({
  AuthGate: ({ children }: { children: () => ReactNode }) => <>{children()}</>,
}));
vi.mock('../../../src/core/access/TenantProvider', () => ({
  useTenant: () => ({ tenants: [{ tenantId: 't1', name: 'Acme' }], activeTenantId: 't1', setActiveTenant: vi.fn() }),
}));
vi.mock('../../../src/features/governance/approvalsApi', async (orig) => {
  const actual = await orig<typeof import('../../../src/features/governance/approvalsApi')>();
  return { ...actual, listApprovals: mocks.listApprovals };
});
vi.mock('../../../src/features/governance/workspaceApprovalsApi', async (orig) => {
  const actual = await orig<typeof import('../../../src/features/governance/workspaceApprovalsApi')>();
  return { ...actual, listWorkspaceApprovals: mocks.listWorkspaceApprovals };
});

import { ApprovalsView } from '../../../src/features/governance/ApprovalsView';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ApprovalsView />
    </MemoryRouter>,
  );
}

describe('ApprovalsView — Quelle', () => {
  beforeEach(() => {
    mocks.listApprovals.mockReset().mockResolvedValue({ ok: true, approvals: [] });
    mocks.listWorkspaceApprovals.mockReset().mockResolvedValue({ ok: true, approvals: [] });
  });

  it('ohne Parameter: Governance-Quelle, keine Workspace-Abfrage', async () => {
    renderAt('/app/approvals');
    await waitFor(() => expect(mocks.listApprovals).toHaveBeenCalledWith('t1', 'pending'));
    expect(mocks.listWorkspaceApprovals).not.toHaveBeenCalled();
    expect(screen.getByTestId('approval-source-governance').getAttribute('aria-selected')).toBe('true');
  });

  it('?quelle=workspace: Workspace-Freigaben des aktiven Mandanten', async () => {
    renderAt('/app/approvals?quelle=workspace');
    await waitFor(() => expect(mocks.listWorkspaceApprovals).toHaveBeenCalledWith('t1', 'PENDING'));
    expect(mocks.listApprovals).not.toHaveBeenCalled();
    expect(screen.getByTestId('workspace-approvals')).toBeTruthy();
  });

  it('Umschalten wechselt die Quelle', async () => {
    renderAt('/app/approvals');
    await waitFor(() => expect(mocks.listApprovals).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('approval-source-workspace'));
    await waitFor(() => expect(screen.getByTestId('workspace-approvals')).toBeTruthy());
    expect(screen.getByTestId('approval-source-workspace').getAttribute('aria-selected')).toBe('true');
  });
});
