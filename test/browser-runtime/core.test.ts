/**
 * Governed Browser Runtime — reine Module: Aktionsschema, Policy,
 * Capabilities, Session-Automat, Executor-Client-Mapping.
 */
import { describe, expect, it } from 'vitest';
import {
  actionClass,
  approvalFingerprint,
  deriveFingerprintKey,
  parseBrowserAction,
  redactAction,
  type BrowserAction,
} from '../../supabase/functions/_shared/browser-runtime/actions';
import {
  BASELINE_POLICY_ID,
  EXECUTION_LIMITS,
  evaluateBrowserAction,
  overlayFromPdpResult,
  type BrowserPolicyInput,
} from '../../supabase/functions/_shared/browser-runtime/policy';
import { computeCapabilities, type CapabilityInput } from '../../supabase/functions/_shared/browser-runtime/capabilities';
import {
  assertSessionActionable,
  canTransition,
  newExecutorSessionId,
  nextExpiry,
  type SessionRow,
} from '../../supabase/functions/_shared/browser-runtime/session';
import {
  createExecutorClient,
  errorFromExecutor,
  healthFromResponse,
} from '../../supabase/functions/_shared/browser-runtime/executor';
import { checkNavigationUrl } from '../../supabase/functions/_shared/browser-runtime/url';
import { readyHealth } from './fakes';

const T = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function policyInput(action: BrowserAction, patch: Partial<BrowserPolicyInput> = {}): BrowserPolicyInput {
  return {
    actor: { user_id: 'u1', role: 'owner' },
    tenant: { id: T, verified: true },
    capability: { mode: 'assist', mode_allowed: true, initiated_by: 'human' },
    target: { page_url: 'https://example.com/' },
    action,
    risk_context: {
      session_action_count: 0,
      session_age_ms: 0,
      kill_switch_engaged: false,
      url_check: action.type === 'navigate' ? checkNavigationUrl(action.url) : undefined,
    },
    tenant_policy: { status: 'evaluated', decision: 'allow', policy_id: null, snapshot_version: 's1', reason_text: null },
    ...patch,
  };
}

describe('Aktionsschema', () => {
  it('klassifiziert Mutationen, Nebenwirkungen und lesende Aktionen', () => {
    for (const t of ['click', 'type', 'select', 'submit', 'upload'] as const) expect(actionClass(t)).toBe('mutation');
    expect(actionClass('download')).toBe('side_effect');
    for (const t of ['navigate', 'scroll', 'wait', 'extract', 'read_text', 'read_dom', 'screenshot', 'back', 'forward', 'reload'] as const) {
      expect(actionClass(t)).toBe('read_only');
    }
  });

  it('kappt Grenzwerte statt sie zu ignorieren', () => {
    expect(parseBrowserAction({ type: 'scroll', direction: 'down', amount: 99999 })).toEqual({ ok: true, action: { type: 'scroll', direction: 'down', amount: 5000 } });
    expect(parseBrowserAction({ type: 'wait', milliseconds: 60000 })).toEqual({ ok: true, action: { type: 'wait', milliseconds: 5000 } });
    expect(parseBrowserAction({ type: 'type', selector: '#a', text: 'x'.repeat(10_001) }).ok).toBe(false);
    expect(parseBrowserAction({ type: 'select', selector: '#a' }).ok).toBe(false);
    expect(parseBrowserAction(null).ok).toBe(false);
  });

  it('redigiert Eingabetext und Datei-Referenzen', () => {
    expect(redactAction({ type: 'type', selector: '#pw', text: 'geheim' })).toEqual({ type: 'type', selector: '#pw', text: '[redacted:6 chars]' });
    expect(redactAction({ type: 'upload', selector: '#f', file_ref: 'tenant/x.pdf' })).toEqual({ type: 'upload', selector: '#f', file_ref: '[redacted]' });
  });

  it('Fingerprint (HMAC) bindet Session, Seite und unredigierte Aktion — und den Schlüssel', async () => {
    const key = await deriveFingerprintKey('server-secret-for-tests');
    expect(key).toHaveLength(32);
    const base = { tenantId: T, browserSessionId: 's1', executorSessionId: 'rsx_1', pageUrl: 'https://a.example/', action: { type: 'type', selector: '#q', text: 'x' } as BrowserAction };
    const fp = await approvalFingerprint(base, key);
    expect(fp).toMatch(/^browser:v2:[0-9a-f]{64}$/);
    expect(await approvalFingerprint(base, key)).toBe(fp);
    expect(await approvalFingerprint({ ...base, pageUrl: 'https://a.example/other' }, key)).not.toBe(fp);
    expect(await approvalFingerprint({ ...base, browserSessionId: 's2' }, key)).not.toBe(fp);
    expect(await approvalFingerprint({ ...base, action: { type: 'type', selector: '#q', text: 'y' } }, key)).not.toBe(fp);
    expect(await approvalFingerprint(base, await deriveFingerprintKey('anderes-geheimnis'))).not.toBe(fp);
    await expect(approvalFingerprint(base, new Uint8Array(8))).rejects.toThrow();
    await expect(deriveFingerprintKey('')).rejects.toThrow();
  });
});

