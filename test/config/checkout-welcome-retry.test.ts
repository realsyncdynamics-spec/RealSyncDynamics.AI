import { describe, expect, it, vi } from 'vitest';
import { processClaimedWelcomeMail } from '../../supabase/functions/_shared/checkout-welcome-retry';

describe('claimed welcome email retry policy', () => {
  const attempt = { attempt: 1, firstAttemptAt: '2026-11-26T10:00:00Z', now: '2026-11-26T10:00:00Z' };
  it('records provider acceptance without calling it delivery', async () => {
    await expect(processClaimedWelcomeMail(attempt, async () => 'email_fixture')).resolves.toEqual({ state: 'accepted', providerId: 'email_fixture' });
  });
  it('backs off on rate limits and provider outages', async () => {
    for (const status of [429, 503]) {
      await expect(processClaimedWelcomeMail(attempt, async () => { throw new Error('WELCOME_EMAIL_HTTP_' + status); })).resolves.toMatchObject({ state: 'retry', nextAttemptAt: '2026-11-26T10:01:00.000Z' });
    }
  });
  it('requires manual review for configuration and ambiguous errors', async () => {
    for (const error of ['WELCOME_EMAIL_HTTP_401', 'WELCOME_EMAIL_NO_PROVIDER_ID', 'WELCOME_EMAIL_NOT_CONFIGURED']) {
      await expect(processClaimedWelcomeMail(attempt, async () => { throw new Error(error); })).resolves.toMatchObject({ state: 'manual_review' });
    }
  });
  it('never sends beyond the retry horizon or attempt limit', async () => {
    const send = vi.fn(async () => 'fixture');
    await expect(processClaimedWelcomeMail({ ...attempt, now: '2026-11-27T06:00:00Z' }, send)).resolves.toMatchObject({ state: 'manual_review' });
    await expect(processClaimedWelcomeMail({ ...attempt, attempt: 7 }, send)).resolves.toMatchObject({ state: 'manual_review' });
    expect(send).not.toHaveBeenCalled();
  });
});
