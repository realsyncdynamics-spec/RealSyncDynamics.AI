// Governed Browser Runtime — Session-Zustandsautomat (rein, getestet).
//
// Eine browser_sessions-Zeile repräsentiert genau eine Executor-Session.
// Statuswechsel passieren nur serverseitig; ungültige Übergänge sind Fehler,
// kein stilles Überschreiben.

import { BrowserRuntimeError } from './errors.ts';
import { EXECUTION_LIMITS } from './policy.ts';
import type { BrowserActionType } from './actions.ts';

export type SessionStatus =
  | 'creating'
  | 'ready'
  | 'executing'
  | 'awaiting_approval'
  | 'paused'
  | 'failed'
  | 'closed';

export const OPEN_STATUSES: ReadonlySet<SessionStatus> = new Set([
  'creating', 'ready', 'executing', 'awaiting_approval', 'paused',
]);

const TRANSITIONS: Record<SessionStatus, readonly SessionStatus[]> = {
  creating: ['ready', 'failed', 'closed'],
  ready: ['executing', 'awaiting_approval', 'paused', 'failed', 'closed'],
  executing: ['ready', 'awaiting_approval', 'paused', 'failed', 'closed'],
  awaiting_approval: ['ready', 'executing', 'paused', 'failed', 'closed'],
  paused: ['ready', 'failed', 'closed'],
  failed: ['closed'],
  closed: [],
};

export function canTransition(from: SessionStatus, to: SessionStatus): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

export function assertTransition(from: SessionStatus, to: SessionStatus): void {
  if (!canTransition(from, to)) {
    throw new BrowserRuntimeError('INTERNAL_ERROR', `invalid session transition ${from} → ${to}`);
  }
}

export interface SessionRow {
  id: string;
  tenant_id: string;
  user_id: string;
  executor_session_id: string;
  mode: 'assist' | 'copilot' | 'autonomous';
  status: SessionStatus;
  current_url: string | null;
  page_title: string | null;
  action_count: number;
  created_at: string;
  expires_at: string;
}

/** Neues Ablaufdatum: Leerlauf-TTL, gedeckelt durch die maximale Laufzeit. */
export function nextExpiry(now: Date, createdAt: Date): Date {
  const idle = now.getTime() + EXECUTION_LIMITS.sessionIdleTtlMs;
  const hardCap = createdAt.getTime() + EXECUTION_LIMITS.maxSessionAgeMs;
  return new Date(Math.min(idle, hardCap));
}

export function isExpired(session: Pick<SessionRow, 'expires_at'>, now: Date): boolean {
  return Date.parse(session.expires_at) <= now.getTime();
}

/** Aktionen, die die Seite (und damit eine offene Freigabe-Bindung) nicht verändern. */
const SAFE_WHILE_AWAITING: ReadonlySet<BrowserActionType> = new Set([
  'scroll', 'wait', 'extract', 'read_text', 'read_dom', 'screenshot',
]);

/**
 * Darf auf dieser Session jetzt eine Aktion laufen?
 * `withApproval` = der Aufruf löst eine erteilte Freigabe ein.
 */
export function assertSessionActionable(
  session: SessionRow,
  actor: { user_id: string },
  action: BrowserActionType,
  now: Date,
  withApproval: boolean,
): void {
  if (session.user_id !== actor.user_id) {
    throw new BrowserRuntimeError('FORBIDDEN', 'session belongs to another user');
  }
  if (session.status === 'closed' || session.status === 'failed') {
    throw new BrowserRuntimeError('SESSION_NOT_FOUND', `session is ${session.status}`);
  }
  if (isExpired(session, now)) {
    throw new BrowserRuntimeError('SESSION_EXPIRED', 'session expired');
  }
  if (session.status === 'creating') {
    throw new BrowserRuntimeError('SESSION_BUSY', 'session is still being created');
  }
  if (session.status === 'executing') {
    throw new BrowserRuntimeError('SESSION_BUSY', 'another action is running in this session');
  }
  if (session.status === 'paused') {
    throw new BrowserRuntimeError('SESSION_BUSY', 'session is paused', { status: 'paused' });
  }
  if (session.status === 'awaiting_approval' && !withApproval && !SAFE_WHILE_AWAITING.has(action)) {
    throw new BrowserRuntimeError('APPROVAL_PENDING', 'an approval is pending in this session');
  }
}

/** Zufällige, nicht erratbare Executor-Session-ID (kein Mandanten-/Nutzerbezug). */
export function newExecutorSessionId(randomBytes: (n: number) => Uint8Array): string {
  const bytes = randomBytes(24);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return `rsx_${hex}`;
}