describe('evaluateBrowserAction', () => {
  it('lesende Aktion und öffentliche Navigation: ALLOW mit Evidence-Pflicht', () => {
    const nav = evaluateBrowserAction(policyInput({ type: 'navigate', url: 'https://example.com/' }));
    expect(nav).toMatchObject({ decision: 'ALLOW', policy_id: BASELINE_POLICY_ID, risk_level: 'low', reason: 'PUBLIC_NAVIGATION_ALLOWED' });
    expect(nav.conditions).toContain('evidence_required');
    expect(nav.policy_version).toBe('2026-09-29.1+tenant:s1');
    expect(evaluateBrowserAction(policyInput({ type: 'read_text' }))).toMatchObject({ decision: 'ALLOW', risk_level: 'info' });
  });

  it('Mutationen und Downloads: REQUIRE_APPROVAL mit Einmal-/Seitenbindung', () => {
    for (const action of [
      { type: 'click', selector: '#a' },
      { type: 'type', selector: '#a', text: 'x' },
      { type: 'select', selector: '#a', value: 'b' },
      { type: 'submit', selector: '#a' },
    ] as BrowserAction[]) {
      const d = evaluateBrowserAction(policyInput(action));
      expect(d).toMatchObject({ decision: 'REQUIRE_APPROVAL', reason: 'MUTATION_REQUIRES_APPROVAL', risk_level: 'high' });
      expect(d.conditions).toEqual(expect.arrayContaining(['single_use', 'bound_to_session', 'bound_to_page_url', 'approval_ttl_minutes:15']));
    }
    expect(evaluateBrowserAction(policyInput({ type: 'download', selector: '#d' }))).toMatchObject({ decision: 'REQUIRE_APPROVAL', risk_level: 'medium' });
  });

  it('DENY-Regeln in fester Reihenfolge', () => {
    const click = { type: 'click', selector: '#a' } as BrowserAction;
    expect(evaluateBrowserAction(policyInput(click, { risk_context: { session_action_count: 0, session_age_ms: 0, kill_switch_engaged: true } })).reason).toBe('KILL_SWITCH_ENGAGED');
    expect(evaluateBrowserAction(policyInput(click, { tenant: { id: T, verified: false } })).reason).toBe('TENANT_NOT_VERIFIED');
    expect(evaluateBrowserAction(policyInput(click, { actor: { user_id: 'u', role: 'viewer_auditor' } })).reason).toBe('ROLE_NOT_PERMITTED');
    expect(evaluateBrowserAction(policyInput(click, { capability: { mode: 'autonomous', mode_allowed: false, initiated_by: 'human' } })).reason).toBe('MODE_NOT_PERMITTED');
    expect(evaluateBrowserAction(policyInput({ type: 'read_text' }, { capability: { mode: 'assist', mode_allowed: true, initiated_by: 'planner' } })).reason).toBe('AUTORUN_NOT_PERMITTED_IN_ASSIST');
    expect(evaluateBrowserAction(policyInput({ type: 'read_text' }, { risk_context: { session_action_count: EXECUTION_LIMITS.maxActionsPerSession, session_age_ms: 0, kill_switch_engaged: false } })).reason).toBe('SESSION_ACTION_LIMIT');
    expect(evaluateBrowserAction(policyInput({ type: 'read_text' }, { risk_context: { session_action_count: 0, session_age_ms: EXECUTION_LIMITS.maxSessionAgeMs, kill_switch_engaged: false } })).reason).toBe('SESSION_MAX_AGE');
    expect(evaluateBrowserAction(policyInput({ type: 'navigate', url: 'http://10.0.0.1/' })).reason).toBe('URL_BLOCKED');
  });

  it('Mandanten-Ebene verschärft nur und ist fail-closed', () => {
    const read = { type: 'read_text' } as BrowserAction;
    expect(evaluateBrowserAction(policyInput(read, { tenant_policy: { status: 'unavailable', error_code: 'x' } }))).toMatchObject({ decision: 'DENY', reason: 'POLICY_UNAVAILABLE' });
    expect(evaluateBrowserAction(policyInput(read, { tenant_policy: { status: 'evaluated', decision: 'block', policy_id: 'p9', snapshot_version: 's', reason_text: null } }))).toMatchObject({ decision: 'DENY', policy_id: 'p9' });
    expect(evaluateBrowserAction(policyInput(read, { tenant_policy: { status: 'evaluated', decision: 'require_approval', policy_id: 'p8', snapshot_version: 's', reason_text: 'Vier Augen' } }))).toMatchObject({ decision: 'REQUIRE_APPROVAL', policy_id: 'p8', reason: 'TENANT_POLICY_REQUIRES_APPROVAL' });
    // "allow" einer Mandanten-Policy hebt die Freigabepflicht für Mutationen NICHT auf.
    expect(evaluateBrowserAction(policyInput({ type: 'click', selector: '#a' }, { tenant_policy: { status: 'evaluated', decision: 'allow', policy_id: 'p7', snapshot_version: 's', reason_text: null } })).decision).toBe('REQUIRE_APPROVAL');
    const warn = evaluateBrowserAction(policyInput(read, { tenant_policy: { status: 'evaluated', decision: 'warn', policy_id: 'p6', snapshot_version: 's', reason_text: null } }));
    expect(warn.decision).toBe('ALLOW');
    expect(warn.conditions).toContain('tenant_warn:p6');
  });

  it('PDP-Ergebnis ohne Treffer bleibt ohne Einschränkung, mit Versionsnachweis', () => {
    expect(overlayFromPdpResult({ decision: 'log_only', primary_policy_id: null, matched_policy_ids: [], snapshot_version: 'v1', reasons: [] }))
      .toEqual({ status: 'evaluated', decision: 'allow', policy_id: null, snapshot_version: 'v1', reason_text: null });
    expect(overlayFromPdpResult({ decision: 'block', primary_policy_id: 'p', matched_policy_ids: ['p'], snapshot_version: 'v2', reasons: [{ text_de: 'nein' }] }))
      .toEqual({ status: 'evaluated', decision: 'block', policy_id: 'p', snapshot_version: 'v2', reason_text: 'nein' });
  });
});

