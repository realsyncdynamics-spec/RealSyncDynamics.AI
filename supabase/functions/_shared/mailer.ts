// Canonical transactional mailer for Edge Functions.
//
// Secret resolution is vault-first:
//   1. RPC get_app_secret('resend_api_key')  → vault.secrets
//   2. Deno.env RESEND_API_KEY               → local / CI fallback
//
// Evidence Vault (customer proof / hash-chain) is a different store.
// Never write customer evidence into vault.secrets and never log the key.

import { createClient } from 'jsr:@supabase/supabase-js@2';

export const RESEND_API_URL = 'https://api.resend.com/emails';
export const DEFAULT_FROM = 'RealSyncDynamics.AI <noreply@realsyncdynamicsai.de>';
export const DEFAULT_REPLY_TO = 'kontakt@realsyncdynamicsai.de';

export type ServiceClient = ReturnType<typeof createClient>;

export type MailSource = 'vault' | 'env' | 'missing';

export interface ResolvedResendKey {
  key: string | null;
  source: MailSource;
}

export async function resolveResendKey(supa: ServiceClient): Promise<ResolvedResendKey> {
  try {
    const { data } = await supa.rpc('get_app_secret', { secret_name: 'resend_api_key' });
    if (typeof data === 'string' && data.startsWith('re_')) {
      return { key: data, source: 'vault' };
    }
  } catch {
    /* RPC missing in local — fall through to env */
  }

  const env = Deno.env.get('RESEND_API_KEY');
  if (env && env.startsWith('re_')) return { key: env, source: 'env' };

  console.warn('[mailer] RESEND_API_KEY missing from vault and env');
  return { key: null, source: 'missing' };
}

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
}

export interface SendEmailResult {
  ok: boolean;
  skipped?: 'no_api_key';
  source?: MailSource;
  id?: string;
  error?: string;
}

export async function sendResendEmail(
  supa: ServiceClient,
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const resolved = await resolveResendKey(supa);
  if (!resolved.key) {
    return { ok: true, skipped: 'no_api_key', source: 'missing' };
  }

  const to = Array.isArray(input.to) ? input.to : [input.to];
  const resp = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resolved.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: input.from ?? DEFAULT_FROM,
      to,
      subject: input.subject,
      html: input.html,
      reply_to: input.replyTo ?? DEFAULT_REPLY_TO,
      tags: input.tags,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error(`[mailer] resend ${resp.status}`);
    return { ok: false, source: resolved.source, error: err.slice(0, 500) };
  }

  const sent = await resp.json() as { id?: string };
  return { ok: true, source: resolved.source, id: sent.id };
}
