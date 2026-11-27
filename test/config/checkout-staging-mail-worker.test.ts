import { describe, expect, it, vi } from 'vitest';
import { runStagingCheckoutMail } from '../../supabase/functions/_shared/checkout-staging-mail-worker';
import { createStagingMailStore } from '../../supabase/functions/_shared/checkout-staging-mail-store';

const now = () => new Date('2026-11-27T10:00:00Z');
const job = { id: 'job', session_id: 'cs_test_fixture', recipient: 'fixture@example.invalid',
  attempts: 1, first_attempt_at: now().toISOString(), lease_until: '2026-11-27T10:05:00Z', claim_token: 'token' };
function fixture() {
  const claim = vi.fn(async () => ({ ...job }));
  const finish = vi.fn(async (_args: Parameters<import('../../supabase/functions/_shared/checkout-staging-mail-worker').StagingMailStore['finish']>[0]) => true);
  const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ id: 'fixture_id' }), { status: 200 }));
  return { environment: 'staging' as const, approvedRecipient: job.recipient, apiKey: 'fake', from: 'test@example.invalid', now, store: { claim, finish }, fetcher };
}
describe('staging checkout mail worker', () => {
  it('persists acceptance with stable idempotency key', async () => {
    const f = fixture();
    expect(await runStagingCheckoutMail(f)).toBe('accepted');
    expect(f.fetcher.mock.calls[0][1]?.headers).toMatchObject({ 'Idempotency-Key': 'checkout-welcome/cs_test_fixture' });
    expect(f.store.finish).toHaveBeenCalledWith(expect.objectContaining({p_token:'token',p_provider:'fixture_id',p_outcome:'accepted'}));
  });
  it('blocks production before claiming', async () => {
    const f = fixture();
    await expect(runStagingCheckoutMail({ ...f, environment:'production' })).rejects.toThrow('STAGING_MAIL_DISABLED');
    expect(f.store.claim).not.toHaveBeenCalled();
  });
  it('rejects non-approved recipients and live sessions', async () => {
    for (const change of [{ recipient:'other@example.invalid' }, { session_id:'cs_live_fixture' }]) {
      const f = fixture(); f.store.claim.mockResolvedValue({ ...job, ...change });
      expect(await runStagingCheckoutMail(f)).toBe('manual_review');
      expect(f.fetcher).not.toHaveBeenCalled();
    }
  });
  it('does not send with an expired lease', async () => {
    const f = fixture(); f.store.claim.mockResolvedValue({ ...job, lease_until:now().toISOString() });
    expect(await runStagingCheckoutMail(f)).toBe('lease_lost');
    expect(f.fetcher).not.toHaveBeenCalled();
  });
  it('persists retry on provider outage', async () => {
    const f = fixture(); f.fetcher.mockResolvedValue(new Response('', { status:503 }));
    expect(await runStagingCheckoutMail(f)).toBe('retry');
    expect(f.store.finish).toHaveBeenCalledWith(expect.objectContaining({p_outcome:'retry',p_next:'2026-11-27T10:01:00.000Z'}));
  });
  it('does not report acceptance if finalization rejected the token', async () => {
    const f = fixture(); f.store.finish.mockResolvedValue(false);
    expect(await runStagingCheckoutMail(f)).toBe('lease_lost');
  });
  it('maps atomic RPC results and rejects malformed responses', async () => {
    const rpc = vi.fn(async (_name:string,_args?:Record<string,unknown>) => ({data:[job] as unknown,error:null}));
    const store = createStagingMailStore({rpc});
    expect(await store.claim()).toEqual(job);
    rpc.mockResolvedValue({data:[],error:null});
    expect(await store.claim()).toBeNull();
    rpc.mockResolvedValue({data:[{},{}],error:null});
    await expect(store.claim()).rejects.toThrow('MAIL_CLAIM_FAILED');
  });
});