describe('computeCapabilities', () => {
  const ready: CapabilityInput = {
    tenantVerified: true,
    role: 'owner',
    entitlement: { key: 'ai.tool.automations', status: 'granted' },
    killSwitch: { engaged: false, available: true },
    executor: readyHealth(),
    policyEngine: { baselineActive: true, tenantSnapshotLoaded: true },
    evidenceStore: { available: true },
    autonomyPolicyDefined: true,
    executionLimitsDefined: true,
    uploadSourceConfigured: false,
  };

  it('alles erfüllt → alle Modi', () => {
    const r = computeCapabilities(ready);
    expect([r.can_assist, r.can_copilot, r.can_autonomous]).toEqual([true, true, true]);
  });

  it.each([
    ['autonomyPolicyDefined', { autonomyPolicyDefined: false }, 'APPROVAL_POLICY_MISSING'],
    ['executor ohne frame', { executor: { ...readyHealth(), capabilities: ['navigate'] } }, 'SESSION_VISUALIZATION_UNAVAILABLE'],
    ['keine Limits', { executionLimitsDefined: false }, 'EXECUTION_LIMITS_MISSING'],
    ['kein Kill-Switch', { killSwitch: { engaged: false, available: false } }, 'KILL_SWITCH_MISSING'],
    ['editor', { role: 'editor' }, 'ROLE_NOT_PERMITTED'],
    ['busy', { executor: { ...readyHealth(), status: 'busy' as const } }, 'EXECUTOR_BUSY'],
  ])('Autonomous gesperrt: %s', (_name, patch, reason) => {
    const r = computeCapabilities({ ...ready, ...(patch as Partial<CapabilityInput>) });
    expect(r.can_autonomous).toBe(false);
    expect(r.reasons.autonomous).toContain(reason);
  });

  it('Executor offline sperrt Co-Pilot und alle Aktionen mit Grund, nicht aber Assist', () => {
    const r = computeCapabilities({ ...ready, executor: { ...readyHealth(), status: 'offline', reason_code: 'EXECUTOR_NOT_CONFIGURED', capabilities: [] } });
    expect(r.can_assist).toBe(true);
    expect(r.can_copilot).toBe(false);
    expect(r.reasons.copilot).toEqual(['EXECUTOR_OFFLINE']);
    expect(Object.values(r.actions).every((a) => !a.available)).toBe(true);
    expect(r.actions.navigate.reason).toBe('EXECUTOR_OFFLINE');
  });

  it('fehlendes Entitlement sperrt alle Modi', () => {
    const r = computeCapabilities({ ...ready, entitlement: { key: 'ai.tool.automations', status: 'denied' } });
    expect([r.can_assist, r.can_copilot, r.can_autonomous]).toEqual([false, false, false]);
    expect(r.reasons.assist).toEqual(['ENTITLEMENT_REQUIRED']);
    expect(r.actions.navigate.reason).toBe('ENTITLEMENT_REQUIRED');
  });

  it('extract wird über die Executor-Fähigkeit read_text abgebildet', () => {
    expect(computeCapabilities(ready).actions.extract.available).toBe(true);
  });
});

