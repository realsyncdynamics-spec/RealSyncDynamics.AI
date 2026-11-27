import type { StagingMailJob, StagingMailStore } from './checkout-staging-mail-worker.ts';

interface RpcClient {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
}

/** Only accept a server-owned client configured for the isolated staging project. */
export function createStagingMailStore(client: RpcClient): StagingMailStore {
  return {
    async claim() {
      const { data, error } = await client.rpc('claim_checkout_email');
      if (error || !Array.isArray(data) || data.length > 1) throw new Error('MAIL_CLAIM_FAILED');
      if (!data.length) return null;
      const j = data[0] as Partial<StagingMailJob>;
      if (!j || typeof j.id !== 'string' || typeof j.session_id !== 'string' ||
          typeof j.recipient !== 'string' || typeof j.claim_token !== 'string' ||
          typeof j.attempts !== 'number' || typeof j.first_attempt_at !== 'string' ||
          typeof j.lease_until !== 'string') throw new Error('MAIL_CLAIM_INVALID');
      return j as StagingMailJob;
    },
    async finish(args) {
      const { data, error } = await client.rpc('finish_checkout_email', { ...args });
      if (error || typeof data !== 'boolean') throw new Error('MAIL_FINISH_FAILED');
      return data;
    },
  };
}
