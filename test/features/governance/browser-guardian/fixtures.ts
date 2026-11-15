import type { ActionRequest, GuardianContext, GuardianPolicy, SessionState } from '../../../../packages/browser-guardian/src/index.ts';

export const POLICY: GuardianPolicy = {
  policy_id: 'tenant-demo-browser',
  version: '2026-11-15.1',
  origins: [
    { origin: 'https://www.example.org', data_class: 'public' },
    { origin: 'https://*.example.org', data_class: 'public' },
    { origin: 'https://intranet.firma.example', data_class: 'internal' },
    { origin: 'https://crm.firma.example', data_class: 'personal' },
  ],
  blocked_origins: ['https://evil.example'],
};

export const CONTEXT: GuardianContext = {
  tenant_id: 'tenant-1',
  session_id: 'session-1',
  actor_id: 'user-1',
  kill_switch: false,
};

export const FRESH: SessionState = { current_url: null, current_class: 'unclassified', tainted: false, halted: false, step_count: 0 };

export function on(url: string, cls: SessionState['current_class'], tainted = false): SessionState {
  return { ...FRESH, current_url: url, current_class: cls, tainted };
}

export function req(action: unknown, extra: Partial<ActionRequest> = {}): ActionRequest {
  return { action, source: 'planner', channel: 'planner', ...extra };
}