describe('Session-Automat', () => {
  const session: SessionRow = {
    id: 's', tenant_id: T, user_id: 'u1', executor_session_id: 'rsx', mode: 'assist', status: 'ready',
    current_url: null, page_title: null, action_count: 0,
    created_at: '2026-09-29T10:00:00.000Z', expires_at: '2026-09-29T10:15:00.000Z',
  };
  const now = new Date('2026-09-29T10:05:00.000Z');

  it('erlaubte und verbotene Übergänge', () => {
    expect(canTransition('creating', 'ready')).toBe(true);
    expect(canTransition('ready', 'awaiting_approval')).toBe(true);
    expect(canTransition('closed', 'ready')).toBe(false);
    expect(canTransition('failed', 'ready')).toBe(false);
    expect(canTransition('paused', 'executing')).toBe(false);
  });

  it('Ablauf: Leerlauf-TTL, gedeckelt durch maximale Laufzeit', () => {
    const created = new Date('2026-09-29T10:00:00.000Z');
    expect(nextExpiry(new Date('2026-09-29T10:05:00.000Z'), created).toISOString()).toBe('2026-09-29T10:20:00.000Z');
    expect(nextExpiry(new Date('2026-09-29T10:55:00.000Z'), created).toISOString()).toBe('2026-09-29T11:00:00.000Z');
  });

  it('prüft Besitz, Status und Ablauf', () => {
    expect(() => assertSessionActionable(session, { user_id: 'u2' }, 'read_text', now, false)).toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
    expect(() => assertSessionActionable({ ...session, status: 'closed' }, { user_id: 'u1' }, 'read_text', now, false)).toThrow(expect.objectContaining({ code: 'SESSION_NOT_FOUND' }));
    expect(() => assertSessionActionable({ ...session, status: 'executing' }, { user_id: 'u1' }, 'read_text', now, false)).toThrow(expect.objectContaining({ code: 'SESSION_BUSY' }));
    expect(() => assertSessionActionable(session, { user_id: 'u1' }, 'read_text', new Date('2026-09-29T10:16:00.000Z'), false)).toThrow(expect.objectContaining({ code: 'SESSION_EXPIRED' }));
    expect(() => assertSessionActionable({ ...session, status: 'awaiting_approval' }, { user_id: 'u1' }, 'navigate', now, false)).toThrow(expect.objectContaining({ code: 'APPROVAL_PENDING' }));
    expect(() => assertSessionActionable({ ...session, status: 'awaiting_approval' }, { user_id: 'u1' }, 'screenshot', now, false)).not.toThrow();
    expect(() => assertSessionActionable({ ...session, status: 'awaiting_approval' }, { user_id: 'u1' }, 'click', now, true)).not.toThrow();
  });

  it('Executor-Session-IDs sind zufällig und ohne Mandanten-/Nutzerbezug', () => {
    const id = newExecutorSessionId(() => new Uint8Array(24).fill(171));
    expect(id).toBe(`rsx_${'ab'.repeat(24)}`);
  });
});

