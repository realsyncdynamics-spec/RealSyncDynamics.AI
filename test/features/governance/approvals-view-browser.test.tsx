/**
 * Approval-Queue — Browser-Aktionen.
 *
 * Die Queue zeigt, WAS freigegeben wird: Aktion (redigiert — eingegebener
 * Text nie im Klartext), Seite, Policy mit Version und die Bindung an genau
 * eine Session. Entscheiden gibt es nur auf offenen Einträgen; die neuen
 * Endzustände (ausgeführt, fehlgeschlagen, zurückgezogen) sind filterbar.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const TENANT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SESSION = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const api = vi.hoisted(() => ({
  listApprovals: vi.fn(),
  approveApproval: vi.fn(),
  rejectApproval: vi.fn(),
}));

vi.mock('../../../src/features/governance/approvalsApi', () => api);
vi.mock('../../../src/core/access/TenantProvider', () => ({
  useTenant: () => ({ tenants: [{ tenantId: TENANT, name: 'Workspace' }], activeTenantId: TENANT, setActiveTenant: vi.fn() }),
}));
vi.mock('../../../src/features/kodee/connections/AuthGate', () => ({
  AuthGate: ({ children }: { children: () => unknown }) => children(),
}));

import { ApprovalsView } from '../../../src/features/governance/ApprovalsView';

function browserApproval(over: Record<string, unknown> = {}) {
  return {
    id: 'ap-1',
    tenant_id: TENANT,
    event_id: 'ev-1',
    policy_id: null,
    asset_id: null,
    status: 'pending',
    requested_action: 'browser:type:#pin',
    resolved_by: null,
    resolved_at: null,
    resolution_reason: null,
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    created_at: new Date().toISOString(),
    requested_by: 'u-1',
    browser_session_id: SESSION,
    consumed_at: null,
    executed_at: null,
    event: {
      id: 'ev-1',
      title: 'Browser-Aktion wartet auf Freigabe: type',
      summary: null,
      risk_level: 'high',
      event_type: 'browser.action.requested',
      event_source: 'agent_runtime',
      vendor: null,
      model_name: null,
      data_types: [],
      created_at: new Date().toISOString(),
      payload: {
        browser_session_id: SESSION,
        action: { type: 'type', selector: '#pin', text: '[redacted:6 chars]' },
        target: '#pin',
        page_url: 'https://example.de/login',
        policy: {
          decision: 'REQUIRE_APPROVAL',
          policy_id: 'rsd.browser.baseline',
          policy_version: '2026-09-29.1+tenant:none',
          reason: 'MUTATION_REQUIRES_APPROVAL',
          risk_level: 'high',
          conditions: ['single_use'],
        },
      },
    },
    policy: null,
    asset: null,
    ...over,
  };
}

beforeEach(() => {
  api.listApprovals.mockReset();
  api.approveApproval.mockReset();
  api.rejectApproval.mockReset();
});
afterEach(() => cleanup());

function renderView() {
  return render(<MemoryRouter><ApprovalsView /></MemoryRouter>);
}

describe('Approval-Queue · Browser-Aktionen', () => {
  it('zeigt Aktion redigiert, Seite, Policy@Version, Session-Bindung und Ablauf', async () => {
    api.listApprovals.mockResolvedValue({ ok: true, approvals: [browserApproval()] });
    renderView();

    const details = await screen.findByTestId('approval-browser-details');
    expect(details.textContent).toContain('type');
    expect(details.textContent).toContain('#pin');
    expect(details.textContent).toContain('[redacted:6 chars]');
    expect(details.textContent).toContain('https://example.de/login');
    expect(details.textContent).toContain('rsd.browser.baseline@2026-09-29.1+tenant:none');
    expect(details.textContent).toContain(`Session ${SESSION.slice(0, 8)}`);
    expect(details.textContent).toMatch(/läuft in \d+ min ab/);
    expect(screen.getByRole('button', { name: /Genehmigen/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Ablehnen/ })).toBeTruthy();
    expect(api.listApprovals).toHaveBeenCalledWith(TENANT, 'pending');
  });

  it('Endzustände sind filterbar und haben keine Entscheidungs-Buttons', async () => {
    api.listApprovals.mockResolvedValueOnce({ ok: true, approvals: [] });
    renderView();
    await screen.findByText('Keine offenen Freigaben.');

    for (const label of ['Ausgeführt', 'Fehlgeschlagen', 'Zurückgezogen', 'Abgelaufen']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }

    const executedAt = '2026-09-29T10:05:00.000Z';
    api.listApprovals.mockResolvedValueOnce({
      ok: true,
      approvals: [browserApproval({ status: 'executed', consumed_at: executedAt, executed_at: executedAt, resolved_at: executedAt })],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ausgeführt' }));

    await waitFor(() => expect(api.listApprovals).toHaveBeenLastCalledWith(TENANT, 'executed'));
    const details = await screen.findByTestId('approval-browser-details');
    expect(details.textContent).toContain('Ausgeführt');
    expect(screen.queryByRole('button', { name: /Genehmigen/ })).toBeNull();
  });

  it('freigegeben, aber noch nicht verbraucht: Hinweis, dass der Anfragende ausführt', async () => {
    api.listApprovals.mockResolvedValueOnce({ ok: true, approvals: [] });
    renderView();
    await screen.findByText('Keine offenen Freigaben.');

    api.listApprovals.mockResolvedValueOnce({ ok: true, approvals: [browserApproval({ status: 'approved' })] });
    fireEvent.click(screen.getByRole('button', { name: 'Genehmigt' }));

    const details = await screen.findByTestId('approval-browser-details');
    expect(details.textContent).toContain('die Ausführung startet der Anfragende');
  });

  it('Nicht-Browser-Events zeigen keinen Browser-Block', async () => {
    const plain = browserApproval({
      event: { ...browserApproval().event, event_type: 'ai.request', payload: null },
      browser_session_id: null,
    });
    api.listApprovals.mockResolvedValue({ ok: true, approvals: [plain] });
    renderView();
    await screen.findByRole('button', { name: /Genehmigen/ });
    expect(screen.queryByTestId('approval-browser-details')).toBeNull();
  });
});
