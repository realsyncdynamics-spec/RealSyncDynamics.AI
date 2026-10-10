/**
 * BrowserRuntimePanel — Verhalten gegen einen gemockten Server.
 * Jede Anzeige (Executor, Modi, Aktionen, Freigabe, Evidence) muss aus der
 * Serverantwort stammen; gesperrte Bedienelemente nennen ihren Grund.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const TENANT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER = '11111111-1111-4111-8111-111111111111';

const api = vi.hoisted(() => ({
  getBrowserRuntimeCapabilities: vi.fn(),
  listBrowserSessions: vi.fn(),
  createBrowserSession: vi.fn(),
  closeBrowserSession: vi.fn(),
  getBrowserSessionFrame: vi.fn(),
  runGovernedAction: vi.fn(),
  getApprovalStatus: vi.fn(),
  cancelApproval: vi.fn(),
  killAllBrowserSessions: vi.fn(),
  planBrowserTask: vi.fn(),
  getBrowserExecutorHealth: vi.fn(),
  approveApproval: vi.fn(),
  rejectApproval: vi.fn(),
}));

vi.mock('../../../../src/features/governance/browser/browserExecutorClient', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, ...api };
});
vi.mock('../../../../src/features/governance/approvalsApi', () => ({
  approveApproval: api.approveApproval,
  rejectApproval: api.rejectApproval,
}));
vi.mock('../../../../src/lib/useAuth', () => ({
  useAuth: () => ({ user: { id: USER, email: 'o@example.com' }, isLoading: false, isAuthenticated: true }),
}));
vi.mock('../../../../src/features/governance/scans/scansApi', () => ({
  listWebsitesForTenant: vi.fn(async () => []),
  addWebsiteForTenant: vi.fn(),
  triggerTenantAudit: vi.fn(),
  TenantAuditError: class extends Error {},
}));

import { BrowserRuntimePanel } from '../../../../src/features/governance/dashboard/BrowserRuntimePanel';
import { BrowserExecutorError } from '../../../../src/features/governance/browser/browserExecutorClient';

const ALL_ACTIONS = ['navigate', 'scroll', 'click', 'type', 'select', 'submit', 'wait', 'extract', 'read_text', 'read_dom', 'screenshot', 'back', 'forward', 'reload', 'download', 'upload'] as const;
const APPROVAL = new Set(['click', 'type', 'select', 'submit', 'download', 'upload']);

function capabilities(executorStatus: 'offline' | 'ready', reason: string | null = null) {
  const ready = executorStatus === 'ready';
  return {
    ok: true,
    tenant: { id: TENANT, verified: true, authority: 'membership', role: 'owner' },
    executor: {
      executor_id: 'default', status: executorStatus, reason_code: reason, checked_at: '2026-09-29T10:00:00.000Z',
      last_seen_at: ready ? '2026-09-29T10:00:00.000Z' : null, runtime: ready ? 'playwright-chromium' : null,
      version: ready ? '2026.09.1' : null, active_sessions: ready ? 0 : null, max_sessions: ready ? 20 : null,
      capabilities: ready ? ['sessions', 'frame', 'navigate', 'click', 'read_text', 'scroll', 'type', 'download'] : [],
    },
    entitlement: { key: 'ai.tool.automations', status: 'granted' },
    policy: {
      authority: 'server', policy_id: 'rsd.browser.baseline', policy_version: '2026-09-29.1', tenant_policies_loaded: true,
      mutation_approval: 'required', limits: { approvalTtlMs: 900000, maxActionsPerSession: 200, maxOpenSessionsPerTenant: 3 },
    },
    evidence: { available: true, store: 'governance_evidence', chain: 'append_governance_evidence' },
    kill_switch: { engaged: false },
    can_assist: true,
    can_copilot: ready,
    can_autonomous: false,
    reasons: {
      assist: [],
      copilot: ready ? [] : ['EXECUTOR_OFFLINE'],
      autonomous: ready ? ['APPROVAL_POLICY_MISSING'] : ['EXECUTOR_OFFLINE', 'APPROVAL_POLICY_MISSING'],
    },
    actions: Object.fromEntries(ALL_ACTIONS.map((t) => [t, {
      available: ready && t !== 'upload',
      reason: !ready ? 'EXECUTOR_OFFLINE' : t === 'upload' ? 'FILE_SOURCE_NOT_CONFIGURED' : null,
      requires_approval: APPROVAL.has(t),
    }])),
  };
}

const SESSION = {
  id: '99999999-9999-4999-8999-000000000001', status: 'ready', mode: 'assist', user_id: USER,
  current_url: 'https://example.com/', page_title: 'Example', action_count: 1, last_action: null, next_action: null,
  last_error_code: null, executor_version: '2026.09.1', created_at: '2026-09-29T10:00:00.000Z', expires_at: '2026-09-29T10:15:00.000Z',
};
const FRAME = { mime: 'image/jpeg', base64: 'AAAA', sha256: 'a'.repeat(64), bytes: 3, captured_at: '2026-09-29T10:00:01.000Z' };

function renderPanel() {
  return render(<MemoryRouter><BrowserRuntimePanel activeTenantId={TENANT} /></MemoryRouter>);
}

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  api.listBrowserSessions.mockResolvedValue({ sessions: [] });
  api.getBrowserSessionFrame.mockResolvedValue({ frame: FRAME, page: { url: 'https://example.com/', title: 'Example', loading: false }, session_status: 'ready' });
});
afterEach(() => cleanup());

describe('Executor offline', () => {
  it('zeigt den konkreten Grund, sperrt Aktionen mit Begründung und lässt Autonomous gesperrt', async () => {
    api.getBrowserRuntimeCapabilities.mockResolvedValue(capabilities('offline', 'EXECUTOR_NOT_CONFIGURED'));
    renderPanel();
    expect(await screen.findByText('EXECUTOR OFFLINE')).toBeInTheDocument();
    expect(screen.getByTestId('executor-status-line')).toHaveTextContent('Für diese Umgebung ist kein Executor eingerichtet.');
    expect(screen.getByTestId('agent-mode-copilot')).toBeDisabled();
    expect(screen.getByTestId('agent-mode-copilot')).toHaveTextContent('Executor offline');
    expect(screen.getByTestId('agent-mode-autonomous')).toBeDisabled();
    expect(screen.getByTestId('agent-mode-autonomous')).toHaveTextContent('Keine Autonomie-Freigabe-Policy definiert');
    expect(screen.getByRole('button', { name: /Governed Action ausführen/ })).toBeDisabled();
    expect(screen.getByTestId('composer-disabled-reason')).toHaveTextContent('Executor offline');
    expect(screen.getByTestId('governance-control')).toHaveTextContent('membership-bound · owner');
    expect(screen.getByTestId('governance-control')).toHaveTextContent('nie erreicht');
    expect(screen.getByTestId('runtime-badge-navigation')).toHaveTextContent('NAVIGATION INACTIVE');
  });

  it('Browser öffnen ist mit Grund gesperrt statt stumm deaktiviert', async () => {
    api.getBrowserRuntimeCapabilities.mockResolvedValue(capabilities('offline', 'EXECUTOR_UNREACHABLE'));
    renderPanel();
    await screen.findByText('EXECUTOR OFFLINE');
    fireEvent.change(screen.getByLabelText('Was soll RealSync im Browser tun?'), { target: { value: 'example.com' } });
    expect(screen.getByRole('button', { name: /Browser öffnen/ })).toBeDisabled();
    expect(screen.getByTestId('open-blocked-reason')).toHaveTextContent('Executor nicht bereit.');
    expect(api.createBrowserSession).not.toHaveBeenCalled();
  });
});

describe('Executor bereit', () => {
  it('öffnet eine Server-Session und zeigt das Bild DERSELBEN Session', async () => {
    api.getBrowserRuntimeCapabilities.mockResolvedValue(capabilities('ready'));
    api.createBrowserSession.mockResolvedValue({
      session: SESSION,
      frame: FRAME,
      initial_navigation: {
        ok: true, correlation_id: 'c1',
        decision: { decision: 'ALLOW', policy_id: 'rsd.browser.baseline', policy_version: '2026-09-29.1+tenant:s1', reason: 'PUBLIC_NAVIGATION_ALLOWED', risk_level: 'low', conditions: [] },
        pipeline: [{ step: 'requested', state: 'done' }, { step: 'policy', state: 'done' }, { step: 'approval', state: 'skipped' }, { step: 'execution', state: 'done' }, { step: 'verification', state: 'done' }, { step: 'evidence', state: 'done' }],
        result: { ok: true, url: 'https://example.com/', title: 'Example', error_code: null },
        verification: { status: 'passed', checks: {} },
        evidence: { id: 'ev1', content_hash: 'b'.repeat(64), previous_hash: null, event_id: 'evt-1' },
        approval_id: null, session: SESSION, frame: FRAME,
      },
    });
    renderPanel();
    await screen.findByText('HEADLESS EXECUTOR READY');
    fireEvent.change(screen.getByLabelText('Was soll RealSync im Browser tun?'), { target: { value: 'example.com' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Browser öffnen/ })); });
    expect(api.createBrowserSession).toHaveBeenCalledWith({ tenantId: TENANT, mode: 'assist', initialUrl: 'https://example.com/' });
    const img = await screen.findByTestId('browser-session-frame');
    expect(img).toHaveAttribute('data-frame-sha256', FRAME.sha256);
    expect(screen.getByTestId('browser-session-url')).toHaveTextContent('https://example.com/');
    expect(screen.getByTestId('governed-action-pipeline')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Evidence-Datensatz öffnen/ })).toHaveAttribute('href', '/app/events/evt-1');
  });

  it('Mutation: Freigabe-Karte, Freigeben, dann genau eine Ausführung mit approval_id', async () => {
    api.getBrowserRuntimeCapabilities.mockResolvedValue(capabilities('ready'));
    api.listBrowserSessions.mockResolvedValue({ sessions: [SESSION] });
    api.runGovernedAction.mockRejectedValueOnce(new BrowserExecutorError('this action requires human approval', 'APPROVAL_REQUIRED', 409, {
      approval_id: 'ap-1', expires_at: '2099-01-01T00:00:00.000Z',
      pipeline: [{ step: 'requested', state: 'done' }, { step: 'policy', state: 'done' }, { step: 'approval', state: 'pending' }],
    }));
    api.approveApproval.mockResolvedValue({ ok: true, status: 'approved' });
    api.runGovernedAction.mockResolvedValueOnce({
      ok: true, correlation_id: 'c2',
      decision: { decision: 'REQUIRE_APPROVAL', policy_id: 'rsd.browser.baseline', policy_version: '2026-09-29.1', reason: 'MUTATION_REQUIRES_APPROVAL', risk_level: 'high', conditions: [] },
      pipeline: [{ step: 'requested', state: 'done' }, { step: 'policy', state: 'done' }, { step: 'approval', state: 'done' }, { step: 'execution', state: 'done' }, { step: 'verification', state: 'done' }, { step: 'evidence', state: 'done' }],
      result: { ok: true, url: 'https://example.com/', title: 'Example', error_code: null },
      verification: { status: 'passed', checks: {} },
      evidence: { id: 'ev2', content_hash: 'c'.repeat(64), previous_hash: 'b'.repeat(64), event_id: 'evt-2' },
      approval_id: 'ap-1', session: SESSION, frame: FRAME,
    });
    renderPanel();
    await screen.findByTestId('browser-session-preview');

    fireEvent.change(screen.getByLabelText('Aktion'), { target: { value: 'click' } });
    fireEvent.change(screen.getByLabelText('Selector'), { target: { value: '#accept' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Governed Action ausführen/ })); });

    const card = await screen.findByTestId('browser-approval-card');
    expect(card).toHaveAttribute('data-approval-status', 'pending');
    expect(card).toHaveTextContent('Die Aktion wurde noch nicht ausgeführt');
    expect(api.runGovernedAction).toHaveBeenCalledTimes(1);

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Freigeben/ })); });
    expect(api.approveApproval).toHaveBeenCalledWith('ap-1');
    await act(async () => { fireEvent.click(await screen.findByTestId('execute-approved-action')); });
    expect(api.runGovernedAction).toHaveBeenLastCalledWith(expect.objectContaining({
      action: { type: 'click', selector: '#accept' }, approvalId: 'ap-1',
    }));
    await waitFor(() => expect(screen.queryByTestId('browser-approval-card')).not.toBeInTheDocument());
  });

  it('Serverfehler erscheinen als verständliche Meldung, nicht als Rohtext', async () => {
    api.getBrowserRuntimeCapabilities.mockResolvedValue(capabilities('ready'));
    api.listBrowserSessions.mockResolvedValue({ sessions: [SESSION] });
    api.runGovernedAction.mockRejectedValue(new BrowserExecutorError('Ziel-URL abgelehnt (PRIVATE_NETWORK_BLOCKED).', 'URL_BLOCKED', 403));
    renderPanel();
    await screen.findByTestId('browser-session-preview');
    fireEvent.change(screen.getByLabelText('Aktion'), { target: { value: 'navigate' } });
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'http://169.254.169.254/' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Governed Action ausführen/ })); });
    expect(await screen.findByText(/Ziel blockiert: private Netze/)).toBeInTheDocument();
    expect(screen.queryByText(/PRIVATE_NETWORK_BLOCKED/)).not.toBeInTheDocument();
  });

  async function requestApproval() {
    api.runGovernedAction.mockRejectedValueOnce(new BrowserExecutorError('this action requires human approval', 'APPROVAL_REQUIRED', 409, {
      approval_id: 'ap-9', expires_at: '2099-01-01T00:00:00.000Z',
      pipeline: [{ step: 'requested', state: 'done' }, { step: 'policy', state: 'done' }, { step: 'approval', state: 'pending' }],
    }));
    renderPanel();
    await screen.findByTestId('browser-session-preview');
    fireEvent.change(screen.getByLabelText('Aktion'), { target: { value: 'click' } });
    fireEvent.change(screen.getByLabelText('Selector'), { target: { value: '#accept' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Governed Action ausführen/ })); });
    await screen.findByTestId('browser-approval-card');
  }

  it('Seite geändert: verbrauchte Freigabe verschwindet, Meldung erklärt warum', async () => {
    api.getBrowserRuntimeCapabilities.mockResolvedValue(capabilities('ready'));
    api.listBrowserSessions.mockResolvedValue({ sessions: [SESSION] });
    api.approveApproval.mockResolvedValue({ ok: true, status: 'approved' });
    await requestApproval();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Freigeben/ })); });
    api.runGovernedAction.mockRejectedValueOnce(new BrowserExecutorError('the live page differs', 'PAGE_CHANGED', 409, {
      approval_consumed: true, action_executed: false, current_url: 'https://example.com/anders',
    }));
    await act(async () => { fireEvent.click(await screen.findByTestId('execute-approved-action')); });
    expect(await screen.findByText(/Die Seite hat sich seit der Freigabe geändert — nichts ausgeführt/)).toBeInTheDocument();
    expect(screen.getByText(/alte Freigabe ist verbraucht/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('browser-approval-card')).not.toBeInTheDocument());
  });

  it('Landung auf gesperrter Adresse: Session als fehlgeschlagen, verständliche Meldung', async () => {
    api.getBrowserRuntimeCapabilities.mockResolvedValue(capabilities('ready'));
    api.listBrowserSessions.mockResolvedValue({ sessions: [SESSION] });
    api.runGovernedAction.mockRejectedValueOnce(new BrowserExecutorError('the page ended up on a non-public address; session closed', 'URL_BLOCKED', 403, {
      reason: 'LANDED_ON_NON_PUBLIC_URL', action_executed: true, blocked_origin: 'http://10.0.0.1',
    }));
    renderPanel();
    await screen.findByTestId('browser-session-preview');
    fireEvent.change(screen.getByLabelText('Aktion'), { target: { value: 'navigate' } });
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://example.com/weiter' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Governed Action ausführen/ })); });
    expect(await screen.findByText(/danach landete die Seite auf einer gesperrten Adresse/)).toBeInTheDocument();
    expect(screen.queryByText(/LANDED_ON_NON_PUBLIC_URL/)).not.toBeInTheDocument();
  });

  it('erteilte, unbenutzte Freigabe lässt sich zurückziehen', async () => {
    api.getBrowserRuntimeCapabilities.mockResolvedValue(capabilities('ready'));
    api.listBrowserSessions.mockResolvedValue({ sessions: [SESSION] });
    api.approveApproval.mockResolvedValue({ ok: true, status: 'approved' });
    api.cancelApproval.mockResolvedValue({ cancelled: true, outcome: 'decided', approval_status: 'cancelled', evidence_id: 'ev-c' });
    await requestApproval();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Freigeben/ })); });
    await screen.findByTestId('execute-approved-action');
    await act(async () => { fireEvent.click(screen.getByTestId('withdraw-approval')); });
    expect(api.cancelApproval).toHaveBeenCalledWith({ tenantId: TENANT, approvalId: 'ap-9' });
    await waitFor(() => expect(screen.queryByTestId('browser-approval-card')).not.toBeInTheDocument());
  });

  it('Upload bleibt mit konkretem Grund gesperrt', async () => {
    api.getBrowserRuntimeCapabilities.mockResolvedValue(capabilities('ready'));
    api.listBrowserSessions.mockResolvedValue({ sessions: [SESSION] });
    renderPanel();
    await screen.findByTestId('browser-session-preview');
    const option = screen.getByRole('option', { name: /Upload · Freigabe — Keine mandantengebundene Dateiquelle eingerichtet/ });
    expect(option).toBeDisabled();
  });
});