describe('Executor-Client', () => {
  it('Health-Mapping ohne vorgetäuschte Bereitschaft', () => {
    const at = '2026-09-29T00:00:00.000Z';
    expect(healthFromResponse('x', at, null, null)).toMatchObject({ status: 'offline', reason_code: 'EXECUTOR_UNREACHABLE' });
    expect(healthFromResponse('x', at, 401, {})).toMatchObject({ status: 'error', reason_code: 'EXECUTOR_AUTH_FAILED' });
    expect(healthFromResponse('x', at, 500, {})).toMatchObject({ status: 'error', reason_code: 'EXECUTOR_HTTP_500' });
    expect(healthFromResponse('x', at, 200, { ok: true, version: '2026.05.0' })).toMatchObject({ status: 'degraded', reason_code: 'EXECUTOR_LEGACY_NO_SESSIONS' });
    expect(healthFromResponse('x', at, 200, { status: 'degraded', browser_connected: false, capabilities: ['frame'] })).toMatchObject({ status: 'degraded' });
    expect(healthFromResponse('x', at, 200, { status: 'ok', capabilities: ['frame'], active_sessions: 5, max_sessions: 5 })).toMatchObject({ status: 'busy' });
    expect(healthFromResponse('x', at, 200, { status: 'starting', capabilities: ['frame'] })).toMatchObject({ status: 'connecting' });
    expect(healthFromResponse('x', at, 200, { status: 'ok', capabilities: ['frame'], active_sessions: 1, max_sessions: 5, version: 'v', runtime: 'r' }))
      .toMatchObject({ status: 'ready', reason_code: null, version: 'v', runtime: 'r', active_sessions: 1 });
  });

  it('nicht konfiguriert: health offline, Aktionen EXECUTOR_OFFLINE — ohne Netzwerkzugriff', async () => {
    let fetched = 0;
    const c = createExecutorClient(null, async () => { fetched++; return new Response('{}'); });
    expect(await c.health()).toMatchObject({ status: 'offline', reason_code: 'EXECUTOR_NOT_CONFIGURED' });
    await expect(c.execute('rsx', { type: 'read_text' })).rejects.toMatchObject({ code: 'EXECUTOR_OFFLINE' });
    expect(fetched).toBe(0);
  });

  it('Executor-Fehlercodes werden stabil übersetzt', () => {
    expect(errorFromExecutor(404, 'SESSION_NOT_FOUND').code).toBe('SESSION_NOT_FOUND');
    expect(errorFromExecutor(403, 'PRIVATE_NETWORK_BLOCKED').code).toBe('URL_BLOCKED');
    expect(errorFromExecutor(429, 'TOO_MANY_SESSIONS').code).toBe('SESSION_LIMIT_REACHED');
    expect(errorFromExecutor(400, 'UNSUPPORTED_ACTION').code).toBe('ACTION_NOT_SUPPORTED');
    expect(errorFromExecutor(401, 'UNAUTHORIZED').code).toBe('EXECUTOR_OFFLINE');
    expect(errorFromExecutor(500, null).code).toBe('EXECUTION_FAILED');
  });

  it('sendet den Key nur als Header und die Session-ID im Body', async () => {
    const seen: Array<{ url: string; auth: string | null; body: string | null }> = [];
    const c = createExecutorClient({ baseUrl: 'https://exec.example/', apiKey: 'k-123', executorId: 'e' }, async (url, init) => {
      const headers = new Headers(init?.headers);
      seen.push({ url, auth: headers.get('authorization'), body: (init?.body as string) ?? null });
      return new Response(JSON.stringify({ ok: true, results: [{ ok: true, url: 'https://a/', verification: { status: 'passed', checks: {} } }], page: { url: 'https://a/', title: 'A' } }), { status: 200 });
    });
    const out = await c.execute('rsx_1', { type: 'read_text' });
    expect(out.result).toMatchObject({ ok: true, url: 'https://a/', verification: { status: 'passed' } });
    expect(seen[0].url).toBe('https://exec.example/execute');
    expect(seen[0].auth).toBe('Bearer k-123');
    expect(JSON.parse(seen[0].body!)).toEqual({ session_id: 'rsx_1', actions: [{ type: 'read_text' }], require_session: true, include_frame: true });
  });
});
