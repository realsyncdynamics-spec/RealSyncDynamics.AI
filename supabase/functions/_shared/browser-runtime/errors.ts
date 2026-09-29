// Governed Browser Runtime — strukturierte Fehlercodes (rein, vitest-importierbar).
//
// Der Client bekommt nur Code + kurze technische Nachricht; die Übersetzung in
// verständliche Sprache passiert im Frontend (browserRuntimeClient.ts).
// Technische Details (DB-Codes, Executor-Antworten) landen ausschließlich im
// Function-Log — ohne Secrets, Tokens oder Nutzereingaben.

export const BROWSER_RUNTIME_ERROR_CODES = [
  'AUTH_REQUIRED',
  'TENANT_REQUIRED',
  'FORBIDDEN',
  'ENTITLEMENT_REQUIRED',
  'EXECUTOR_OFFLINE',
  'SESSION_NOT_FOUND',
  'SESSION_EXPIRED',
  'SESSION_BUSY',
  'SESSION_LIMIT_REACHED',
  'POLICY_DENIED',
  'POLICY_UNAVAILABLE',
  'APPROVAL_REQUIRED',
  'APPROVAL_PENDING',
  'APPROVAL_DENIED',
  'APPROVAL_EXPIRED',
  'APPROVAL_ALREADY_USED',
  'APPROVAL_MISMATCH',
  'APPROVAL_NOT_FOUND',
  'ACTION_NOT_SUPPORTED',
  'VALIDATION_FAILED',
  'URL_BLOCKED',
  'KILL_SWITCH_ENGAGED',
  'RATE_LIMITED',
  'EXECUTION_FAILED',
  'SCAN_FAILED',
  'EVIDENCE_WRITE_FAILED',
  'INTERNAL_ERROR',
] as const;

export type BrowserRuntimeErrorCode = (typeof BROWSER_RUNTIME_ERROR_CODES)[number];

export const HTTP_STATUS: Record<BrowserRuntimeErrorCode, number> = {
  AUTH_REQUIRED: 401,
  TENANT_REQUIRED: 400,
  FORBIDDEN: 403,
  ENTITLEMENT_REQUIRED: 403,
  EXECUTOR_OFFLINE: 503,
  SESSION_NOT_FOUND: 404,
  SESSION_EXPIRED: 409,
  SESSION_BUSY: 409,
  SESSION_LIMIT_REACHED: 429,
  POLICY_DENIED: 403,
  POLICY_UNAVAILABLE: 503,
  APPROVAL_REQUIRED: 409,
  APPROVAL_PENDING: 409,
  APPROVAL_DENIED: 409,
  APPROVAL_EXPIRED: 409,
  APPROVAL_ALREADY_USED: 409,
  APPROVAL_MISMATCH: 409,
  APPROVAL_NOT_FOUND: 404,
  ACTION_NOT_SUPPORTED: 422,
  VALIDATION_FAILED: 400,
  URL_BLOCKED: 403,
  KILL_SWITCH_ENGAGED: 423,
  RATE_LIMITED: 429,
  EXECUTION_FAILED: 502,
  SCAN_FAILED: 502,
  EVIDENCE_WRITE_FAILED: 503,
  INTERNAL_ERROR: 500,
};

export class BrowserRuntimeError extends Error {
  readonly status: number;
  constructor(
    readonly code: BrowserRuntimeErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'BrowserRuntimeError';
    this.status = HTTP_STATUS[code];
  }
}

export function isBrowserRuntimeError(value: unknown): value is BrowserRuntimeError {
  return value instanceof BrowserRuntimeError;
}

/**
 * Mappt die Antworten von _shared/auth.ts (requireAuthAndTenant) auf die
 * Runtime-Codes. Dort gibt es 401 UNAUTHORIZED, 400 BAD_REQUEST (tenant_id
 * fehlt), 403 FORBIDDEN (keine Mitgliedschaft) und 500 INTERNAL.
 */
export function codeForAuthStatus(status: number): BrowserRuntimeErrorCode {
  if (status === 401) return 'AUTH_REQUIRED';
  if (status === 400) return 'TENANT_REQUIRED';
  if (status === 403) return 'FORBIDDEN';
  return 'INTERNAL_ERROR';
}
