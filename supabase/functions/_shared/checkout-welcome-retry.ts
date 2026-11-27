// Policy only: the database adapter must atomically claim and finalize jobs.
// Provider acceptance is not recipient delivery.
export type WelcomeMailOutcome =
  | { state: 'accepted'; providerId: string }
  | { state: 'retry'; nextAttemptAt: string; reason: string }
  | { state: 'manual_review'; reason: string };

export interface WelcomeMailAttempt {
  attempt: number;
  firstAttemptAt: string;
  now: string;
}

// Conservative retry horizon below Resend's 24-hour idempotency window.
// Beyond the horizon, require reconciliation rather than risking duplicates.
const RETRY_MINUTES = [1, 5, 30, 120, 360] as const;
const HORIZON_MS = 20 * 60 * 60 * 1000;

export function welcomeMailFailure(attempt: WelcomeMailAttempt, error: unknown): WelcomeMailOutcome {
  const reason = error instanceof Error ? error.message : 'UNKNOWN';
  const first = Date.parse(attempt.firstAttemptAt);
  const now = Date.parse(attempt.now);
  if (!Number.isFinite(first) || !Number.isFinite(now) || now < first ||
      !Number.isInteger(attempt.attempt) || attempt.attempt < 1) {
    return { state: 'manual_review', reason: 'INVALID_ATTEMPT_STATE' };
  }
  const status = /^WELCOME_EMAIL_HTTP_(\d{3})$/.exec(reason);
  const http = status ? Number(status[1]) : null;
  const transient = http === 408 || http === 429 || (http !== null && http >= 500 && http < 600) ||
    error instanceof TypeError;
  // Avoid storing raw errors: fetch exceptions may contain sensitive details.
  const safeReason = status ? 'WELCOME_EMAIL_HTTP_' + http :
    error instanceof TypeError ? 'NETWORK_ERROR' :
    reason === 'WELCOME_EMAIL_NOT_CONFIGURED' ? reason : 'UNKNOWN_OR_AMBIGUOUS';
  const delay = RETRY_MINUTES[attempt.attempt - 1];
  if (!transient || delay === undefined || now + delay * 60000 >= first + HORIZON_MS) {
    return { state: 'manual_review', reason: safeReason };
  }
  return { state: 'retry', nextAttemptAt: new Date(now + delay * 60000).toISOString(), reason: safeReason };
}

/** Call only for a job already atomically claimed by a trusted worker.
 * Persistence, leases and delivery-event reconciliation are intentionally
 * outside this pure policy. Never call checkout/provisioning from this worker.
 */
export async function processClaimedWelcomeMail(
  attempt: WelcomeMailAttempt,
  send: () => Promise<string>,
): Promise<WelcomeMailOutcome> {
  const first = Date.parse(attempt.firstAttemptAt);
  const now = Date.parse(attempt.now);
  if (!Number.isFinite(first) || !Number.isFinite(now) || now < first ||
      now - first >= HORIZON_MS || !Number.isInteger(attempt.attempt) ||
      attempt.attempt < 1 || attempt.attempt > RETRY_MINUTES.length + 1) {
    return { state: 'manual_review', reason: 'RETRY_WINDOW_CLOSED_OR_INVALID' };
  }
  try {
    const providerId = await send();
    if (!providerId.trim()) return { state: 'manual_review', reason: 'PROVIDER_ID_MISSING' };
    return { state: 'accepted', providerId };
  } catch (error) {
    return welcomeMailFailure(attempt, error);
  }
}
