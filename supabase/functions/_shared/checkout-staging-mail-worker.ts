import { processClaimedWelcomeMail } from './checkout-welcome-retry.ts';
import { sendCheckoutWelcomeMail } from './checkout-welcome-mail.ts';

export interface StagingMailJob {
  id: string;
  session_id: string;
  recipient: string;
  attempts: number;
  first_attempt_at: string;
  lease_until: string;
  claim_token: string;
}
export interface StagingMailStore {
  claim(): Promise<StagingMailJob | null>;
  finish(args: {
    p_job: string; p_token: string; p_outcome: 'accepted' | 'retry' | 'manual_review';
    p_provider: string | null; p_reason: string | null; p_next: string | null;
  }): Promise<boolean>;
}
export interface StagingMailOptions {
  environment: 'staging' | 'production';
  approvedRecipient: string;
  apiKey: string;
  from: string;
  store: StagingMailStore;
  now?: () => Date;
  fetcher?: typeof fetch;
}

/** One job per invocation. Never grants access; provider acceptance is not delivery. */
export async function runStagingCheckoutMail(options: StagingMailOptions) {
  if (options.environment !== 'staging' || !options.approvedRecipient.trim() ||
      !options.apiKey.trim() || !options.from.trim()) throw new Error('STAGING_MAIL_DISABLED');
  const now = options.now ?? (() => new Date());
  const job = await options.store.claim();
  if (!job) return 'idle' as const;
  if (!job.claim_token || !Number.isFinite(Date.parse(job.lease_until)) ||
      Date.parse(job.lease_until) - now().getTime() < 30000) {
    return 'lease_lost' as const;
  }
  const permitted = /^cs_test_[a-zA-Z0-9]+$/.test(job.session_id) &&
    job.recipient.trim().toLowerCase() === options.approvedRecipient.trim().toLowerCase();
  const outcome = permitted ? await processClaimedWelcomeMail({
    attempt: job.attempts, firstAttemptAt: job.first_attempt_at, now: now().toISOString(),
  }, () => sendCheckoutWelcomeMail({
    apiKey: options.apiKey, sessionId: job.session_id, from: options.from,
    email: options.approvedRecipient.trim(), subject: '[TEST] RealSync Dynamics & AI – Kaufbestätigung',
    html: '<p>Dies ist eine Testnachricht aus der isolierten Staging-Umgebung. Keine echte Bestellung oder Freischaltung.</p>',
  }, async (input, init) => (options.fetcher ?? fetch)(input, { ...init, signal: AbortSignal.timeout(15000) })))
    : { state: 'manual_review' as const, reason: 'STAGING_RECIPIENT_OR_SESSION_REJECTED' };
  const saved = await options.store.finish({
    p_job: job.id, p_token: job.claim_token, p_outcome: outcome.state,
    p_provider: outcome.state === 'accepted' ? outcome.providerId : null,
    p_reason: outcome.state === 'accepted' ? null : outcome.reason,
    p_next: outcome.state === 'retry' ? outcome.nextAttemptAt : null,
  });
  return saved ? outcome.state : 'lease_lost';
}
